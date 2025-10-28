import React from "react";

export type UiCategory = { id: string; title: string };

export function CategoryPills({
  categories,
  activeId,
  onPick,
}: {
  categories: UiCategory[];
  activeId: string | null | undefined;
  onPick: (id: string) => void;
}) {
  return (
    <div style={wrap}>
      {categories.map((c) => {
        const active = c.id === activeId;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.id)}
            style={{ ...pill, ...(active ? pillActive : {}) }}
          >
            <span style={pillText}>{c.title}</span>
          </button>
        );
      })}
    </div>
  );
}

const wrap: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8 };
const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 9999,
  padding: "8px 12px",
  border: "1px solid var(--tg-theme-hint-color, #e5e5e5)",
  background: "var(--tg-theme-secondary-bg-color, #f6f6f6)",
  color: "var(--tg-theme-text-color, #111)",
  fontSize: 14,
  lineHeight: 1,
  whiteSpace: "nowrap",
  cursor: "pointer",
};
const pillActive: React.CSSProperties = {
  background: "var(--tg-theme-button-color, #2481cc)",
  color: "var(--tg-theme-button-text-color, #fff)",
  borderColor: "transparent",
};
const pillText: React.CSSProperties = { whiteSpace: "nowrap" };
