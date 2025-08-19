import { api } from "./index";
import type { Category, PagedProducts } from "../types";
import { DEFAULT_PER_PAGE } from "../constants";

export function getCategories(): Promise<Category[]> {
  return api<Category[]>("/categories");
}

export function getProducts(categoryId: string, page = 1, perPage = DEFAULT_PER_PAGE): Promise<PagedProducts> {
  const params = new URLSearchParams({
    category: categoryId,
    page: String(page),
    perPage: String(perPage),
  });
  return api<PagedProducts>(`/products?${params.toString()}`);
}