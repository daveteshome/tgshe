// apps/backend/src/index.ts
import 'dotenv/config';
import { createApp } from './app';

(async () => {
  try {
    const { start } = createApp();

    // Start the HTTP server + webhook (handled inside start()).
    await start();

    // Basic safety nets
    process.on('unhandledRejection', (reason) => {
      console.error('[backend] Unhandled Rejection:', reason);
    });

    process.on('uncaughtException', (err) => {
      console.error('[backend] Uncaught Exception:', err);
      // Consider whether you want to exit here or keep running.
      // process.exit(1);
    });

    // Graceful shutdown hooks (optional)
    const shutdown = (signal: string) => {
      console.log(`[backend] Received ${signal}. Shutting down gracefully...`);
      // If you later return a server instance from createApp(), you can close it here.
      // Also consider deleting webhook if you switch to long polling, etc.
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('[backend] Fatal startup error:', err);
    process.exit(1);
  }
})();
