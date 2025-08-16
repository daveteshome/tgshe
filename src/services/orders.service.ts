import { db } from '../lib/db';

const FULFILLMENT = new Set(['confirmed', 'shipped', 'delivered']);

const ALLOWED: Record<string, string[]> = {
  pending:   ['confirmed', 'canceled', 'shipped', 'delivered'],
  confirmed: ['shipped', 'canceled'],
  shipped:   ['delivered', 'canceled'],
  delivered: [],
  canceled:  [],
};


export const OrdersService = {
  createSingleItemPending(tgId: string, product: { id: string; title: string; price: number; currency: string; }) {
    return db.order.create({
      data: {
        userId: tgId,
        total: product.price,
        currency: product.currency,
        status: 'pending',
        items: {
          create: [{ productId: product.id, title: product.title, price: product.price, qty: 1 }]
        }
      },
      include: { items: true }
    });
  },
  listUserOrders(tgId: string, take = 5) {
    return db.order.findMany({
      where: { userId: tgId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take,
    });
  },
  listByStatus(status: string | undefined, take = 10) {
  const where = status ? { status } : {};
  return db.order.findMany({
    where,
    include: { items: true, user: true }, // 👈 include user
    orderBy: { createdAt: 'desc' },
    take,
  });
},
  async setStatus(id: string, nextStatus: string) {
    // 1) Load order with items
    const order = await db.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new Error('Order not found');

    const current = order.status;

    // 2) Guard: is this transition allowed?
    const allowed = ALLOWED[current] || [];
    if (!allowed.includes(nextStatus)) {
      throw new Error(`Invalid transition: ${current} → ${nextStatus}`);
    }

    // 3) Decide if we must decrement stock now (first time entering any fulfillment state)
    const firstFulfillment =
      !FULFILLMENT.has(current) && FULFILLMENT.has(nextStatus);

    if (!firstFulfillment) {
      // Simple status update, no stock change
      return db.order.update({ where: { id }, data: { status: nextStatus } });
    }

    // 4) Atomic: check stock → decrement → update status
    return db.$transaction(async (tx) => {
      // Verify stock availability
      for (const it of order.items) {
        const p = await tx.product.findUnique({ where: { id: it.productId } });
        if (!p || !p.isActive) throw new Error(`Product unavailable: ${it.title}`);
        if (p.stock < it.qty) {
          throw new Error(`Insufficient stock for ${p.title} (have ${p.stock}, need ${it.qty})`);
        }
      }

      // Decrement stock once
      for (const it of order.items) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.qty } },
        });
      }

      // Update status
      return tx.order.update({ where: { id }, data: { status: nextStatus } });
    });
  },
  async checkoutFromCartWithDetails(userId: string, opts: { shippingAddress?: string | null; note?: string | null } = {}) {
    const cart = await db.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });
    if (!cart || cart.items.length === 0) throw new Error('Cart empty');

    for (const it of cart.items) {
      if (!it.product.isActive || it.product.stock < it.qty) {
        throw new Error(`Insufficient stock for ${it.product.title}`);
      }
    }

    const total = cart.items.reduce((s, it) => s + it.product.price * it.qty, 0);
    const currency = cart.items[0].product.currency;

    const order = await db.order.create({
      data: {
        userId,
        total,
        currency,
        status: 'pending',
        shippingAddress: opts.shippingAddress || null,
        notes: opts.note || null,
        items: {
          create: cart.items.map((it) => ({
            productId: it.productId,
            title: it.product.title,
            price: it.product.price,
            qty: it.qty,
          })),
        },
      },
      include: { items: true },
    });

    await db.cartItem.deleteMany({ where: { cartId: cart.id } });
    return order;
  },
};
