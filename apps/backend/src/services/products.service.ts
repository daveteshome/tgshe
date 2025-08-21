import { db } from '../lib/db';
import { Prisma } from '@prisma/client';
import { getTenantId } from './tenant.util';

export const ProductsService = {
  async list({ page = 1, perPage = 5, search = '' as string, categoryId = undefined as string | undefined }) {
    const tenantId = await getTenantId();
    const where: any = { tenantId };
    if (search) where.title = { contains: search, mode: 'insensitive' };
    // categoryId: not used in new schema; ignore for now
    return db.product.findMany({
      where,
      orderBy: [{ active: 'desc' }, { title: 'asc' }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: { images: { orderBy: { position: 'asc' }, take: 1 } },
    });
  },

  async count({ search = '', categoryId = undefined as string | undefined }) {
    const tenantId = await getTenantId();
    const where: any = { tenantId };
    if (search) where.title = { contains: search, mode: 'insensitive' };
    return db.product.count({ where });
  },

  async toggleActive(id: string) {
    const p = await db.product.findUnique({ where: { id } });
    if (!p) throw new Error('not found');
    return db.product.update({ where: { id }, data: { active: !p.active } });
  },

  setActive(id: string, active: boolean) {
    return db.product.update({ where: { id }, data: { active } });
  },

  delete(id: string) {
    return db.product.delete({ where: { id } });
  },

  update(
    id: string,
    patch: Partial<{ title: string; price: number; stock: number; description: string | null; active: boolean }>
  ) {
    const data: any = { ...patch };
    if (typeof patch.price !== 'undefined') data.price = new Prisma.Decimal(patch.price);
    return db.product.update({ where: { id }, data });
  },

  async create(data: { title: string; price: number; stock: number; description?: string | null; currency?: string }) {
    const tenantId = await getTenantId();
    return db.product.create({
      data: {
        tenantId,
        title: data.title,
        price: new Prisma.Decimal(data.price),
        stock: data.stock,
        description: data.description ?? null,
        currency: (data.currency as any) || 'ETB',
        active: true,
      },
    });
  },

  // Category helpers no longer applicable; keep stubs so callers don't break
  async listCategories() {
    return [{ id: 'all', name: 'All' }];
  },
  async upsertCategoryByName(_name: string) {
    return { id: 'all', name: 'All' };
  },

  get(id: string) {
    return db.product.findUnique({ where: { id }, include: { images: { orderBy: { position: 'asc' }, take: 4 } } });
  },
};
