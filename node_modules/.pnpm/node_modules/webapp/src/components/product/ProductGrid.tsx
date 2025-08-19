import React from "react";
import type { Product } from "../../lib/types";
import { ProductCard } from "./ProductCard";

export function ProductGrid({ products, onAdd }: { products: Product[]; onAdd: (p: Product) => void }) {
  return (
    <div style={grid}>
      {products.map((p) => <ProductCard key={p.id} p={p} onAdd={onAdd} />)}
      {products.length === 0 && <div style={{ opacity: 0.7 }}>No products yet.</div>}
    </div>
  );
}

const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, padding: "10px 0" };
