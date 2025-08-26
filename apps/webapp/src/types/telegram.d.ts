// src/types/telegram.d.ts
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        HapticFeedback?: {
          impactOccurred?: (style?: string) => void;
        };
      };
    };
  }
}
export {};
