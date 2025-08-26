import React from "react";
import type { Category } from "./CategoryCard";
import { CategoryCard } from "./CategoryCard";

export function CategoryGrid({
  categories,
  activeId,
  onPick,
}: {
  categories: Category[];
  activeId: string;
  onPick: (id: string) => void;
}) {
  return (
    <div style={wrap}>
      {categories.map((c) => (
        <CategoryCard key={c.id} c={c} active={c.id === activeId} onClick={onPick} />
      ))}
    </div>
  );
}

const wrap: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
  gap: 12,
  padding: "10px 0 6px",
};
