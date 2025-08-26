import React, { useEffect, useMemo, useState } from "react";
import { CategoryGrid } from "../components/categories/CategoryGrid";
import type { Category } from "../components/categories/CategoryCard";
import { ProductGrid } from "../components/product/ProductGrid";
import type { Product } from "../lib/types";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function HomeTab() {
  const [cats, setCats] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string>("all");

  const [page, setPage] = useState(1);
  const [perPage] = useState(12);
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // fetch categories once
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/categories`);
        const data: Array<{ id: string; title: string; iconUrl?: string | null; emoji?: string | null }> =
          await res.json();

        // ensure we have an “All” category at the front
        const withAll: Category[] = [{ id: "all", title: "Trending", emoji: "🔥" }, ...data];
        setCats(withAll);
      } catch (e) {
        console.warn("[home] categories error", e);
        setCats([{ id: "all", title: "Trending", emoji: "🔥" }]);
      }
    })();
  }, []);

  // fetch products when category/page changes
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const url = new URL(`${API_BASE}/products`);
        url.searchParams.set("category", activeCat || "all");
        url.searchParams.set("page", String(page));
        url.searchParams.set("perPage", String(perPage));

        const res = await fetch(url.toString());
        const data: { items: Product[]; total: number; page: number; perPage: number } = await res.json();

        // append for pagination; replace when page=1
        setItems((prev) => (page === 1 ? data.items : [...prev, ...data.items]));
        setTotal(data.total ?? 0);
      } catch (e) {
        console.error("[home] products error", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeCat, page, perPage]);

  const canLoadMore = useMemo(() => items.length < total, [items.length, total]);

  function pickCategory(id: string) {
    setActiveCat(id);
    setPage(1);      // reset paging on category change
  }

  function addToCart(p: Product) {
    // keep as-is or call your existing /api/cart endpoint
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    console.log("[cart] add", p.id);
    // TODO: call your cart API; for now, just log
  }

  return (
    <div style={{ padding: "12px 14px 90px" }}>
      <div style={{ fontWeight: 800, marginBottom: 8, color: "var(--tg-theme-text-color, #111)" }}>
        Categories
      </div>
      <CategoryGrid categories={cats} activeId={activeCat} onPick={pickCategory} />

      <div style={{ fontWeight: 800, margin: "14px 0 8px", color: "var(--tg-theme-text-color, #111)" }}>
        {activeCat === "all"
          ? "Products"
          : `Products · ${cats.find((c) => c.id === activeCat)?.title || ""}`}
      </div>

      <ProductGrid products={items} onAdd={addToCart} />

      {loading && <div style={{ opacity: 0.6, padding: 10 }}>Loading…</div>}

      {!loading && canLoadMore && (
        <button
          onClick={() => setPage((p) => p + 1)}
          style={{
            border: "none",
            background: "var(--tg-theme-button-color, #2481cc)",
            color: "var(--tg-theme-button-text-color, #fff)",
            padding: "10px 12px",
            borderRadius: 10,
            width: "100%",
            marginTop: 10,
          }}
        >
          Load more
        </button>
      )}
    </div>
  );
}
