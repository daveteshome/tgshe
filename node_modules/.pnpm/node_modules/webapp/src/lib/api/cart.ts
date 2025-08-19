import { api } from "./index";
import type { Cart } from "../types";

export function getCart(): Promise<Cart> {
  return api<Cart>("/cart");
}

export function addItem(productId: string, qty = 1): Promise<Cart> {
  return api<Cart>("/cart/items", { method: "POST", body: JSON.stringify({ productId, qty }) });
}

export function patchItem(itemId: string, qtyDelta: number): Promise<{ ok: true }> {
  return api<{ ok: true }>(`/cart/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ qtyDelta }) });
}

export function removeItem(itemId: string): Promise<{ ok: true }> {
  return api<{ ok: true }>(`/cart/items/${itemId}`, { method: "DELETE" });
}