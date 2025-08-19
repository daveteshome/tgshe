import React from "react";

export function Pagination({
  page,
  pages,
  onPrev,
  onNext,
}: {
  page: number;
  pages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: 12 }}>
      <button style={btn} disabled={page <= 1} onClick={onPrev}>Prev</button>
      <div style={{ alignSelf: "center" }}>{page} / {pages}</div>
      <button style={btn} disabled={page >= pages} onClick={onNext}>Next</button>
    </div>
  );
}

const btn: React.CSSProperties = { border: "1px solid rgba(0,0,0,.15)", background: "transparent", padding: "8px 12px", borderRadius: 10 };