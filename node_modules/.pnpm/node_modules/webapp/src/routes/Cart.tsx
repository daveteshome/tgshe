import React, { useEffect, useMemo, useState } from "react";
import { TopBar } from "../components/layout/TopBar";
import { Loader } from "../components/common/Loader";
import { ErrorView } from "../components/common/ErrorView";
import { CartItemRow } from "../components/cart/CartItemRow";
import { CartSummary } from "../components/cart/CartSummary";
import { AddressForm } from "../components/profile/AddressForm";
import { useAsync } from "../lib/hooks/useAsync";
import { getCart, patchItem, removeItem } from "../lib/api/cart";
import { checkout } from "../lib/api/orders";
import { getProfile } from "../lib/api/profile";
import type { Cart, Profile } from "../lib/types";
import { refreshCartCount } from "../lib/store";

export default function Cart() {
  const cartQ = useAsync<Cart>(() => getCart(), []);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => { /* trigger re-render on reloadKey */ }, [reloadKey]);

  const items = cartQ.data?.items || [];
  const total = useMemo(() => items.reduce((s, it) => s + it.product.price * it.qty, 0), [items]);
  const currency = items[0]?.product.currency || "USD";

  const profQ = useAsync<Profile>(() => getProfile(), []);
  const [city, setCity] = useState("");
  const [place, setPlace] = useState("");
  const [specialReference, setSpecialReference] = useState("");

  useEffect(() => {
    const p = profQ.data;
    if (p) {
      setCity(p.city || "");
      setPlace(p.place || "");
      setSpecialReference(p.specialReference || "");
    }
  }, [profQ.data]);

  function shippingString() {
    return [city, place, specialReference].filter(Boolean).join(", ");
  }

  async function onCheckout() {
    const ship = shippingString();
    if (!ship || ship.trim().length < 4) return alert("Please enter a shipping address");
    const order = await checkout(ship);
    await refreshCartCount();
    alert(`Order #${order.id.slice(0, 6)} placed!`);
    setReloadKey((k) => k + 1);
  }

  async function inc(itemId: string) {
    await patchItem(itemId, +1);
    await refreshCartCount();
    setReloadKey((k) => k + 1);
  }

  async function dec(itemId: string) {
    await patchItem(itemId, -1);
    await refreshCartCount();
    setReloadKey((k) => k + 1);
  }

  async function remove(itemId: string) {
    await removeItem(itemId);
    await refreshCartCount();
    setReloadKey((k) => k + 1);
  }

  return (
    <div>
      <TopBar title="Cart" />
      {cartQ.loading ? <Loader /> : <ErrorView error={cartQ.error} />}

      <div>
        {items.map((it) => (
          <CartItemRow
            key={it.id}
            item={it}
            onInc={() => inc(it.id)}
            onDec={() => dec(it.id)}
            onRemove={() => remove(it.id)}
          />
        ))}
        {items.length === 0 && <div style={{ opacity: 0.7 }}>Your cart is empty.</div>}
      </div>

      <CartSummary total={total} currency={currency} onCheckout={onCheckout}>
        <AddressForm
          city={city}
          place={place}
          specialReference={specialReference}
          onChange={(f) => { setCity(f.city); setPlace(f.place); setSpecialReference(f.specialReference); }}
        />
      </CartSummary>
    </div>
  );
}
