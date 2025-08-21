import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, requireTenant } from "./_helpers";

export const ordersRouter = Router();

ordersRouter.get("/", async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);
    const tgId = requireAuth(req);
    const limit = Math.min(parseInt((req.query.limit as string) || "20", 10), 50);
    const cursor = (req.query.cursor as string) || undefined;

    const rows = await db.order.findMany({
      where: { tenantId, userId: tgId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, shortCode: true, status: true, total: true, currency: true, createdAt: true },
    });

    const hasNext = rows.length > limit;
    if (hasNext) rows.pop();

    res.json({
      items: rows.map(r => ({
        id: r.id,
        shortCode: r.shortCode,
        status: r.status,
        total: r.total.toString(),
        currency: r.currency,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor: hasNext ? rows[rows.length - 1].id : null,
    });
  } catch (e) { next(e); }
});

ordersRouter.get("/:id", async (req, res, next) => {
  try {
    const tenantId = requireTenant(req);
    const tgId = requireAuth(req);
    const id = req.params.id;

    const order = await db.order.findFirst({
      where: { id, tenantId, userId: tgId },
      include: {
        items: { orderBy: { id: "asc" } },
        address: true,
      },
    });
    if (!order) return res.status(404).json({ error: "Not found", code: "ORDER_NOT_FOUND" });

    res.json({
      id: order.id,
      shortCode: order.shortCode,
      status: order.status,
      total: order.total.toString(),
      currency: order.currency,
      note: order.note,
      createdAt: order.createdAt.toISOString(),
      address: order.address && {
        label: order.address.label,
        line1: order.address.line1,
        line2: order.address.line2,
        city: order.address.city,
        region: order.address.region,
        country: order.address.country,
        postalCode: order.address.postalCode,
      },
      items: order.items.map(it => ({
        productId: it.productId,
        variantId: it.variantId,
        title: it.titleSnapshot,
        variant: it.variantSnapshot,
        quantity: it.quantity,
        unitPrice: it.unitPrice.toString(),
        currency: it.currency,
      })),
    });
  } catch (e) { next(e); }
});
