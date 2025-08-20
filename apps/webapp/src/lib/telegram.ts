// apps/webapp/src/lib/telegram.ts
import { retrieveLaunchParams } from '@telegram-apps/sdk';

let _cachedRaw: string | null = null;
let _cachedDecoded: string | null = null;

function setCache(raw: string) {
  _cachedRaw = raw;
  try { sessionStorage.setItem('tg_init_data_raw', raw); } catch {}
}

export function getTelegramWebApp(): any | null {
  // @ts-ignore
  return (window as any).Telegram?.WebApp || null;
}

/** RAW init data exactly as Telegram provides it. */
export function getInitDataRaw(): string | null {
  if (_cachedRaw) return _cachedRaw;

  // 1) Inside Telegram
  try {
    // @ts-ignore
    const tgRaw: unknown = (window as any).Telegram?.WebApp?.initData;
    if (typeof tgRaw === 'string' && tgRaw.length > 0) {
      // Clean up the initData - remove signature if both hash and signature exist
      let cleaned = tgRaw;
      if (tgRaw.includes('hash=') && tgRaw.includes('signature=')) {
        cleaned = tgRaw.replace(/&signature=[^&]*/, '');
      }
      setCache(cleaned);
      return _cachedRaw;
    }
  } catch {}

  // 2) SDK
  try {
    const lp: any = retrieveLaunchParams?.();
    const sdkRaw: unknown = lp?.initDataRaw;
    if (typeof sdkRaw === 'string' && sdkRaw.length > 0) {
      setCache(sdkRaw);
      return _cachedRaw;
    }
  } catch {}

  // 3) URL (keep RAW, do not decode)
  try {
    const candidates = [location.hash?.slice(1), location.search?.slice(1)].filter(Boolean) as string[];
    for (const raw of candidates) {
      const qs = new URLSearchParams(raw);
      const v =
        qs.get('tgWebAppData') ||
        qs.get('initData') ||
        qs.get('_tginit_raw') ||
        qs.get('_tginit');
      if (typeof v === 'string' && v.length > 0) {
        setCache(v);
        return _cachedRaw;
      }
    }
  } catch {}

  // 4) Session
  try {
    const stored = sessionStorage.getItem('tg_init_data_raw');
    if (stored && stored.length > 0) {
      _cachedRaw = stored;
      return _cachedRaw;
    }
  } catch {}

  return null;
}

export function getInitData(): string | null {
  if (_cachedDecoded) return _cachedDecoded;
  const raw = getInitDataRaw();
  if (!raw) return null;
  try { _cachedDecoded = decodeURIComponent(raw); } catch { _cachedDecoded = raw; }
  return _cachedDecoded;
}

export function isInsideTelegramContainer(): boolean {
  // @ts-ignore
  const tg = (window as any).Telegram?.WebApp;
  return !!tg && typeof tg.initData === 'string' && tg.initData.length > 0;
}

export function ready() {
  try {
    const tg = getTelegramWebApp();
    tg?.ready?.();
    tg?.expand?.();
  } catch {}
}
