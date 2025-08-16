import { db } from '../lib/db';

export const CartService = {
  async getOrCreate(userId: string) {
    let cart = await db.cart.findUnique({ where: { userId } });
    if (!cart) cart = await db.cart.create({ data: { userId } });
    return cart;
  },

  async add(userId: string, productId: string, qty = 1) {
    const cart = await this.getOrCreate(userId);
    const existing = await db.cartItem.findFirst({ where: { cartId: cart.id, productId } });
    if (existing) {
      return db.cartItem.update({ where: { id: existing.id }, data: { qty: existing.qty + qty } });
    }
    return db.cartItem.create({ data: { cartId: cart.id, productId, qty } });
  },

  async list(userId: string) {
    return db.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });
  },

  async inc(itemId: string) {
    const it = await db.cartItem.findUnique({ where: { id: itemId } });
    if (!it) return null;
    return db.cartItem.update({ where: { id: itemId }, data: { qty: it.qty + 1 } });
  },

  async dec(itemId: string) {
    const it = await db.cartItem.findUnique({ where: { id: itemId } });
    if (!it) return null;
    if (it.qty <= 1) { await db.cartItem.delete({ where: { id: itemId } }); return null; }
    return db.cartItem.update({ where: { id: itemId }, data: { qty: it.qty - 1 } });
  },

  async clear(userId: string) {
    const cart = await this.getOrCreate(userId);
    await db.cartItem.deleteMany({ where: { cartId: cart.id } });
  },
};
