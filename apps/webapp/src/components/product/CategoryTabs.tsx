import React from "react";
import type { Category } from "../../lib/types";

export function CategoryTabs({
  categories,
  activeId,
  onChange,
}: {
  categories: Category[];
  activeId: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div style={wrap}>
      {categories.map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          style={activeId === c.id ? tabActive : tab}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

const wrap: React.CSSProperties = { display: "flex", gap: 8, overflowX: "auto", padding: "8px 2px" };
const tab: React.CSSProperties = { border: "1px solid rgba(0,0,0,.12)", background: "transparent", padding: "6px 10px", borderRadius: 10 };
const tabActive: React.CSSProperties = { ...tab, border: "1px solid rgba(0,0,0,.2)", background: "rgba(0,0,0,.06)", fontWeight: 700 };
