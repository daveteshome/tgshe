import { Router } from "express";
import { db } from "../lib/db";
import { requireTenant } from "./_helpers";

export const productsRouter = Router();

productsRouter.get("/", async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);
    const q = (req.query.q as string) || "";
    const sort = (req.query.sort as string) || "newest"; // newest|price_asc|price_desc
    const limit = Math.min(parseInt((req.query.limit as string) || "24", 10), 48);
    const cursor = (req.query.cursor as string) || undefined;

    const orderBy =
      sort === "price_asc" ? [{ price: "asc" as const }, { id: "asc" as const }] :
      sort === "price_desc" ? [{ price: "desc" as const }, { id: "asc" as const }] :
      [{ createdAt: "desc" as const }, { id: "asc" as const }];

    const where = {
      tenantId,
      active: true,
      ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    };

    const items = await db.product.findMany({
      where,
      select: {
        id: true, title: true, price: true, currency: true, stock: true, active: true,
        images: { take: 1, orderBy: { position: "asc" as const }, select: { url: true } },
      },
      orderBy,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const hasNext = items.length > limit;
    if (hasNext) items.pop();

    const data = items.map(p => ({
      id: p.id,
      title: p.title,
      price: p.price.toString(),
      currency: p.currency,
      stock: p.stock,
      active: p.active,
      thumbUrl: p.images[0]?.url ?? null,
    }));

    res.json({ items: data, nextCursor: hasNext ? items[items.length - 1].id : null });
  } catch (e) { next(e); }
});

productsRouter.get("/:id", async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);
    const id = req.params.id;

    const p = await db.product.findFirst({
      where: { id, tenantId, active: true },
      include: {
        images: { orderBy: { position: "asc" } },
        variants: { orderBy: { name: "asc" } },
      },
    });
    if (!p) return res.status(404).json({ error: "Not found", code: "PRODUCT_NOT_FOUND" });

    res.json({
      id: p.id,
      title: p.title,
      description: p.description,
      sku: p.sku,
      price: p.price.toString(),
      currency: p.currency,
      stock: p.stock,
      active: p.active,
      images: p.images.map(i => ({ url: i.url, alt: i.alt })),
      variants: p.variants.map(v => ({
        id: v.id, name: v.name, priceDiff: v.priceDiff?.toString() ?? null, stock: v.stock, sku: v.sku ?? null
      })),
    });
  } catch (e) { next(e); }
});
