// apps/backend/src/server/routes.ts
import { Router } from 'express';
import { telegramAuth } from '../api/telegramAuth';
import { CatalogService } from '../services/catalog.service';
import { CartService } from '../services/cart.service';
import  ProductsRouter  from "../routes/products";
import { OrdersService } from '../services/orders.service';
import { db } from '../lib/db';
import { ENV } from '../config/env';
import crypto from "crypto";
import {Readable } from "node:stream";
import { publicImageUrl } from "../lib/r2"; // <-- adjust ../ if your path differs
import { firstImageWebUrl } from "../services/image.resolve";


export const api = Router();

const BOT_TOKEN = process.env.BOT_TOKEN!;
if (!BOT_TOKEN) {
  // optional: log a warning; the route below needs it.
  console.warn("BOT_TOKEN is missing – /api/products/:id/image will not work.");
}

function int(v: any, d: number) { const n = parseInt(String(v ?? ''), 10); return Number.isFinite(n) ? n : d; }

api.get('/ping', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// -------- DEBUG (before auth) --------
api.get('/_debug', (req, res) => {
  const auth = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const m = auth.match(/^tma\s+(.+)$/i);
  const raw = m ? m[1] : '';
  res.json({
    hasAuth: !!m,
    authLen: raw.length,
    authPrefix: auth.slice(0, 10),
    ua: req.headers['user-agent'],
    path: req.originalUrl,
  });
});

api.get('/_verify', (req, res) => {
  const auth = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const m = auth.match(/^tma\s+(.+)$/i);
  if (!m) return res.json({ ok: false, reason: 'no_auth_header' });

  const raw = m[1];
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch {}

  const params = new URLSearchParams(decoded);
  const provided = params.get('hash') || '';
  const keys = [...params.keys()].sort();

  const pairs: string[] = [];
  params.forEach((v, k) => { if (k !== 'hash' && k !== 'signature') pairs.push(`${k}=${v}`); });
  pairs.sort();
  const checkString = pairs.join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(ENV.BOT_TOKEN).digest();
  const expected = crypto.createHmac('sha256', secret).update(checkString).digest('hex');

  res.json({
    ok: provided === expected,
    provided_tail: provided.slice(-12),
    expected_tail: expected.slice(-12),
    keysUsed: keys,
    botTokenTail: ENV.BOT_TOKEN.slice(-8),
    reason: provided ? (provided === expected ? 'match' : 'mismatch') : 'hash_missing',
  });
});

import { bot } from '../bot/bot';
api.get('/_whoami', async (_req, res) => {
  try {
    const me = await bot.telegram.getMe();
    res.json({ username: me.username || '', id: me.id, botTokenTail: ENV.BOT_TOKEN.slice(-8) });
  } catch {
    res.json({ username: '', id: 0, botTokenTail: ENV.BOT_TOKEN.slice(-8) });
  }
});

api.get("/_debug/tenant-cats", async (_req, res) => {
  const tenantId = await (await import("../services/tenant.util")).getTenantId();
  const count = await db.category.count({ where: { tenantId } });
  res.json({ tenantId, count });
});


// -------- AUTH GUARD --------
api.use(telegramAuth);

// ---------- Catalog ----------
api.get("/categories", async (_req, res, next) => {
  try {
    const cats = await CatalogService.listCategories();
    // cats already in shape: [{ id, title }, ...] and prefixed with "All"
    res.json(cats);
  } catch (e) {
    next(e);
  }
});

// ... your other api routes ...

const DEV = process.env.NODE_ENV !== "production";

function devSend(res: any, status: number, msg: string) {
  return res.status(status).send(DEV ? msg : String(status));
}

api.get('/products', async (req, res) => {
  const categoryId = String(req.query.category || 'all');
  const page = Number(req.query.page || 1);
  const perPage = Number(req.query.perPage || 12);

  const data = await CatalogService.listProductsByCategoryPaged(categoryId, page, perPage);

  // Force-correct photoUrl for every item using the resolver
  const items = await Promise.all(
    data.items.map(async (it: any) => {
      const photo = await firstImageWebUrl(it.id);             // ← prefers R2, then TG proxy, then legacy
      const apiImage = `/api/products/${it.id}/image`;         // ← backend proxy (good universal fallback)
      const normalized = { ...it, photoUrl: photo, apiImage };
      console.log("[products:list] item", {
        id: normalized.id,
        title: normalized.title,
        active: normalized.active,
        photoUrl: normalized.photoUrl,
        apiImage: normalized.apiImage,
      });
      return normalized;
    })
  );

  const result = { ...data, items };
  console.log("[products:list] summary", {
    categoryId, page, perPage, items: items.length, total: data.total,
  });

  res.json(result);
});

api.get("/products/:id/image", async (req, res) => {
  const id = req.params.id;

  try {
    console.log("[image:route] request", { productId: id });

    const p = await db.product.findFirst({
      where: { id, active: true },
      include: {
        images: {
          orderBy: { position: "asc" },
          take: 1,
          select: { tgFileId: true, imageId: true, url: true },
        },
        tenant: { select: { slug: true, botToken: true } },
      },
    });

    if (!p) {
      console.warn("[image:route] product not found or inactive", { productId: id });
      return res.status(404).send(`Product not found or inactive: ${id}`);
    }

    const im = p.images?.[0];
    if (!im) {
      console.warn("[image:route] no image rows", { productId: id });
      return res.status(404).send(`No image for product: ${id}`);
    }

    // 2) R2 image → fetch and stream (avoid redirect so we control headers)
    if (im.imageId) {
      const url = publicImageUrl(im.imageId, "jpg");
      console.log("[image:route] r2 proxy", { productId: id, imageId: im.imageId, url });

      const r2 = await fetch(url);
      if (!r2.ok) {
        const t = await r2.text().catch(() => "");
        console.error("[image:route] r2 fetch failed", { status: r2.status, body: t.slice(0,200), url });
        return res.status(502).send("R2 fetch failed");
      }

      // Force correct headers for <img>
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Content-Type", r2.headers.get("content-type") || "image/jpeg");

      const body: any = r2.body;
      if (body && typeof (Readable as any).fromWeb === "function") {
        return (Readable as any).fromWeb(body).pipe(res);
      }
      const buf = Buffer.from(await r2.arrayBuffer());
      res.setHeader("Content-Length", String(buf.length));
      return res.end(buf);
}


    if (im.url && /^https?:\/\//i.test(im.url)) {
      console.log("[image:route] legacy redirect", { productId: id, url: im.url });
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.redirect(302, im.url);
    }

    if (im.tgFileId) {
      const slug = p.tenant?.slug;
      const botToken =
        p.tenant?.botToken ||
        (slug ? process.env[`BOT_TOKEN__${slug.toUpperCase()}`] : undefined) ||
        process.env.BOT_TOKEN;

      if (!botToken) {
        console.error("[image:route] missing bot token", { productId: id, slug });
        return res.status(500).send(`BOT_TOKEN missing for tenant ${slug ?? "(unknown)"}`);
      }

      console.log("[image:route] telegram proxy begin", { productId: id, tgFileId: im.tgFileId });
      const meta = await fetch(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(im.tgFileId)}`
      );
      const metaJson: any = await meta.json().catch(() => null);
      if (!metaJson?.ok || !metaJson?.result?.file_path) {
        console.error("[image:route] getFile failed", { productId: id, meta: metaJson });
        return res.status(502).send(`Telegram getFile error`);
      }

      const fileUrl = `https://api.telegram.org/file/bot${botToken}/${metaJson.result.file_path}`;
      const tgResp = await fetch(fileUrl);
      if (!tgResp.ok) {
        const t = await tgResp.text();
        console.error("[image:route] telegram fetch failed", { productId: id, status: tgResp.status, body: t.slice(0, 200) });
        return res.status(502).send(`Telegram file fetch ${tgResp.status}`);
      }

      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("Content-Type", tgResp.headers.get("content-type") ?? "image/jpeg");

      const body: any = tgResp.body;
      if (body && typeof (Readable as any).fromWeb === "function") {
        console.log("[image:route] telegram stream (fromWeb)", { productId: id });
        return (Readable as any).fromWeb(body).pipe(res);
      }

      const buf = Buffer.from(await tgResp.arrayBuffer());
      res.setHeader("Content-Length", String(buf.length));
      console.log("[image:route] telegram stream (buffer)", { productId: id, bytes: buf.length });
      return res.end(buf);
    }

    console.warn("[image:route] unsupported image source", { productId: id, im });
    return res.status(400).send("Unsupported image source");
  } catch (err: any) {
    console.error("[image:route] error", { productId: id, err: err?.message, stack: err?.stack });
    return res.status(500).send(`image proxy error: ${err?.message ?? String(err)}`);
  }
});

// ---------- Cart ----------
api.get('/cart', async (req: any, res) => {
  const userId = req.userId!;
  const cart = await CartService.list(userId);
  res.json(cart || { id: null, userId, items: [] });
});

api.post('/cart/items', async (req: any, res) => {
  const userId = req.userId!;
  const { productId, qty } = req.body || {};
  if (!productId) return res.status(400).json({ error: 'productId required' });
  await CartService.add(userId, String(productId), int(qty, 1));
  const cart = await CartService.list(userId);
  res.json(cart);
});

api.patch('/cart/items/:id', async (req: any, res) => {
  const itemId = String(req.params.id);
  const { qtyDelta } = req.body || {};
  if (!qtyDelta || !Number.isInteger(qtyDelta)) return res.status(400).json({ error: 'qtyDelta required (int)' });

  if (qtyDelta > 0) {
    await CartService.inc(itemId);
  } else {
    // apply |qtyDelta| times dec() — simple & safe
    for (let i = 0; i < Math.abs(qtyDelta); i++) await CartService.dec(itemId);
  }
  res.json({ ok: true });
});

api.delete('/cart/items/:id', async (req: any, res) => {
  const userId = req.userId!;
  const itemId = String(req.params.id);

  // Ensure item belongs to the user's cart before deleting
  const item = await db.cartItem.findFirst({
    where: { id: itemId, cart: { userId } },
    select: { id: true },
  });

  if (!item) return res.status(404).json({ error: 'not found' });

  await db.cartItem.delete({ where: { id: itemId } });
  res.json({ ok: true });
});


// ---------- Checkout / Buy Now ----------
api.post('/checkout', async (req: any, res) => {
  const userId = req.userId!;
  const { shippingAddress, note } = req.body || {};
  try {
    const order = await OrdersService.checkoutFromCartWithDetails(userId, { shippingAddress, note });
    res.json(order);
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'checkout failed' });
  }
});

