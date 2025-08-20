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

// apps/webapp/src/lib/telegram.ts
export function getInitDataRaw(): string | null {
  if (_cachedRaw) {
    console.log('getInitDataRaw - Returning cached initData');
    return _cachedRaw;
  }

  // 1) Inside Telegram WebApp (desktop and some mobile)
  try {
    // @ts-ignore
    const tg = (window as any).Telegram?.WebApp;
    console.log('getInitDataRaw - Telegram WebApp object:', tg);
    
    if (tg?.initData && typeof tg.initData === 'string' && tg.initData.length > 0) {
      console.log('getInitDataRaw - Found initData in WebApp object');
      _cachedRaw = tg.initData;
      try { 
        if (_cachedRaw) {
          sessionStorage.setItem('tg_init_data_raw', _cachedRaw); 
        }
      } catch {}
      return _cachedRaw;
    }
  } catch (error) {
    console.error('getInitDataRaw - Error accessing WebApp object:', error);
  }

  // 2) Mobile Telegram: Extract from URL hash (tgWebAppData)
  try {
    console.log('getInitDataRaw - Checking URL hash:', window.location.hash);
    const hash = window.location.hash.substring(1);
    if (hash) {
      const params = new URLSearchParams(hash);
      const tgWebAppData = params.get('tgWebAppData');
      
      if (tgWebAppData) {
        console.log('getInitDataRaw - Found tgWebAppData in URL hash');
        _cachedRaw = tgWebAppData;
        try { 
          if (_cachedRaw) {
            sessionStorage.setItem('tg_init_data_raw', _cachedRaw); 
          }
        } catch {}
        return _cachedRaw;
      }
    }
  } catch (error) {
    console.error('getInitDataRaw - Error parsing URL hash:', error);
  }

  // 3) Additional fallback: Check for initData in other URL parts
  try {
    console.log('getInitDataRaw - Checking URL search params:', window.location.search);
    const searchParams = new URLSearchParams(window.location.search);
    const initData = searchParams.get('tgWebAppData') || searchParams.get('initData');
    
    if (initData) {
      console.log('getInitDataRaw - Found initData in URL search params');
      _cachedRaw = initData;
      try { 
        if (_cachedRaw) {
          sessionStorage.setItem('tg_init_data_raw', _cachedRaw); 
        }
      } catch {}
      return _cachedRaw;
    }
  } catch (error) {
    console.error('getInitDataRaw - Error parsing URL search params:', error);
  }

  // 4) Session storage fallback
  try {
    const stored = sessionStorage.getItem('tg_init_data_raw');
    if (stored) {
      console.log('getInitDataRaw - Found initData in session storage');
      _cachedRaw = stored;
      return _cachedRaw;
    }
  } catch (error) {
    console.error('getInitDataRaw - Error accessing session storage:', error);
  }

  console.log('getInitDataRaw - No initData found in any source');
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
  // Check if we have initData (either from WebApp object or URL)
  const hasInitData = !!getInitDataRaw();
  
  // Also check for other Telegram WebApp features
  const tg = getTelegramWebApp();
  const hasTelegramObject = !!tg;
  
  // Check if we're in a Telegram environment by looking at the URL
  const hasTelegramUrlParams = window.location.hash.includes('tgWebAppData') || 
                              window.location.search.includes('tgWebAppData');
  
  return hasInitData || hasTelegramObject || hasTelegramUrlParams;
}

export function ready() {
  try {
    const tg = getTelegramWebApp();
    tg?.ready?.();
    tg?.expand?.();
  } catch {}
}
