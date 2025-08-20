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
    origin: [
      ENV.WEBAPP_URL,
      'https://web.telegram.org',
      /\.ngrok-free\.app$/, // Allow all ngrok subdomains
      'http://localhost:3000' // For local development
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // Body limits (prevent abuse)
  app.use(express.json({ limit: '10mb' })); // Increased limit for potential image uploads
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));

  // Rate limit API (uses userId if available, else IPv6-safe IP key)
  const apiLimiter = rateLimit({
    windowMs: 60_000, // 1 minute
    max: 100, // Increased limit for API calls
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Use Telegram userId when present; otherwise IPv6-safe IP key
    keyGenerator: (req: any) => (req.userId ?? ipKeyGenerator(req.ip)),
    message: {
      error: 'Too many requests, please try again later.'
    }
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

  // Health endpoint with more details
  app.get('/', (_req, res) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: ENV.NODE_ENV,
      webappUrl: ENV.WEBAPP_URL
    });
  });

  // Error handling middleware
  app.use((err: any, req: Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      ...(ENV.NODE_ENV === 'development' && { details: err.message })
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  return {
    app,
    start: async () => {
      app.listen(ENV.PORT, async () => {
        console.log(`Server running on port ${ENV.PORT}`);
        console.log(`Environment: ${ENV.NODE_ENV}`);
        console.log(`WebApp URL: ${ENV.WEBAPP_URL}`);
        
        try {
          await bot.telegram.setWebhook(`${ENV.BASE_URL}${WEBHOOK_PATH}`);
          console.log('Webhook set to', `${ENV.BASE_URL}${WEBHOOK_PATH}`);
          
          const botInfo = await bot.telegram.getMe();
          console.log(`Bot @${botInfo.username} is ready`);
        } catch (e) {
          console.error('Webhook error:', e);
        }
      });
    }
  };
}