import { db } from '../lib/db';
import { Prisma, OrderStatus } from '@prisma/client';
import { getTenantId } from './tenant.util';

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  pending:   [OrderStatus.paid, OrderStatus.cancelled, OrderStatus.shipped],
  paid:      [OrderStatus.shipped, OrderStatus.cancelled],
  shipped:   [OrderStatus.completed, OrderStatus.cancelled],
  completed: [],
  cancelled: [],
};

export const OrdersService = {
  async createSingleItemPending(
    tgId: string,
    product: { id: string; title: string; price: number | string | Prisma.Decimal; currency: string },
    opts: { shippingAddress?: string | null; note?: string | null } = {}
  ) {
    const tenantId = await getTenantId();

    // Load product to confirm it belongs to tenant and is active
    const p = await db.product.findFirst({ where: { id: product.id, tenantId, active: true } });
    if (!p) throw new Error('product unavailable');

    const unitPrice = new Prisma.Decimal(product.price);
    const total = unitPrice; // qty=1

    return db.order.create({
      data: {
        tenantId,
        userId: tgId,
        total,
        currency: p.currency,
        status: OrderStatus.pending,
        addressId: null,                 // not capturing address here
        note: opts.note ?? null,         // store note in `note`
        items: {
          create: [{
            tenantId,
            productId: p.id,
            variantId: null,
            quantity: 1,
            unitPrice,
            currency: p.currency,
            titleSnapshot: p.title,
            variantSnapshot: null,
          }],
        },
        shortCode: null,
      },
      include: { items: true },
    });
  },

  async listUserOrders(tgId: string, take = 5) {
    const tenantId = await getTenantId();
    return db.order.findMany({
      where: { tenantId, userId: tgId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take,
    });
  },

  async listByStatus(status: string | undefined, take = 10) {
    const tenantId = await getTenantId();
    const where: any = { tenantId };
    if (status) where.status = status as OrderStatus;
    return db.order.findMany({
      where,
      include: { items: true, user: true },
      orderBy: { createdAt: 'desc' },
      take,
    });
  },

  async setStatus(id: string, nextStatus: OrderStatus) {
    const tenantId = await getTenantId();

    const order = await db.order.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!order) throw new Error('Order not found');

    const current = order.status as OrderStatus;
    const allowed = ALLOWED[current] || [];
    if (!allowed.includes(nextStatus)) {
      throw new Error(`Invalid transition: ${current} → ${nextStatus}`);
    }

    // Stock changes are handled at checkout in the new flow.
    return db.order.update({ where: { id }, data: { status: nextStatus } });
  },

  async checkoutFromCartWithDetails(userId: string, opts: { shippingAddress?: string | null; note?: string | null } = {}) {
    const tenantId = await getTenantId();
    const cart = await db.cart.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      include: { items: { include: { product: true, variant: true } } },
    });
    if (!cart || cart.items.length === 0) throw new Error('Cart empty');

    for (const it of cart.items) {
      if (!it.product.active) throw new Error(`Product unavailable: ${it.product.title}`);
      const stock = it.variantId ? it.variant!.stock : it.product.stock;
      if (stock < it.quantity) throw new Error(`Insufficient stock for ${it.product.title}`);
    }

    const currency = cart.items[0].product.currency;
    const total = cart.items.reduce(
      (s, it) => s.add((it.unitPrice as unknown as Prisma.Decimal).mul(it.quantity)),
      new Prisma.Decimal(0)
    );

    const order = await db.order.create({
      data: {
        tenantId,
        userId,
        total,
        currency,
        status: OrderStatus.pending,
        addressId: null,            // not capturing address here
        note: opts.note ?? null,
        items: {
          create: cart.items.map((it) => ({
            tenantId,
            productId: it.productId,
            variantId: it.variantId ?? null,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            currency: it.currency,
            titleSnapshot: it.product.title,
            variantSnapshot: it.variant?.name ?? null,
          })),
        },
      },
      include: { items: true },
    });

    await db.cartItem.deleteMany({ where: { cartId: cart.id } });
    return order;
  },
};
