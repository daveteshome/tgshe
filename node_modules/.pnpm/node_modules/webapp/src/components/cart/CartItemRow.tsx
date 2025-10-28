// apps/webapp/src/components/cart/CartItemRow.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import type { CartItem } from "../../lib/types";
import { money } from "../../lib/format";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const PLACEHOLDER = "/assets/placeholder.png"; // add one if you don’t have it

export function CartItemRow({
  item, onInc, onDec, onRemove,
}: {
  item: CartItem; onInc: () => void; onDec: () => void; onRemove: () => void;
}) {
  const navigate = useNavigate();

  // Defensive: make sure product exists
  if (!item?.product) {
    console.warn("[CART IMG] missing product on item", item?.id);
  }

  const prodId = String(item.product?.id ?? "");
  const imgSrc =
    item.product?.photoUrl
      || `${API_BASE}/products/${prodId}/image`;

  console.log("[CART IMG] item", item.id, "→", imgSrc);

  const goProduct = () => {
    if (!prodId) return;
    navigate(`/product/${prodId}`);
  };

  return (
    <div style={row}>
      {/* Thumbnail (clickable) */}
      <button onClick={goProduct} style={thumbButton}>
        <img
          src={imgSrc}
          alt={item.product?.title ?? "Product"}
          style={thumb}
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER; }}
        />
      </button>

      {/* Title + price (title clickable) */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <button onClick={goProduct} style={titleBtn}>
          <div style={titleEllipsis}>
            {item.product?.title ?? "Untitled"}
          </div>
        </button>
        <div style={{ opacity: 0.7 }}>
          {money(item.product?.price ?? 0, item.product?.currency ?? "ETB")}
        </div>
      </div>

      {/* Qty + remove */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onDec}>−</button>
        <strong>{item.qty}</strong>
        <button onClick={onInc}>+</button>
        <button style={dangerBtn} onClick={onRemove}>Remove</button>
      </div>
    </div>
  );
}

const row: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "76px 1fr auto",
  gap: 10,
  alignItems: "center",
  padding: "8px 0",
  borderBottom: "1px dashed rgba(0,0,0,.06)",
};

const thumbButton: React.CSSProperties = {
  width: 76, height: 76, borderRadius: 10, overflow: "hidden",
  background: "#f2f2f2", padding: 0, border: "none", cursor: "pointer",
  display: "grid", placeItems: "center",
};

const thumb: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };

const titleBtn: React.CSSProperties = {
  border: "none", background: "transparent", padding: 0, margin: 0,
  textAlign: "left", cursor: "pointer", color: "inherit",
};

const titleEllipsis: React.CSSProperties = {
  fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};

const dangerBtn: React.CSSProperties = {
  border: "1px solid rgba(255,0,0,.4)", color: "#b00",
  background: "transparent", padding: "6px 10px", borderRadius: 10
};
