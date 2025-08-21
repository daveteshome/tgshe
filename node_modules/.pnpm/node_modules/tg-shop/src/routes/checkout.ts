import { Router } from "express";
import { db } from "../lib/db";
import { requireAuth, requireTenant, shortCode } from "./_helpers";
import { Prisma, InventoryMoveType, OrderStatus } from "@prisma/client";

export const checkoutRouter = Router();

checkoutRouter.post("/", async (req, res, next) => {
  const tx = await db.$transaction.bind(db);
  try {
    const tenantId = requireTenant(req);
    const tgId = requireAuth(req);

    const { address, note, payment } = (req.body ?? {}) as {
      address: { label?: string | null; line1: string; line2?: string | null; city: string; region?: string | null; country: string; postalCode?: string | null };
      note?: string | null;
      payment: { method: "COD" | "BANK"; ref?: string | null };
    };

    if (!address?.line1 || !address?.city || !address?.country) {
      return res.status(422).json({ error: "Invalid address", code: "ADDRESS_INVALID" });
    }

    const cart = await db.cart.findUnique({
      where: { tenantId_userId: { tenantId, userId: tgId } },
      select: { id: true },
    });
    if (!cart) return res.status(400).json({ error: "Cart is empty", code: "CART_EMPTY" });

    // Load cart lines with pricing + stock
    const lines = await db.cartItem.findMany({
      where: { cartId: cart.id },
      include: {
        product: true,
        variant: true,
      },
    });
    if (lines.length === 0) return res.status(400).json({ error: "Cart is empty", code: "CART_EMPTY" });

    // Validate stock & compute totals
    for (const li of lines) {
      const stock = li.variantId ? li.variant!.stock : li.product.stock;
      if (li.quantity > stock) return res.status(409).json({ error: "Stock changed", code: "OUT_OF_STOCK" });
    }
    const currency = lines[0].currency;
    const total = lines.reduce((acc, li) => acc.add((li.unitPrice as unknown as Prisma.Decimal).mul(li.quantity)), new Prisma.Decimal(0));

    // Upsert address (by unique [tenantId, userId, label])
    const label = address.label ?? "Checkout";
    const addr = await db.address.upsert({
      where: { tenantId_userId_label: { tenantId, userId: tgId, label } },
      update: {
        line1: address.line1, line2: address.line2 ?? null, city: address.city,
        region: address.region ?? null, country: address.country, postalCode: address.postalCode ?? null, isDefault: true,
      },
      create: {
        tenantId, userId: tgId, label,
        line1: address.line1, line2: address.line2 ?? null, city: address.city,
        region: address.region ?? null, country: address.country, postalCode: address.postalCode ?? null, isDefault: true,
      },
    });

    const result = await db.$transaction(async (prisma) => {
      // Create order
      const order = await prisma.order.create({
        data: {
          tenantId, userId: tgId,
          status: OrderStatus.pending,
          total, currency,
          addressId: addr.id,
          note: note ?? null,
          shortCode: null,
        },
      });

      // Items
      await prisma.orderItem.createMany({
        data: lines.map(li => ({
          tenantId,
          orderId: order.id,
          productId: li.productId,
          variantId: li.variantId ?? null,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          currency: li.currency,
          titleSnapshot: li.product.title,
          variantSnapshot: li.variant?.name ?? null,
        })),
      });

      // Inventory moves + stock decrement
      for (const li of lines) {
        await prisma.inventoryMove.create({
          data: {
            tenantId,
            productId: li.productId,
            kind: InventoryMoveType.OUT,
            quantity: li.quantity,
            reason: `order:${order.id}`,
          },
        });

        if (li.variantId) {
          await prisma.productVariant.update({ where: { id: li.variantId }, data: { stock: { decrement: li.quantity } } });
        } else {
          await prisma.product.update({ where: { id: li.productId }, data: { stock: { decrement: li.quantity } } });
        }
      }

      // Clear cart
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

      // Short code
      const sc = shortCode(order.id);
      const updated = await prisma.order.update({ where: { id: order.id }, data: { shortCode: sc } });

      return updated;
    });

    // Later: if BANK and `payment.ref` given, you can attach to PaymentIntent/TenantPayment as meta

    res.json({
      orderId: result.id,
      shortCode: result.shortCode,
      status: result.status,
      total: result.total.toString(),
      currency,
    });
  } catch (e) { next(e); }
});
