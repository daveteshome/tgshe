import { db } from '../lib/db';
import { getTenantId } from './tenant.util';

export const CatalogService = {
  // Provide a minimal "All" category so your bot UI keeps working
  async listCategories() {
    return [{ id: 'all', name: 'All' }];
  },

  async listProductsByCategoryPaged(categoryId: string, page: number, perPage: number) {
    const tenantId = await getTenantId();
    const where = { tenantId, active: true }; // ignore categoryId for now
    const total = await db.product.count({ where });
    const items = await db.product.findMany({
      where,
      orderBy: [{ title: 'asc' }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: { images: { orderBy: { position: 'asc' }, take: 1 } },
    });
    const pages = Math.max(1, Math.ceil(total / perPage));
    return { items, total, pages };
  },

  async listProductsByCategory(_categoryId: string) {
    const tenantId = await getTenantId();
    return db.product.findMany({
      where: { tenantId, active: true },
      orderBy: [{ title: 'asc' }],
      include: { images: { orderBy: { position: 'asc' }, take: 1 } },
    });
  },
};
