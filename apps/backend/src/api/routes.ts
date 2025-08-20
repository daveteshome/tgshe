// apps/backend/src/server/routes.ts
import { Router } from 'express';
import { telegramAuth } from '../api/telegramAuth';
import { CatalogService } from '../services/catalog.service';
import { CartService } from '../services/cart.service';
import { OrdersService } from '../services/orders.service';
import { db } from '../lib/db';
import { ENV } from '../config/env';
import crypto from "crypto";

export const api = Router();

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

// -------- AUTH GUARD --------
api.use(telegramAuth);

// ---------- Catalog ----------
api.get('/categories', async (_req, res) => {
  const cats = await CatalogService.listCategories();
  res.json(cats);
});

api.get('/products', async (req: any, res) => {
  const categoryId = String(req.query.category || '');
  const page = int(req.query.page, 1);
  const perPage = Math.min(Math.max(int(req.query.perPage, 12), 1), 50);
  if (!categoryId) return res.status(400).json({ error: 'category is required' });
  const { items, total, pages } = await CatalogService.listProductsByCategoryPaged(categoryId, page, perPage);
  res.json({ items, total, pages, page, perPage });
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
  if (!p || !p.isActive) return res.status(400).json({ error: 'product unavailable' });
  try {
    const order = await OrdersService.createSingleItemPending(userId, { id: p.id, title: p.title, price: p.price, currency: p.currency }, { shippingAddress, note });
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
    phone: u?.phone ?? null,
    city: u?.city ?? null,
    place: u?.place ?? null,
    specialReference: u?.specialReference ?? null,
  });
});

api.put('/profile', async (req: any, res) => {
  const userId = req.userId!;
  const { phone, city, place, specialReference } = req.body || {};
  const u = await db.user.upsert({
    where: { tgId: userId },
    update: { phone, city, place, specialReference },
    create: { tgId: userId, phone, city, place, specialReference },
  });
  res.json(u);
});

