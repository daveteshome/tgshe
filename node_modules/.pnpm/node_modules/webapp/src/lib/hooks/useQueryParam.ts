import { useCallback, useMemo } from "react";

export function useQueryParam(key: string) {
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const get = useMemo(() => params.get(key), [params, key]);

  const set = useCallback(
    (value: string | null) => {
      const p = new URLSearchParams(location.search);
      if (value === null || value === "") p.delete(key);
      else p.set(key, value);
      const next = `${location.pathname}?${p.toString()}${location.hash}`;
      history.replaceState(null, "", next);
      window.dispatchEvent(new Event("popstate")); // allow listeners to react if needed
    },
    [key]
  );

  return [get, set] as const;
}