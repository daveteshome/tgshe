// apps/webapp/src/routes/Home.tsx
import React, { useEffect, useMemo, useState } from "react";
import { TopBar } from "../components/layout/TopBar";
import { CategoryTabs } from "../components/product/CategoryTabs";
import { ProductGrid } from "../components/product/ProductGrid";
import { Loader } from "../components/common/Loader";
import { ErrorView } from "../components/common/ErrorView";
import { Pagination } from "../components/common/Pagination";
import { getCategories, getProducts } from "../lib/api/catalog";
import { addItem } from "../lib/api/cart";
import { useAsync } from "../lib/hooks/useAsync";
import type { Category as TabsCategory, PagedProducts, Product } from "../lib/types";
import { DEFAULT_PER_PAGE } from "../lib/constants";
import { refreshCartCount } from "../lib/store";
import RunInsideTelegramNotice from "../components/common/RunInsideTelegramNotice";
import { ready, getInitData } from "../lib/telegram";

type ApiCategory = { id: string; title: string; iconUrl?: string | null };

export default function Home() {
  useEffect(() => { ready(); }, []);

  // detect outside of Telegram
  const [outside, setOutside] = useState(false);
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const hasInit = !!tg?.initData && String(tg.initData).length > 0;
    setOutside(!hasInit);
  }, []);
  useEffect(() => { setOutside(!(getInitData() && getInitData()!.length > 0)); }, []);

  // Load categories from API (id + title)
  const catsApi = useAsync<ApiCategory[]>(() => getCategories() as unknown as Promise<ApiCategory[]>, []);

  // Normalize for CategoryTabs (expects `name`)
  const catsUi: TabsCategory[] = useMemo(
    () =>
      (catsApi.data ?? []).map((c) => ({
        id: c.id,
        name: c.title,        // 🔑 map title -> name
        iconUrl: c.iconUrl ?? null,
      })),
    [catsApi.data]
  );

  const [categoryId, setCategoryId] = useState<string | null>(null);

  // Pick first category when loaded
  useEffect(() => {
    if (catsUi.length && !categoryId) setCategoryId(catsUi[0].id);
  }, [catsUi, categoryId]);

  // Load products for the active category
  const [page, setPage] = useState(1);
  const pageData = useAsync<PagedProducts>(
    () =>
      categoryId
        ? getProducts(categoryId, page, DEFAULT_PER_PAGE)
        : Promise.resolve({ items: [], total: 0, pages: 0, page: 1, perPage: DEFAULT_PER_PAGE }),
    [categoryId, page]
  );

  async function onAdd(p: Product) {
    await addItem(p.id, 1);
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    await refreshCartCount();
  }

  return (
    <div>
      <RunInsideTelegramNotice show={outside} />
      <TopBar title="Products" />

      {catsApi.loading ? <Loader /> : <ErrorView error={catsApi.error} />}
      {catsUi.length > 0 && (
        <CategoryTabs
          categories={catsUi}
          activeId={categoryId}
          onChange={(id) => {
            setCategoryId(id);
            setPage(1);
          }}
        />
      )}

      {pageData.loading ? <Loader /> : <ErrorView error={pageData.error} />}
      <ProductGrid products={pageData.data?.items || []} onAdd={onAdd} />

      {pageData.data && (
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
