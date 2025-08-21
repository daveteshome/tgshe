// Ensure tsconfig.json includes: "include": ["src/**/*.ts", "src/**/*.d.ts"]
export {};

declare global {
  namespace Express {
    interface Request {
      /** Set by resolveTenant middleware */
      tenant?: import('@prisma/client').Tenant;
      /** Convenience mirror of tenant.id */
      tenantId?: string;

      /** Set by telegramAuth middleware */
      userId?: string;

      /** (legacy) If you ever attach a full user object */
      user?: { tgId?: string } | undefined;
    }
  }
}
