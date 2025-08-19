import { api } from "./index";
import type { Order } from "../types";

export function listOrders(take = 20): Promise<Order[]> {
  const qp = new URLSearchParams({ take: String(take) });
  return api<Order[]>(`/orders?${qp.toString()}`);
}

export function getOrder(id: string): Promise<Order> {
  return api<Order>(`/orders/${id}`);
}

export function checkout(shippingAddress: string, note?: string): Promise<Order> {
  return api<Order>("/checkout", { method: "POST", body: JSON.stringify({ shippingAddress, note }) });
}