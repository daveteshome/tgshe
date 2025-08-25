//Home.tsx
import React, { useEffect, useState } from "react";
import { TopBar } from "../components/layout/TopBar";
import { CategoryTabs } from "../components/product/CategoryTabs";
import { ProductGrid } from "../components/product/ProductGrid";
import { Loader } from "../components/common/Loader";
import { ErrorView } from "../components/common/ErrorView";
import { Pagination } from "../components/common/Pagination";
import { getCategories, getProducts } from "../lib/api/catalog";
import { addItem } from "../lib/api/cart";
import { useAsync } from "../lib/hooks/useAsync";
import type { Category, PagedProducts, Product } from "../lib/types";
import { DEFAULT_PER_PAGE } from "../lib/constants";
import { refreshCartCount } from "../lib/store";
//import DebugPanel from "../components/common/DebugPanel";
import RunInsideTelegramNotice from "../components/common/RunInsideTelegramNotice";
import { ready, getInitData } from "../lib/telegram";
//import DebugAuth from '../components/common/DebugAuth';

export default function Home() {
  
  useEffect(() => { ready(); }, []);

  // quick flag: outside Telegram if initData missing
  const [outside, setOutside] = useState(false);
  useEffect(() => {
    // @ts-ignore
    const tg = (window as any).Telegram?.WebApp;
    const hasInit = !!tg?.initData && String(tg.initData).length > 0;
    setOutside(!hasInit);
  }, []);

  useEffect(() => {
    setOutside(!(getInitData() && getInitData()!.length > 0));
  }, []);

  const cats = useAsync<Category[]>(() => getCategories(), []);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (cats.data && cats.data.length && !categoryId) {
      setCategoryId(cats.data[0].id);
    }
  }, [cats.data, categoryId]);

  const pageData = useAsync<PagedProducts>(
    () =>
      categoryId
        ? getProducts(categoryId, page, DEFAULT_PER_PAGE)
        : Promise.resolve({ items: [], total: 0, pages: 0, page: 1, perPage: DEFAULT_PER_PAGE }),
    [categoryId, page]
  );

  async function onAdd(p: Product) {
    await addItem(p.id, 1);
    await refreshCartCount();
  }
    //put it inside retun below div for debug
      //<DebugAuth />
      //<DebugPanel />
  return (
    <div>
      <RunInsideTelegramNotice show={outside} />

      <TopBar title="Products" />
      {cats.loading ? <Loader /> : <ErrorView error={cats.error} />}
      {cats.data && <CategoryTabs categories={cats.data} activeId={categoryId} onChange={(id) => { setCategoryId(id); setPage(1); }} />}
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
