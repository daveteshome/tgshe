import { db } from '../lib/db';
import { Prisma } from '@prisma/client';
import { getTenantId } from './tenant.util';

export const CartService = {
  async list(userId: string) {
    const tenantId = await getTenantId();

    const cart = await db.cart.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      include: {
        items: {
          include: {
            product: {
              select: {
                title: true,
                images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
              },
            },
            variant: { select: { name: true } },
          },
        },
      },
    });

    if (!cart) return null;

    return {
      id: cart.id,
      userId,
      items: cart.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        qty: it.quantity,
        price:
          typeof (it.unitPrice as any)?.toNumber === 'function'
            ? (it.unitPrice as unknown as Prisma.Decimal).toNumber()
            : Number(it.unitPrice),
        currency: String(it.currency),
        title: it.product.title,
        imageUrl: it.product.images[0]?.url ?? null,
      })),
    };
  },

  async add(userId: string, productId: string, qty: number) {
    const tenantId = await getTenantId();
    const product = await db.product.findFirst({ where: { id: productId, tenantId, active: true } });
    if (!product) throw new Error('product unavailable');

    const cart = await db.cart.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      update: {},
      create: { tenantId, userId },
    });

    const existing = await db.cartItem.findFirst({ where: { cartId: cart.id, productId } });
    if (existing) {
      await db.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + Math.max(1, qty) },
      });
    } else {
      await db.cartItem.create({
        data: {
          tenantId,
          cartId: cart.id,
          productId,
          quantity: Math.max(1, qty),
          unitPrice: product.price,
          currency: product.currency,
        },
      });
    }
    return this.list(userId);
  },

  async inc(itemId: string) {
    const it = await db.cartItem.findUnique({ where: { id: itemId } });
    if (!it) return null;
    return db.cartItem.update({ where: { id: itemId }, data: { quantity: it.quantity + 1 } });
  },

  async dec(itemId: string) {
    const it = await db.cartItem.findUnique({ where: { id: itemId } });
    if (!it) return null;
    if (it.quantity <= 1) { await db.cartItem.delete({ where: { id: itemId } }); return null; }
    return db.cartItem.update({ where: { id: itemId }, data: { quantity: it.quantity - 1 } });
  },

  async clear(userId: string) {
    const tenantId = await getTenantId();
    const cart = await db.cart.findUnique({ where: { tenantId_userId: { tenantId, userId } } });
    if (!cart) return;
    await db.cartItem.deleteMany({ where: { cartId: cart.id } });
  },
};
