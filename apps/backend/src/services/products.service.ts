import { db } from "../lib/db";
import { Currency, Prisma } from "@prisma/client";
import { getTenantId } from "./tenant.util";
import { firstImageWebUrl } from "./image.resolve";

/** -------- helpers -------- */
function toNumber(v: any, fallback = 0) {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeCurrency(c?: string | Currency): Currency {
  const fallback = String(process.env.DEFAULT_CURRENCY || "ETB").toUpperCase();
  const code = (c ? String(c) : fallback).toUpperCase() as Currency;
  return (Object.values(Currency) as string[]).includes(code)
    ? code
    : (fallback as Currency);
}

/** DB row -> DTO (without photo yet) */
function toProductDTOBase(p: any) {
  return {
    id: p.id,
    tenantId: p.tenantId,
    title: p.title,
    description: p.description ?? null,
    price: toNumber(p.price),
    currency: p.currency as Currency,
    stock: p.stock,
    active: p.active,
    // IMPORTANT: do not leak legacy url; resolve below
    photoUrl: null as string | null,
    // handy for frontend to always have a backend image route
    apiImage: `/api/products/${p.id}/image`,
    categoryId: p.categoryId ?? null,
  };
}

// attach resolved photoUrl via resolver (TG / R2 / legacy -> public URL)
async function hydratePhoto(dto: ReturnType<typeof toProductDTOBase>) {
  try {
    dto.photoUrl = await firstImageWebUrl(dto.id);
  } catch (e) {
    // keep null if resolution fails
    dto.photoUrl = null;
  }
  return dto;
}

type ListOpts = {
  page?: number;
  perPage?: number;
  search?: string;
  categoryId?: string;
  includeInactive?: boolean;
};

export const ProductsService = {
  /** Paged listing for a given tenant (kept for REST routes) */
  async listPaged(tenantId: string, opts: ListOpts = {}) {
    const page = Math.max(1, Number(opts.page ?? 1));
    const perPage = Math.min(100, Math.max(1, Number(opts.perPage ?? 12)));

    const where: Prisma.ProductWhereInput = {
      tenantId,
      ...(opts.includeInactive ? {} : { active: true }),
      ...(opts.search
        ? { title: { contains: opts.search, mode: "insensitive" } }
        : {}),
      ...(opts.categoryId && opts.categoryId !== "all"
        ? { categoryId: opts.categoryId }
        : {}),
    };

    const total = await db.product.count({ where });
    const rows = await db.product.findMany({
      where,
      orderBy: [{ title: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      // we do not need url here; resolver will handle reading source
      include: { images: { orderBy: { position: "asc" }, take: 1, select: { id: true } } },
    });

    const itemsBase = rows.map(toProductDTOBase);
    const items = await Promise.all(itemsBase.map(hydratePhoto));

    return {
      items,
      total,
      pages: Math.max(1, Math.ceil(total / perPage)),
      page,
      perPage,
    };
  },

  /** Old: list(...) — accepts page/perPage like before */
  async list(opts: ListOpts = {}) {
    const tenantId = await getTenantId();
    if (opts.page != null || opts.perPage != null) {
      const { items } = await this.listPaged(tenantId, opts);
      return items;
    }

    const where: Prisma.ProductWhereInput = {
      tenantId,
      ...(opts.includeInactive ? {} : { active: true }),
      ...(opts.search
        ? { title: { contains: opts.search, mode: "insensitive" } }
        : {}),
      ...(opts.categoryId && opts.categoryId !== "all"
        ? { categoryId: opts.categoryId }
        : {}),
    };

    const rows = await db.product.findMany({
      where,
      orderBy: [{ title: "asc" }],
      include: { images: { orderBy: { position: "asc" }, take: 1, select: { id: true } } },
    });
    const itemsBase = rows.map(toProductDTOBase);
    return Promise.all(itemsBase.map(hydratePhoto));
  },

  /** Old: count(...) */
  async count(opts: Omit<ListOpts, "page" | "perPage"> = {}) {
    const tenantId = await getTenantId();
    const where: Prisma.ProductWhereInput = {
      tenantId,
      ...(opts.includeInactive ? {} : { active: true }),
      ...(opts.search
        ? { title: { contains: opts.search, mode: "insensitive" } }
        : {}),
      ...(opts.categoryId && opts.categoryId !== "all"
        ? { categoryId: opts.categoryId }
        : {}),
    };
    return db.product.count({ where });
  },

  /** Old: get(id) */
  async get(id: string) {
    const tenantId = await getTenantId();
    const p = await db.product.findFirst({
      where: { id, tenantId },
      include: { images: { orderBy: { position: "asc" }, take: 4, select: { id: true } } },
    });
    if (!p) return null;
    const dto = toProductDTOBase(p);
    return hydratePhoto(dto);
  },

  /** create(...) */
  async create(
    dataOrTenantId:
      | {
          title: string;
          description?: string | null;
          sku?: string | null;
          price: number | string;
          currency?: string | Currency;
          stock?: number | string;
          categoryId?: string | null;
          active?: boolean;
        }
      | string,
    maybeData?: {
      title: string;
      description?: string | null;
      sku?: string | null;
      price: number | string;
      currency?: string | Currency;
      stock?: number | string;
      categoryId?: string | null;
      active?: boolean;
    }
  ) {
    let tenantId: string;
    let data:
      | {
          title: string;
          description?: string | null;
          sku?: string | null;
          price: number | string;
          currency?: string | Currency;
          stock?: number | string;
          categoryId?: string | null;
          active?: boolean;
        }
      | undefined;

    if (typeof dataOrTenantId === "string") {
      tenantId = dataOrTenantId;
      data = maybeData!;
    } else {
      tenantId = await getTenantId();
      data = dataOrTenantId;
    }

    const createData: Prisma.ProductCreateInput = {
      tenant: { connect: { id: tenantId } },
      title: data.title.trim(),
      description: data.description ?? null,
      sku: data.sku ?? null,
      price: toNumber(data.price),
      currency: normalizeCurrency(data.currency),
      stock: toNumber(data.stock ?? 0),
      active: data.active ?? true,
      ...(data.categoryId ? { category: { connect: { id: data.categoryId } } } : {}),
    };

    const created = await db.product.create({
      data: createData,
      include: { images: { orderBy: { position: "asc" }, take: 1, select: { id: true } } },
    });

    return hydratePhoto(toProductDTOBase(created));
  },

  /** update(id, data) */
  async update(
    id: string,
    data: {
      title?: string;
      description?: string | null;
      sku?: string | null;
      price?: number | string;
      currency?: string | Currency;
      stock?: number | string;
      categoryId?: string | null;
      active?: boolean;
    }
  ) {
    const tenantId = await getTenantId();

    const upd: Prisma.ProductUpdateInput = {};
    if (data.title != null) upd.title = data.title.trim();
    if (data.description !== undefined) upd.description = data.description;
    if (data.sku !== undefined) upd.sku = data.sku;
    if (data.price !== undefined) upd.price = toNumber(data.price);
    if (data.currency !== undefined) upd.currency = normalizeCurrency(data.currency);
    if (data.stock !== undefined) upd.stock = toNumber(data.stock);
    if (data.active !== undefined) upd.active = !!data.active;

    if (data.categoryId !== undefined) {
      upd.category =
        data.categoryId === null
          ? { disconnect: true }
          : { connect: { id: data.categoryId } };
    }

    const { count } = await db.product.updateMany({
      where: { id, tenantId },
      data: upd,
    });
    if (count === 0) throw new Error("Product not found or not in tenant");

    const p = await db.product.findUnique({
      where: { id },
      include: { images: { orderBy: { position: "asc" }, take: 1, select: { id: true } } },
    });
    if (!p) throw new Error("Product disappeared after update");

    return hydratePhoto(toProductDTOBase(p));
  },

  async setActive(id: string, active: boolean) {
    const tenantId = await getTenantId();
    const { count } = await db.product.updateMany({
      where: { id, tenantId },
      data: { active: !!active },
    });
    if (count === 0) throw new Error("Product not found or not in tenant");

    const p = await db.product.findUnique({
      where: { id },
      include: { images: { orderBy: { position: "asc" }, take: 1, select: { id: true } } },
    });
    if (!p) throw new Error("Product disappeared after setActive");

    return hydratePhoto(toProductDTOBase(p));
  },

  async delete(id: string) {
    const tenantId = await getTenantId();
    const { count } = await db.product.deleteMany({ where: { id, tenantId } });
    if (count === 0) throw new Error("Product not found or not in tenant");
    return { id };
  },
};
