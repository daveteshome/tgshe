import 'dotenv/config';

const required = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
};

export const ENV = {
  BOT_TOKEN: required('BOT_TOKEN'),
  BASE_URL: required('BASE_URL'),
  WEBAPP_URL: required('WEBAPP_URL'),
  PORT: parseInt(process.env.PORT || '4000', 10),
  ADMIN_IDS: (process.env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean),
  GROUP_CHAT_ID: (process.env.GROUP_CHAT_ID || ''),
  ADMIN_GROUP_CHAT_ID: (process.env.ADMIN_GROUP_CHAT_ID || ''),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: required('DATABASE_URL'),
  R2_PUBLIC_BASE: required('R2_PUBLIC_BASE'),

  R2_ENDPOINT: required('R2_ENDPOINT'),
  R2_BUCKET: required('R2_BUCKET'),
  R2_SECRET_ACCESS_KEY: required('R2_SECRET_ACCESS_KEY'),
  R2_ACCESS_KEY_ID: required('R2_ACCESS_KEY_ID'),
  R2_ACCOUNT_ID: required('R2_ACCOUNT_ID'),

  // NEW
  DEFAULT_TENANT_SLUG: process.env.DEFAULT_TENANT_SLUG ?? 'demo',

  // (optional) if you use it elsewhere
  WEBAPP_ORIGIN: process.env.WEBAPP_ORIGIN ?? '',
};
