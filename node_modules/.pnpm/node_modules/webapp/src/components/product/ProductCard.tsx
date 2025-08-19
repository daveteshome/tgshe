import React from "react";
import type { Product } from "../../lib/types";
import { money } from "../../lib/format";

export function ProductCard({ p, onAdd }: { p: Product; onAdd: (p: Product) => void }) {
  return (
    <div style={styles.card}>
      <div style={styles.thumbWrap}>
        {p.photoUrl ? (
          <img src={p.photoUrl} alt={p.title} style={styles.thumb} />
        ) : (
          <div style={styles.thumbPlaceholder}>No image</div>
        )}
        {!p.isActive && <span style={styles.badge}>Inactive</span>}
      </div>
      <div style={{ padding: 10 }}>
        <div style={styles.title}>{p.title}</div>
        {p.description && <div style={styles.desc}>{p.description}</div>}
        <div style={styles.row}>
          <span>{money(p.price, p.currency)}</span>
          <span style={{ opacity: 0.7 }}>{p.stock} in stock</span>
        </div>
        <button
          style={styles.primaryBtn}
          disabled={!p.isActive || p.stock <= 0}
          onClick={() => onAdd(p)}
        >
          {p.stock > 0 ? "Add to cart" : "Out of stock"}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { border: "1px solid rgba(0,0,0,.08)", borderRadius: 12, overflow: "hidden", background: "var(--tg-theme-bg-color, #fff)" },
  thumbWrap: { position: "relative", aspectRatio: "1 / 1", background: "#f2f2f2" },
  thumb: { width: "100%", height: "100%", objectFit: "cover" },
  thumbPlaceholder: { display: "grid", placeItems: "center", height: "100%", color: "#999" },
  badge: { position: "absolute", top: 8, left: 8, background: "#111", color: "#fff", fontSize: 12, padding: "2px 6px", borderRadius: 8 },
  title: { fontWeight: 700, marginBottom: 6 },
  desc: { fontSize: 13, opacity: 0.8, marginBottom: 8 },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 },
  primaryBtn: { border: "none", background: "var(--tg-theme-button-color, #2481cc)", color: "var(--tg-theme-button-text-color, #fff)", padding: "10px 12px", borderRadius: 10, width: "100%", marginTop: 8 },
};
