import { db } from '../lib/db';

export const CatalogService = {
  listCategories() {
    return db.category.findMany({ orderBy: { name: 'asc' } });
  },
  listProductsByCategory(categoryId: string) {
    return db.product.findMany({
      where: { categoryId, isActive: true },
      orderBy: { title: 'asc' },
    });
  },
  getProduct(id: string) {
    return db.product.findUnique({ where: { id } });
  },
};
