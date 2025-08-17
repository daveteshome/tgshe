import express from 'express';
import { bot } from './bot/bot';
import { ENV } from './config/env';
import { ensureUser } from './bot/middlewares/ensureUser';
import { registerCommonHandlers } from './bot/handlers/common';
import { registerViewProducts } from './bot/handlers/user/viewProducts'
import { registerMyOrders } from './bot/handlers/user/myOrders';
import { registerBuyNow } from './bot/handlers/user/buyNow';
import { registerAdminOrders } from './bot/handlers/admin/orders';
import { registerAdminProducts } from './bot/handlers/admin/products';
import { registerProfileHandlers } from './bot/handlers/user/profile';
import { registerCheckoutFlow } from './bot/handlers/user/checkout';
import { registerCartHandlers } from './bot/handlers/user/cart';
import { registerAdminProductPhoto } from './bot/handlers/admin/product_photo';



export function createApp() {
  const app = express();
  app.use(express.json());

  // Register middlewares & handlers
  bot.use(ensureUser());
  registerCommonHandlers(bot);
  
  registerProfileHandlers(bot);
 
  //registerBuyNow(bot);


  registerViewProducts(bot);
  registerCartHandlers(bot);
  registerCheckoutFlow(bot, ENV.ADMIN_IDS); 
  registerMyOrders(bot);

  registerAdminOrders(bot);
  registerAdminProducts(bot);
  registerAdminProductPhoto(bot as any);

  const WEBHOOK_PATH = '/tg/webhook';
  app.use(bot.webhookCallback(WEBHOOK_PATH));

  // health
  app.get('/', (_req, res) => res.send('OK'));

  return {
    app,
    start: async () => {
      app.listen(ENV.PORT, async () => {
        console.log(`Server on :${ENV.PORT}`);
        try {
          await bot.telegram.setWebhook(`${ENV.BASE_URL}${WEBHOOK_PATH}`);
          console.log('Webhook set to', `${ENV.BASE_URL}${WEBHOOK_PATH}`);
        } catch (e) {
          console.error('Webhook error:', e);
        }
      });
    }
  };
}
