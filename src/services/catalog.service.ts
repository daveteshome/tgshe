import { db } from '../lib/db';

export const CatalogService = {
  listCategories() {
    return db.category.findMany({ orderBy: { name: 'asc' } });
  },

  // existing unpaged (keep if you like)
  listProductsByCategory(categoryId: string) {
    return db.product.findMany({
      where: { categoryId, isActive: true },
      orderBy: [{ title: 'asc' }],
    });
  },

  // ✅ NEW: paged version
  async listProductsByCategoryPaged(categoryId: string, page = 1, perPage = 3) {
    const where: any = { categoryId, isActive: true };
    const [items, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: [{ title: 'asc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      db.product.count({ where }),
    ]);
    const pages = Math.max(1, Math.ceil(total / perPage));
    return { items, total, pages };
  },
};
