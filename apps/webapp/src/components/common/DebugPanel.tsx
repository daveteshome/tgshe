// apps/webapp/src/components/common/DebugPanel.tsx
import React, { useEffect, useState } from "react";
import { getInitData, getInitDataRaw, isInsideTelegramContainer, getTelegramWebApp } from "../../lib/telegram";
import { api } from "../../lib/api/index";

type DebugInfo = {
  hasAuth: boolean;
  authLen: number;
  authPrefix: string;
  ua?: string;
  path: string;
};

type VerifyInfo = {
  ok: boolean;
  provided_tail: string;
  expected_tail: string;
  keysUsed: string[];
  botTokenTail: string;
  reason?: string;
};

type WhoAmI = { username: string; id: number; botTokenTail: string };

function trunc(s: string, n = 120) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + `… (+${s.length - n})` : s;
}

export default function DebugPanel() {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [apiResult, setApiResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Debug information for Telegram environment
    const tg = getTelegramWebApp();
    const info = {
      hasWebApp: !!tg,
      initData: tg?.initData || 'None',
      initDataLength: tg?.initData?.length || 0,
      platform: tg?.platform || 'Not available',
      version: tg?.version || 'Not available',
      urlParams: window.location.search,
      hashParams: window.location.hash,
      userAgent: navigator.userAgent,
      isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
      getInitDataRawResult: getInitDataRaw()
    };
    
    setDebugInfo(info);
    console.log('Telegram environment:', info);
  }, []);

  const testApi = async (endpoint: string) => {
    setLoading(true);
    try {
      const result = await api(endpoint);
      setApiResult({ endpoint, success: true, data: result });
    } catch (error: any) {
      setApiResult({ endpoint, success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const [open, setOpen] = useState(true);
  const [inside, setInside] = useState(false);
  const [dec, setDec] = useState(""); const [decLen, setDecLen] = useState(0);
  const [raw, setRaw] = useState(""); const [rawLen, setRawLen] = useState(0);
  const [href, setHref] = useState(""); const [referrer, setReferrer] = useState("");
  const [server, setServer] = useState<DebugInfo | null>(null);
  const [verify, setVerify] = useState<VerifyInfo | null>(null);
  const [who, setWho] = useState<WhoAmI | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function refreshClient() {
    setInside(isInsideTelegramContainer());
    const d = getInitData() || "";
    setDec(d); setDecLen(d.length);
    const r = getInitDataRaw() || "";
    setRaw(r); setRawLen(r.length);
    setHref(location.href);
    setReferrer(document.referrer || "");
  }

  async function debugServer() {
    setErr(null);
    try { setServer(await api<DebugInfo>("/_debug")); } catch (e: any) { setErr(e?.message || String(e)); }
  }
  async function runVerify() {
    setErr(null); setVerify(null);
    try { setVerify(await api<VerifyInfo>("/_verify")); } catch (e: any) { setErr(e?.message || String(e)); }
  }
  async function runWho() {
    setErr(null); setWho(null);
    try { setWho(await api<WhoAmI>("/_whoami")); } catch (e: any) { setErr(e?.message || String(e)); }
  }

  useEffect(() => { refreshClient(); debugServer(); }, []);

  return (
    <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--tg-theme-bg-color, #fff)", paddingTop: 6 }}>
      <button style={btn} onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"} Debug</button>
      {open && (
        <div style={box}>
          <div><b>Telegram WebApp object present:</b> {inside ? "yes" : "no"}</div>
          <div><b>Client initData (decoded):</b><br/>length: {decLen}<br/>sample: <code style={code}>{trunc(dec)}</code></div>
          <div><b>Client initData (raw, from URL):</b><br/>length: {rawLen}<br/>sample: <code style={code}>{trunc(raw)}</code></div>
          <div><b>Location:</b> <code style={code}>{href}</code></div>
          <div><b>Referrer:</b> <code style={code}>{referrer || "(none)"} </code></div>

          <div style={{ marginTop: 8 }}>
            <button style={btn} onClick={refreshClient}>Refresh client</button>
            <button style={btn} onClick={debugServer}>/api/_debug</button>
            <button style={btn} onClick={runVerify}>/api/_verify</button>
            <button style={btn} onClick={runWho}>/api/_whoami</button>
          </div>

          {err && <div style={{ marginTop: 6, color: "#a00", background: "rgba(255,0,0,.06)", padding: 6, borderRadius: 8 }}>{err}</div>}

          {server && (
            <div style={{ marginTop: 10 }}>
              <div><b>Server hasAuth:</b> {String(server.hasAuth)} (len={server.authLen})</div>
              <div><b>Auth prefix:</b> <code style={code}>{server.authPrefix}</code></div>
              <div><b>UA:</b> <code style={code}>{server.ua}</code></div>
              <div><b>Path:</b> <code style={code}>{server.path}</code></div>
            </div>
          )}

          {verify && (
            <div style={{ marginTop: 10 }}>
              <div><b>/_verify ok:</b> {String(verify.ok)} ({verify.reason})</div>
              <div><b>tails:</b> provided={verify.provided_tail} expected={verify.expected_tail}</div>
              <div><b>keysUsed:</b> <code style={code}>{verify.keysUsed.join(", ")}</code></div>
              <div><b>backend botTokenTail:</b> <code style={code}>{verify.botTokenTail}</code></div>
            </div>
          )}

          {who && (
            <div style={{ marginTop: 10 }}>
              <div><b>Backend bot:</b> @{who.username || "(unknown)"} (id {who.id}) tokenTail={who.botTokenTail}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = { border: "1px solid rgba(0,0,0,.2)", background: "transparent", padding: "6px 10px", borderRadius: 8, marginRight: 6, marginTop: 6 };
const box: React.CSSProperties = { border: "1px dashed rgba(0,0,0,.15)", borderRadius: 12, padding: 10, background: "rgba(0,0,0,.03)" };
const code: React.CSSProperties = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 12 };
