export {};

declare global {
  interface TelegramWebAppUser {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  }
  interface TelegramWebApp {
    initData: string;
    initDataUnsafe?: { user?: TelegramWebAppUser };
    ready: () => void;
    expand: () => void;
    close: () => void;
    BackButton?: { show: () => void; hide: () => void; onClick: (cb: () => void) => void };
    MainButton?: { show: () => void; hide: () => void; setText: (t: string) => void; onClick: (cb: () => void) => void };
  }
  interface TelegramSDK { WebApp: TelegramWebApp }
  interface Window { Telegram?: TelegramSDK }
}
