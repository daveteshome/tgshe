import React from "react";

export function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 4, marginTop: 8 }}>
      <span style={{ opacity: 0.8 }}>{label}</span>
      {children}
    </label>
  );
}

export const inputStyle: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,.15)",
  borderRadius: 10,
  padding: "10px 12px",
};

export const textareaStyle: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,.15)",
  borderRadius: 10,
  padding: "10px 12px",
  resize: "vertical",
};
