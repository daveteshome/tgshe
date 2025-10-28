import React from "react";
import { ProductGrid } from "../components/product/ProductGrid";
import { Pagination } from "../components/common/Pagination";
import { ErrorView } from "../components/common/ErrorView";
import { Loader } from "../components/common/Loader";
import { getCategories, getProducts } from "../lib/api/catalog";
import { addItem } from "../lib/api/cart";
import { useAsync } from "../lib/hooks/useAsync";
import { refreshCartCount } from "../lib/store";
import { ready } from "../lib/telegram";
import type { Category as ApiCategory, PagedProducts, Product } from "../lib/types";
import { DEFAULT_PER_PAGE } from "../lib/constants";


/** Watch if an element's TOP edge is on screen (we use it to know when the categories left the viewport). */
function useTopOnScreen(ref: React.MutableRefObject<Element | null>, threshold = 0) {
  const [on, setOn] = React.useState(true);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setOn(entry.isIntersecting),
      { root: null, threshold, rootMargin: "0px 0px -99% 0px" } // fire as soon as top leaves view
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
  return on;
}

// Some backends send `name`, some `title`—support both.
type CatLike = ApiCategory & { title?: string | null };
const catLabel = (c: CatLike) => (c.title ?? (c as any).name ?? "").trim() || "—";

export default function Home() {
  React.useEffect(() => { ready(); }, []);

  // Load categories
  const catsApi = useAsync<ApiCategory[]>(() => getCategories(), []);
  const cats = (catsApi.data ?? []) as CatLike[];

  // Selected category
  const [activeCat, setActiveCat] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!activeCat && cats.length) setActiveCat(cats[0].id);
  }, [cats, activeCat]);

  // Products
  const [page, setPage] = React.useState(1);
  const pageData = useAsync<PagedProducts>(
    () =>
      activeCat
        ? getProducts(activeCat, page, DEFAULT_PER_PAGE)
        : Promise.resolve({ items: [], total: 0, pages: 0, page: 1, perPage: DEFAULT_PER_PAGE }),
    [activeCat, page]
  );

  // Refs & visibility
  const catsSectionRef = React.useRef<HTMLDivElement | null>(null);
  const catsTopRef = React.useRef<HTMLDivElement | null>(null);
  const productsTopRef = React.useRef<HTMLDivElement | null>(null);

  const catsTopOnScreen = useTopOnScreen(catsTopRef as React.MutableRefObject<Element | null>, 0);
  const showCatShortcut = cats.length > 0 && !catsTopOnScreen;

  // Actions
  const onPickCategory = (id: string) => {
    setActiveCat(id);
    setPage(1);
    // jump to products
    requestAnimationFrame(() => {
      productsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const onShowCategories = () => {
    catsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const onAdd = async (p: Product) => {
    await addItem(p.id, 1);
    await refreshCartCount();
  };

  const activeTitle =
    cats.find((c) => c.id === activeCat)?.title ??
    (cats.find((c) => c.id === activeCat) as any)?.name ??
    "Trending";

  return (
    <div style={pageWrap}>
      {/* Sticky shortcut UNDER your menu/header. Adjust 'top' to match your header height if needed. */}
      {showCatShortcut && (
        <button style={catShortcutBtn} onClick={onShowCategories}>🗂️ Categories</button>
      )}

      {/* ---- Categories section ---- */}
      <section ref={catsSectionRef} style={catsSection}>
        <div ref={catsTopRef} />
        <div style={catsGrid}>
          {catsApi.loading && <Loader />}
          {!catsApi.loading && catsApi.error && <ErrorView error={catsApi.error} />}
          {!catsApi.loading && !catsApi.error && cats.map((c) => (
            <button
              key={c.id}
              onClick={() => onPickCategory(c.id)}
              style={{ ...chip, ...(activeCat === c.id ? chipActive : null) }}
              title={catLabel(c)}
            >
              <span style={chipText}>{catLabel(c)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Small header row like your screenshot */}
      <div style={productsHeader}>
        <span>{activeTitle || "Trending"}</span>
        {/* right side could hold view toggles in the future */}
      </div>

      {/* ---- Products ---- */}
      <div ref={productsTopRef} />
      {pageData.loading && <Loader />}
      {!pageData.loading && pageData.error && <ErrorView error={pageData.error} />}
      <ProductGrid products={pageData.data?.items || []} onAdd={onAdd} />
      {pageData.data && pageData.data.pages > 1 && (
        <Pagination
          page={pageData.data.page}
          pages={pageData.data.pages}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(pageData.data!.pages, p + 1))}
        />
      )}
    </div>
  );
}

/* ---------- styles ---------- */
const pageWrap: React.CSSProperties = {
  padding: "10px 10px 90px",
};

const catsSection: React.CSSProperties = {
  marginBottom: 8,
};

/* EXACTLY 4 columns (smaller chips) */
const catsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 8,
};

const chip: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: 56,             // smaller
  padding: "6px 6px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,.08)",
  background: "var(--tg-theme-secondary-bg-color, #f5f7fa)",
  cursor: "pointer",
  textAlign: "center",
  overflow: "hidden",
};
const chipActive: React.CSSProperties = {
  borderColor: "transparent",
  background: "var(--tg-theme-button-color, #2481cc)",
  color: "var(--tg-theme-button-text-color, #fff)",
};
const chipText: React.CSSProperties = {
  fontSize: 12,           // smaller text so 4 fit nicely
  fontWeight: 600,
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  overflow: "hidden",
  width: "100%",
};

const productsHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "rgba(0,0,0,.04)",
  padding: "8px 10px",
  borderRadius: 10,
  margin: "2px 0 10px",
  fontWeight: 700,
  color: "var(--tg-theme-text-color, #111)",
};

/* Sticky shortcut button (shows only when categories have scrolled off). 
   Adjust 'top' to sit right below your menu/header. */
const catShortcutBtn: React.CSSProperties = {
  position: "sticky",
  top: 56,  // <-- if your header is taller/shorter, tweak this
  zIndex: 5,
  width: "100%",
  border: "none",
  borderRadius: 10,
  padding: "10px 12px",
  background: "var(--tg-theme-button-color, #2481cc)",
  color: "var(--tg-theme-button-text-color, #fff)",
  margin: "0 0 8px",
};