// Single-item flow but same validations live in OrdersService
api.post('/buy-now', async (req: any, res) => {
  const userId = req.userId!;
  const { productId, shippingAddress, note } = req.body || {};
  if (!productId) return res.status(400).json({ error: 'productId required' });
  const p = await db.product.findUnique({ where: { id: String(productId) } });
  if (!p || !p.active) return res.status(400).json({ error: 'product unavailable' });
  try {
    const order = await OrdersService.createSingleItemPending(
   userId,
   { id: p.id, title: p.title, price: p.price.toNumber(), currency: p.currency },
   { shippingAddress, note }
 );
    res.json(order);
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'buy-now failed' });
  }
});

// ---------- Orders ----------
api.get('/orders', async (req: any, res) => {
  const userId = req.userId!;
  const take = int(req.query.take, 20);
  const orders = await OrdersService.listUserOrders(userId, take);
  res.json(orders);
});

api.get('/orders/:id', async (req: any, res) => {
  const userId = req.userId!;
  const id = String(req.params.id);
  const order = await db.order.findUnique({ where: { id, userId }, include: { items: true } });
  if (!order) return res.status(404).json({ error: 'not found' });
  res.json(order);
});

// ---------- Profile ----------
api.get('/profile', async (req: any, res) => {
  const userId = req.userId!;
  const u = await db.user.findUnique({ where: { tgId: userId } });
  res.json({
    tgId: userId,
    username: u?.username ?? null,
    name: u?.name ?? null,
    phone: u?.phone ?? null
  });
});

api.put('/profile', async (req: any, res) => {
  const userId = req.userId!;
  const { phone, name, username } = req.body || {};
  const u = await db.user.upsert({
    where: { tgId: userId },
    update: { phone, name, username },
    create: { tgId: userId, phone, name, username },
  });
  res.json(u);
});

