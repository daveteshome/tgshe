import { Markup } from 'telegraf';

export const mainMenuKb = Markup.inlineKeyboard([
  [Markup.button.callback('📦 View Products', 'VIEW_PRODUCTS')],
  [Markup.button.callback('🧺 View Cart', 'CART_VIEW')],
  [Markup.button.callback('📜 My Orders', 'MY_ORDERS')],
  [Markup.button.callback('ℹ️ Help', 'HELP')],
]);
