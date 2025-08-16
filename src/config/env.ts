import 'dotenv/config';

const required = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
};

export const ENV = {
  BOT_TOKEN: required('BOT_TOKEN'),
  BASE_URL: required('BASE_URL'),
  PORT: parseInt(process.env.PORT || '4000', 10),
  ADMIN_IDS: (process.env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean),
};