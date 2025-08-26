import React from "react";

export type Category = {
  id: string;
  title: string;
  // optional icon URL or emoji; both supported, both optional
  iconUrl?: string | null;
  emoji?: string | null;
};

export function CategoryCard({
  c,
  active,
  onClick,
}: {
  c: Category;
  active: boolean;
  onClick: (id: string) => void;
}) {
  // visible label (two-line clamp with ellipsis)
  return (
    <button
      onClick={() => onClick(c.id)}
      style={{
        ...styles.wrap,
        outline: active ? "2px solid var(--tg-theme-button-color, #2481cc)" : "1px solid rgba(0,0,0,.08)",
        background: "var(--tg-theme-bg-color, #fff)",
      }}
    >
      <div style={styles.iconTile}>
        {c.iconUrl ? (
          <img src={c.iconUrl} alt={c.title} style={styles.iconImg} />
        ) : (
          <span style={styles.iconEmoji}>{c.emoji || c.title.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div style={styles.title} title={c.title}>{c.title}</div>
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    padding: 10,
    cursor: "pointer",
  },
  iconTile: {
    width: 72,
    height: 72,
    borderRadius: 16,
    background: "rgba(0,0,0,.04)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  },
  iconImg: { width: "100%", height: "100%", objectFit: "cover" },
  iconEmoji: { fontSize: 30, lineHeight: "1", color: "var(--tg-theme-text-color, #111)" },
  title: {
    width: 88,
    textAlign: "center",
    fontSize: 13,
    color: "var(--tg-theme-text-color, #111)",   // ← makes sure it’s visible in dark/light
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
};
