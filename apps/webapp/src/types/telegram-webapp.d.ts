// apps/webapp/src/types/telegram-webapp.d.ts
export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready?: () => void;
        expand?: () => void;
        close?: () => void;
        initData?: string;
        initDataUnsafe?: any;
        colorScheme?: "light" | "dark";
        themeParams?: Record<string, string>;
        HapticFeedback?: {
          impactOccurred?: (
            style?: "light" | "medium" | "heavy" | "rigid" | "soft"
          ) => void;
          notificationOccurred?: (type: "error" | "success" | "warning") => void;
          selectionChanged?: () => void;
        };
        MainButton?: {
          text?: string;
          isVisible?: boolean;
          show?: () => void;
          hide?: () => void;
          onClick?: (cb: () => void) => void;
          offClick?: (cb: () => void) => void;
        };
        BackButton?: {
          isVisible?: boolean;
          show?: () => void;
          hide?: () => void;
          onClick?: (cb: () => void) => void;
          offClick?: (cb: () => void) => void;
        };
      };
    };
  }
}
