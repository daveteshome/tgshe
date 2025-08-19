import express from 'express';
import cors from 'cors';
import path from 'path';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';

import { bot } from './bot/bot';
import { ENV } from './config/env';
import { ensureUser } from './bot/middlewares/ensureUser';
import { registerCommonHandlers } from './bot/handlers/common';
import { registerViewProducts } from './bot/handlers/user/viewProducts';
import { registerMyOrders } from './bot/handlers/user/myOrders';
import { registerAdminOrders } from './bot/handlers/admin/orders';
import { registerAdminProducts } from './bot/handlers/admin/products';
import { registerProfileHandlers } from './bot/handlers/user/profile';
import { registerCheckoutFlow } from './bot/handlers/user/checkout';
import { registerCartHandlers } from './bot/handlers/user/cart';
import { registerAdminProductPhoto } from './bot/handlers/admin/product_photo';

import { api } from './api/routes';

export function createApp() {
  const app = express();

  // If behind ngrok / reverse proxy, trust X-Forwarded-For so req.ip is correct
  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet());

  // Strict CORS (only your WebApp origin)
  app.use(cors({
    origin: ENV.WEBAPP_URL || false, // false => block if not set; set to true for dev-all
    methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  }));

  // Body limits (prevent abuse)
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));

  // Rate limit API (uses userId if available, else IPv6-safe IP key)
  const apiLimiter = rateLimit({
    windowMs: 60_000, // 1 minute
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Use Telegram userId when present; otherwise IPv6-safe IP key
    keyGenerator: (req: any) => (req.userId ?? ipKeyGenerator(req.ip)),
  });

  // Mount API with limiter
  app.use('/api', apiLimiter);
  app.use('/api', api);

  // ----- Telegram Bot -----
  bot.use(ensureUser());
  registerCommonHandlers(bot);
  registerProfileHandlers(bot);
  registerViewProducts(bot);
  registerCartHandlers(bot);
  registerCheckoutFlow(bot, ENV.ADMIN_IDS);
  registerMyOrders(bot);
  registerAdminOrders(bot);
  registerAdminProducts(bot);
  registerAdminProductPhoto(bot as any);

  const WEBHOOK_PATH = '/tg/webhook';
  app.use(bot.webhookCallback(WEBHOOK_PATH));

  // Health
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
