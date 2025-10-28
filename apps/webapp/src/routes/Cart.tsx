// apps/webapp/src/routes/Cart.tsx
import React, { useEffect, useState } from "react";
import { Loader } from "../components/common/Loader";
import { ErrorView } from "../components/common/ErrorView";
import { money } from "../lib/format";
import { getCart, patchItem, removeItem } from "../lib/api/cart";
import { refreshCartCount } from "../lib/store";

const API_BASE = import.meta.env.VITE_API_BASE;
console.log("[CART] VITE_API_BASE =", import.meta.env.VITE_API_BASE);

type CartLine = {
  itemId: string;
  productId: string;
  title: string;
  unitPrice: number;
  currency: string;
  qty: number;
  legacyImg: string | null;
};

export default function Cart() {
  const [items, setItems] = useState<CartLine[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      console.time("[CART] getCart()");
      const api = await getCart();
      console.timeEnd("[CART] getCart()");
      console.log("[CART] getCart() raw items =", api?.items);
      const rows: CartLine[] = (api?.items ?? []).map((i: any) => ({
        itemId: String(i.id),
        productId: String(i.productId),
        title: String(i.title ?? ""),
        unitPrice: Number(i.price ?? 0),
        currency: String(i.currency ?? "ETB"),
        qty: Number(i.qty ?? i.quantity ?? 1),
        legacyImg: i.imageUrl ?? null,
      }));
      console.log("[CART] mapped rows for UI =", rows);
      setItems(rows);
    } catch (e: any) {
      setErr(e?.message ? String(e.message) : String(e));
    } finally {
      setInitialLoading(false);
    }
    
  }

  

  useEffect(() => { load(); }, []);
  function setCountBadgeFrom(itemsNow: CartLine[]) {
    // Fast path: update badge without extra network hop.
    const count = itemsNow.reduce((s, it) => s + it.qty, 0);
    try {
      (window as any).Telegram?.WebApp?.MainButton?.setText?.(`Cart ${count}`);
    } catch {}
    // Also kick the server-backed count in the background (optional)
    refreshCartCount()?.catch?.(() => {});
  }

  async function onInc(line: CartLine) {
    console.log("/////////////////..................///////////////////[CART] on Increment........... =");
    if (busyId) return;
    setBusyId(line.itemId);

    // optimistic
    const prev = items;
    const optimistic = prev.map(it => it.itemId === line.itemId ? { ...it, qty: it.qty + 1 } : it);
    setItems(optimistic);
    setCountBadgeFrom(optimistic);

    try {
      await patchItem(line.itemId, +1);
      (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
      // Optional: soft refresh in background to sync server truth (no loader)
      getCart().then(api => {
        const rows: CartLine[] = (api?.items ?? []).map((i: any) => ({
          itemId: String(i.id),
          productId: String(i.productId),
          title: String(i.title ?? ""),
          unitPrice: Number(i.price ?? 0),
          currency: String(i.currency ?? "ETB"),
          qty: Number(i.qty ?? i.quantity ?? 1),
          legacyImg: i.imageUrl ?? null,
        }));
        setItems(rows);
        setCountBadgeFrom(rows);
      }).catch(() => {});
    } catch {
      // rollback on failure
      setItems(prev);
      setCountBadgeFrom(prev);
      alert("Couldn't increase quantity. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function onDec(line: CartLine) {
    if (busyId) return;
    setBusyId(line.itemId);

    const prev = items;
    let optimistic: CartLine[];
    if (line.qty > 1) {
      optimistic = prev.map(it => it.itemId === line.itemId ? { ...it, qty: it.qty - 1 } : it);
    } else {
      optimistic = prev.filter(it => it.itemId !== line.itemId);
    }
    setItems(optimistic);
    setCountBadgeFrom(optimistic);

    try {
      if (line.qty > 1) await patchItem(line.itemId, -1);
      else await removeItem(line.itemId);

      getCart().then(api => {
        const rows: CartLine[] = (api?.items ?? []).map((i: any) => ({
          itemId: String(i.id),
          productId: String(i.productId),
          title: String(i.title ?? ""),
          unitPrice: Number(i.price ?? 0),
          currency: String(i.currency ?? "ETB"),
          qty: Number(i.qty ?? i.quantity ?? 1),
          legacyImg: i.imageUrl ?? null,
        }));
        setItems(rows);
        setCountBadgeFrom(rows);
      }).catch(() => {});
    } catch {
      setItems(prev);
      setCountBadgeFrom(prev);
      alert("Couldn't update item. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function onRemove(line: CartLine) {
    if (busyId) return;
    setBusyId(line.itemId);

    const prev = items;
    const optimistic = prev.filter(it => it.itemId !== line.itemId);
    setItems(optimistic);
    setCountBadgeFrom(optimistic);

    try {
      await removeItem(line.itemId);
      getCart().then(api => {
        const rows: CartLine[] = (api?.items ?? []).map((i: any) => ({
          itemId: String(i.id),
          productId: String(i.productId),
          title: String(i.title ?? ""),
          unitPrice: Number(i.price ?? 0),
          currency: String(i.currency ?? "ETB"),
          qty: Number(i.qty ?? i.quantity ?? 1),
          legacyImg: i.imageUrl ?? null,
        }));
        setItems(rows);
        setCountBadgeFrom(rows);
      }).catch(() => {});
    } catch {
      setItems(prev);
      setCountBadgeFrom(prev);
      alert("Couldn't remove item. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  const total = items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
  const currency = items[0]?.currency || "ETB";

  if (initialLoading) return <Loader />;
  if (err) return <ErrorView error={err} />;

  return (
    <div style={{ padding: 10, paddingBottom: 90 }}>
      {!items.length ? (
        <div style={{ opacity: 0.7, padding: 20, textAlign: "center" }}>Your cart is empty.</div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 10 }}>
            {items.map((it) => {
              const src = `${API_BASE}/products/${it.productId}/image`; // keep your current build
              console.log("[CART] img src for item", it.itemId, "=>", src);
              return (

              <CartRow
                key={it.itemId}
                title={it.title}
                unitPrice={it.unitPrice}
                currency={it.currency}
                qty={it.qty}
                imgSrc={`${API_BASE}/products/${it.productId}/image`}
                legacyImg={it.legacyImg}
                busy={busyId === it.itemId}
                onInc={() => onInc(it)}
                onDec={() => onDec(it)}
                onRemove={() => onRemove(it)}
              />
            )  
          })}
          </div>

          <div style={summary}>
            <div style={{ fontWeight: 700 }}>Total</div>
            <div style={{ fontWeight: 800 }}>{money(total, currency)}</div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Item row (unchanged styles) ---------- */
function CartRow({ title, unitPrice, currency, qty, imgSrc, legacyImg, busy, onInc, onDec, onRemove,
}: {
  title: string; unitPrice: number; currency: string; qty: number;
  imgSrc: string; legacyImg: string | null; busy: boolean;
  onInc: () => void; onDec: () => void; onRemove: () => void;
}) {
  console.log("[CART IMG] onError..................", imgSrc);
  return (
    <div style={row}>
      <div style={thumbWrap}>
        <img
          src={imgSrc}
          alt={title}
          style={thumb}
          onError={(e) => {
            const el = e.currentTarget as HTMLImageElement;
            if (legacyImg) el.src = legacyImg;
            else el.style.visibility = "hidden";
          }}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={titleStyle} title={title}>{title}</div>
        <div style={{ fontWeight: 700 }}>{money(unitPrice, currency)}</div>

        <div style={qtyRow}>
          <button onClick={onDec} disabled={busy} style={qtyBtn}>−</button>
          <span style={qtyBadge}>{qty}</span>
          <button onClick={onInc} disabled={busy} style={qtyBtn}>+</button>
          <button onClick={onRemove} disabled={busy} style={removeBtn}>Remove</button>
        </div>
      </div>
    </div>
  );
}

const row: React.CSSProperties = { display:"flex", gap:10, border:"1px solid rgba(0,0,0,.08)", borderRadius:12, padding:10, background:"var(--tg-theme-bg-color,#fff)", alignItems:"center" };
const thumbWrap: React.CSSProperties = { width:76, height:76, flex:"0 0 76px", background:"#f2f2f2", borderRadius:10, overflow:"hidden", display:"grid", placeItems:"center" };
const thumb: React.CSSProperties = { width:"100%", height:"100%", objectFit:"cover" };
const titleStyle: React.CSSProperties = { fontWeight:700, marginBottom:4, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" };
const qtyRow: React.CSSProperties = { display:"flex", alignItems:"center", gap:6, marginTop:6 };
const qtyBtn: React.CSSProperties = { width:28, height:28, borderRadius:8, border:"1px solid rgba(0,0,0,.15)", background:"var(--tg-theme-secondary-bg-color,#f5f7fa)", fontSize:18, lineHeight:"26px", textAlign:"center" };
const qtyBadge: React.CSSProperties = { minWidth:28, textAlign:"center", fontWeight:700 };
const removeBtn: React.CSSProperties = { marginLeft:"auto", border:"none", background:"transparent", color:"#d33", fontSize:12, textDecoration:"underline", cursor:"pointer" };
const summary: React.CSSProperties = { display:"flex", justifyContent:"space-between", marginTop:12, padding:12, borderRadius:12, background:"rgba(0,0,0,.04)" };
