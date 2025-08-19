import React, { useEffect, useState } from "react";
import { TopBar } from "../components/layout/TopBar";
import { Loader } from "../components/common/Loader";
import { ErrorView } from "../components/common/ErrorView";
import { FormField, inputStyle, textareaStyle } from "../components/common/FormField";
import { AddressForm } from "../components/profile/AddressForm";
import { useAsync } from "../lib/hooks/useAsync";
import { getProfile, updateProfile } from "../lib/api/profile";
import type { Profile as TProfile } from "../lib/types";

export default function Profile() {
  const q = useAsync<TProfile>(() => getProfile(), []);
  const [form, setForm] = useState<TProfile | null>(null);

  useEffect(() => { if (q.data) setForm(q.data); }, [q.data]);

  async function save() {
    if (!form) return;
    await updateProfile({
      phone: form.phone || null,
      city: form.city || null,
      place: form.place || null,
      specialReference: form.specialReference || null,
    });
    alert("Profile saved");
  }

  return (
    <div>
      <TopBar title="Profile" />
      {q.loading ? <Loader /> : <ErrorView error={q.error} />}

      {form && (
        <div style={panel}>
          <div style={kv}><span style={k}>User</span><span style={v}>{form.username || form.name || form.tgId}</span></div>

          <FormField label="Phone">
            <input style={inputStyle} value={form.phone || ""} onChange={(e) => setForm({ ...form!, phone: e.target.value })} placeholder="Telegram phone or manual" />
          </FormField>

          <AddressForm
            city={form.city || ""}
            place={form.place || ""}
            specialReference={form.specialReference || ""}
            onChange={(f) => setForm({ ...form!, city: f.city, place: f.place, specialReference: f.specialReference })}
          />

          <button style={primaryBtn} onClick={save}>Save</button>
        </div>
      )}
    </div>
  );
}

const panel: React.CSSProperties = { border: "1px solid rgba(0,0,0,.08)", borderRadius: 12, padding: 12, marginTop: 12 };
const kv: React.CSSProperties = { display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center", marginBottom: 8 };
const k: React.CSSProperties = { opacity: 0.7 };
const v: React.CSSProperties = { fontWeight: 600 };
const primaryBtn: React.CSSProperties = { border: "none", background: "var(--tg-theme-button-color, #2481cc)", color: "var(--tg-theme-button-text-color, #fff)", padding: "10px 12px", borderRadius: 10, width: "100%", marginTop: 8 };
