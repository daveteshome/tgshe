// apps/backend/src/services/catalog.service.ts
import { db } from '../lib/db';
import { getTenantId } from './tenant.util';


const CDN = process.env.CDN_IMAGE_BASE!; // e.g. https://...workers.dev/img

function photoFromImage(image: { bucketKeyBase: string } | null, w = 512) {
  return image ? `${CDN}/${image.bucketKeyBase}/orig?w=${w}&fmt=auto` : null;
}

function resolveImageForWeb(productId: string, ref?: string | null, version?: string) {
  if (!ref) return null;
  if (/^https?:\/\//i.test(ref)) return ref;
  if (/^tg:file_id:/i.test(ref)) return `/api/products/${productId}/image${version ? `?v=${version}` : ""}`;
  return null;
}

function toProductDTO(p: any) {
  const first = p.images?.[0]?.url ?? null;
  return {
    id: p.id,
    title: p.title,
    description: p.description ?? null,
    price: Number(p.price),
    currency: p.currency,
    stock: p.stock,
    active: p.active,
    photoUrl: photoFromImage(p.images[0]?.image ?? null, 512) || p.images[0]?.url || null,   // ← web-app friendly URL
    categoryId: p.categoryId ?? null,
  };
}

/** For admin and internal use: list active categories */
async function listCategoriesRaw() {
  const tenantId = await getTenantId();
  return db.category.findMany({
    where: { tenantId, active: true },
    orderBy: [{ position: 'asc' }, { title: 'asc' }],
    select: { id: true, title: true, slug: true, position: true, active: true },
  });
}

export const CatalogService = {
  /** Storefront: categories with virtual "All" first */
  async listCategories() {
    const cats = await listCategoriesRaw();
    return [{ id: 'all', title: 'All' }, ...cats.map(c => ({ id: c.id, title: c.title }))];
  },

  /** Admin: list active categories without "All" */
  async listActiveCategories() {
    const cats = await listCategoriesRaw();
    return cats.map(c => ({ id: c.id, title: c.title }));
  },

  /** Admin: create/find a category by title (tenant-safe) */
  async upsertCategoryByTitle(title: string) {
    const tenantId = await getTenantId();
    const clean = title.trim();
    const slug = clean.toLowerCase().replace(/\s+/g, '-').slice(0, 64);
    const existing = await db.category.findFirst({ where: { tenantId, slug } });
    if (existing) return { id: existing.id, title: existing.title };
    const created = await db.category.create({
      data: { tenantId, title: clean, slug },
      select: { id: true, title: true },
    });
    return created;
  },

  /** Storefront: paged products (optional category filter) */
  async listProductsByCategoryPaged(categoryId: string, page: number, perPage: number) {
    const tenantId = await getTenantId();
    const where: any = { tenantId, active: true };
    if (categoryId && categoryId !== 'all') where.categoryId = categoryId;

    const safePage = Math.max(1, Number(page || 1));
    const safePer = Math.max(1, Number(perPage || 12));

    const total = await db.product.count({ where });
    const items = await db.product.findMany({
      where,
      orderBy: [{ title: 'asc' }],
      skip: (safePage - 1) * safePer,
      take: safePer,
      include: { 
        images: { orderBy: { position: 'asc' }, take: 1, include: { image: true } } 
      },
    });

    return {
      items: items.map(toProductDTO),
      total,
      pages: Math.max(1, Math.ceil(total / safePer)),
      page: safePage,
      perPage: safePer,
    };
  },

  /** Storefront/Admin: non-paged list (optional category filter) */
  async listProductsByCategory(categoryId: string) {
    const tenantId = await getTenantId();
    const where: any = { tenantId, active: true };
    if (categoryId && categoryId !== 'all') where.categoryId = categoryId;

    const items = await db.product.findMany({
      where,
      orderBy: [{ title: 'asc' }],
      include: { images: { orderBy: { position: 'asc' }, take: 1 } },
    });

    return items.map(toProductDTO);
  },
};
