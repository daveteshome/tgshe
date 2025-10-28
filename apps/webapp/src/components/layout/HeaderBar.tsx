// apps/webapp/src/components/layout/HeaderBar.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useCartCount } from "../../lib/store";

type Props = { onOpenMenu: () => void; title?: string };

export default function HeaderBar({ onOpenMenu, title = "TG Shop" }: Props) {
  const navigate = useNavigate();
  const count = useCartCount();
  
  return (
    <header
      style={{
        position: "sticky", top: 0, zIndex: 50, background: "#fff",
        borderBottom: "1px solid #eee", height: 56,
        display: "grid", gridTemplateColumns: "48px 1fr 48px", alignItems: "center", padding: "0 6px",
      }}
    >
      <button
        aria-label="Open menu"
        onClick={onOpenMenu}
        style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid #e5e7eb", display: "grid", placeItems: "center", background: "#fff" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" stroke="#111" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <div
        onClick={() => navigate("/")}
        style={{ textAlign: "center", fontWeight: 700, fontSize: 18, cursor: "pointer", userSelect: "none" }}
        aria-label="Go home"
        title="Home"
      >
        {title}
      </div>

      <button
        aria-label="Open cart"
        onClick={() => navigate("/cart")}
        style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid #e5e7eb", display: "grid", placeItems: "center", position: "relative", background: "#fff" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6h.01L7 17a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2l1-9H6z"
                stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9" cy="21" r="1.8" fill="#111" />
          <circle cx="18" cy="21" r="1.8" fill="#111" />
        </svg>
        {count > 0 && (
          <span
            style={{
              position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, padding: "0 5px",
              borderRadius: 9, background: "#e11d48", color: "#fff", fontSize: 12, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
            }}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
    </header>
  );
}
