import React from "react";
import type { Product } from "../../lib/types";
import { ProductCard } from "./ProductCard";

export function ProductGrid({
  products,
  onAdd, // (p) => Promise<void>
}: {
  products: Product[];
  onAdd: (p: Product) => Promise<void>;
}) {
  return (
    <div style={grid}>
      {products.map((p) => (
        <ProductCard key={p.id} p={p} onAdd={onAdd} />
      ))}
    </div>
  );
}

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 12,
};
