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
    return _cachedRaw;
  }

  // 1) Inside Telegram WebApp (desktop and some mobile)
  try {
    // @ts-ignore
    const tg = (window as any).Telegram?.WebApp;
    
    if (tg?.initData && typeof tg.initData === 'string' && tg.initData.length > 0) {
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
    const hash = window.location.hash.substring(1);
    if (hash) {
      const params = new URLSearchParams(hash);
      const tgWebAppData = params.get('tgWebAppData');
      
      if (tgWebAppData) {
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
    const searchParams = new URLSearchParams(window.location.search);
    const initData = searchParams.get('tgWebAppData') || searchParams.get('initData');
    
    if (initData) {
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
      _cachedRaw = stored;
      return _cachedRaw;
    }
  } catch (error) {
    console.error('getInitDataRaw - Error accessing session storage:', error);
  }
  
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
