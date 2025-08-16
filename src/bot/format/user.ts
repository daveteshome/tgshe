// src/bot/format/user.ts
export function formatUserLabel(u: { tgId: string; username?: string | null; name?: string | null }) {
  // Prefer @username; fall back to name; always include a clickable tg:// link by id
  const handle = u.username ? `@${u.username}` : (u.name || 'User');
  // Telegraf: use HTML parse mode to make clickable mention
  return `<a href="tg://user?id=${u.tgId}">${handle}</a>`;
}
