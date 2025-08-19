import { useEffect, useState } from "react";
import type { Cart } from "./types";
import { getCart } from "./api/cart";

// Tiny global-ish store via hook pattern for cart count badge
let subscribers: ((n: number) => void)[] = [];
let cartCountInternal = 0;

export function setCartCount(n: number) {
  cartCountInternal = n;
  subscribers.forEach((fn) => fn(n));
}

export function useCartCount() {
  const [n, setN] = useState(cartCountInternal);
  useEffect(() => {
    subscribers.push(setN);
    return () => {
      subscribers = subscribers.filter((fn) => fn !== setN);
    };
  }, []);
  return n;
}

export async function refreshCartCount() {
  try {
    const cart: Cart = await getCart();
    setCartCount(cart.items.reduce((s, it) => s + it.qty, 0));
  } catch {
    // ignore
  }
}
