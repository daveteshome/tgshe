import React, { useState } from "react";
import type { Product } from "../../lib/types";
import { money } from "../../lib/format";

const API_BASE = import.meta.env.VITE_API_BASE;

export function ProductCard({
  p,
  onAdd, // (p) => Promise<void>
}: {
  p: Product;
  onAdd: (p: Product) => Promise<void>;
}) {
  const imgSrc = `${API_BASE}/products/${p.id}/image`;
  console.log("[Card img]", `${API_BASE}/products/${p.id}/image`);

  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  // ✅ normalize active flag from either shape (`isActive` or `active`)
  const isActive = (p as any).isActive ?? (p as any).active ?? true;

  async function handleAdd() {
    if (adding) return;
    setAdding(true);
    try {
      await onAdd(p);
      setAdded(true);
      (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
      setTimeout(() => setAdded(false), 1000);
    } catch (e) {
      console.error("[cart] add failed", e);
      alert("Could not add to cart. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.thumbWrap}>
        <img
          src={imgSrc}
          alt={p.title}
          style={styles.thumb}
          loading="lazy"
          onError={(e) => {
            const el = e.currentTarget as HTMLImageElement;
            if ((p as any).photoUrl) {
              el.src = (p as any).photoUrl;
            } else {
              el.style.display = "none";
              const ph = el.nextElementSibling as HTMLElement | null;
              if (ph) ph.style.display = "grid";
            }
          }}
        />
        <div style={{ ...styles.thumbPlaceholder, display: "none" }}>No image</div>
        {/* ✅ use normalized flag */}
        {!isActive && <span style={styles.badge}>Inactive</span>}
      </div>

      <div style={{ padding: 10 }}>
        <div style={styles.title}>{p.title}</div>
        {p.description && <div style={styles.desc}>{p.description}</div>}
        <div style={styles.row}>
          <span>{money(p.price, p.currency)}</span>
          <span style={{ opacity: 0.7 }}>{(p.stock ?? 0)} in stock</span>
        </div>
        <button
          style={styles.primaryBtn}
          // ✅ use normalized flag
          disabled={adding || !isActive || (p.stock ?? 0) <= 0}
          onClick={handleAdd}
        >
          {adding ? "Adding…" : added ? "✓ Added" : (p.stock ?? 0) > 0 ? "Add to cart" : "Out of stock"}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { border: "1px solid rgba(0,0,0,.08)", borderRadius: 12, overflow: "hidden", background: "var(--tg-theme-bg-color, #fff)" },
  thumbWrap: { position: "relative", aspectRatio: "1 / 1", background: "#f2f2f2" },
  thumb: { width: "100%", height: "100%", objectFit: "cover" },
  thumbPlaceholder: { placeItems: "center", height: "100%", color: "#999" , display: "grid"},
  badge: { position: "absolute", top: 8, left: 8, background: "#111", color: "#fff", fontSize: 12, padding: "2px 6px", borderRadius: 8 },
  title: { fontWeight: 700, marginBottom: 6 },
  desc: { fontSize: 13, opacity: 0.8, marginBottom: 8 },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 },
  primaryBtn: { border: "none", background: "var(--tg-theme-button-color, #2481cc)", color: "var(--tg-theme-button-text-color, #fff)", padding: "10px 12px", borderRadius: 10, width: "100%", marginTop: 8 },
};
