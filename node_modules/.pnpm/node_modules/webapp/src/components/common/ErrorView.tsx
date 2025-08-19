import React from "react";
export function ErrorView({ error }: { error: string | null }) {
  if (!error) return null;
  return <div style={{ color: "#b00", background: "rgba(255,0,0,.06)", padding: 8, borderRadius: 10 }}>{error}</div>;
}