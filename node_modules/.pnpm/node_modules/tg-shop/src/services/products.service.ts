import { db } from '../lib/db';

export const ProductsService = {
  list({ page = 1, perPage = 5, search = '' as string, categoryId = undefined as string | undefined }) {
    const where: any = {};
    if (search) where.title = { contains: search, mode: 'insensitive' };
    if (categoryId) where.categoryId = categoryId;
    return db.product.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { title: 'asc' }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: { category: true },
    });
  },

  count({ search = '', categoryId = undefined as string | undefined }) {
    const where: any = {};
    if (search) where.title = { contains: search, mode: 'insensitive' };
    if (categoryId) where.categoryId = categoryId;
    return db.product.count({ where });
  },

  toggleActive(id: string) {
    return db.product.update({ where: { id }, data: { isActive: { set: undefined }, } })
      .catch(async () => {
        const p = await db.product.findUnique({ where: { id } });
        return db.product.update({ where: { id }, data: { isActive: !p?.isActive } });
      });
  },

  setActive(id: string, isActive: boolean) {
    return db.product.update({ where: { id }, data: { isActive } });
  },

  delete(id: string) {
    return db.product.delete({ where: { id } });
  },

  update(id: string, patch: Partial<{ title: string; price: number; stock: number; photoUrl: string | null; photoFileId: string | null; categoryId: string; description: string | null }>) {
    return db.product.update({ where: { id }, data: patch });
  },

  async create(data: { title: string; price: number; stock: number; photoUrl?: string | null; photoFileId?: string | null; description?: string | null; categoryId?: string | null; currency?: string }) {
   return db.product.create({ data: { currency: 'USD', ...data } });
  },

  listCategories() {
    return db.category.findMany({ orderBy: { name: 'asc' } });
  },

  upsertCategoryByName(name: string) {
    return db.category.upsert({ where: { name }, update: {}, create: { name } });
  },

  get(id: string) {
    return db.product.findUnique({ where: { id } });
  },
};
