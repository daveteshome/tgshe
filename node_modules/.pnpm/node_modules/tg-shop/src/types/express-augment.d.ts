// Type augmentation for Express Request used across the app.
// Make sure tsconfig.json includes: "include": ["src/**/*.ts", "src/**/*.d.ts"]

export {};

declare global {
  namespace Express {
    interface Request {
      /** Set by resolveTenant middleware */
      tenant?: import('@prisma/client').Tenant;
      /** Convenience mirror of tenant.id set by resolveTenant */
      tenantId?: string;
      /** Set by your telegramAuth middleware */
      userId?: string;
    }
  }
}
