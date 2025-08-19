import { ENV } from '../config/env';
import { db } from './db';
import { money } from './money';
import type { Telegraf } from 'telegraf';

function captionFor(p: any) {
  return (
    `*${p.title}*\n` +
    (p.description ? `${p.description}\n` : '') +
    `💵 Price: ${money(p.price, p.currency)}\n` +
    `📦 Stock: ${p.stock}\n` +
    (p.category ? `📂 Category: ${p.category.name}\n` : '')
  );
}

function esc(s: string) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function mediaFor(p: any) {
  if (p.photoFileId) return p.photoFileId;
  if (p.photoUrl && /^https?:\/\//i.test(p.photoUrl)) return { url: p.photoUrl };
  return { url: 'https://placehold.co/800x500/png?text=Product' };
}

function orderHeadline(o: any) {
  const code = `#${o.id.slice(0,6)}`;
  const items = o.items?.reduce((s: number, it: any) => s + it.qty, 0) ?? 0;
  const who = o.user?.username ? `@${o.user.username}` : `tg:${o.userId}`;
  return `${code} • ${items} item${items===1?'':'s'} • ${money(o.total, o.currency)} • ${who}`;
}
function orderDetails(o: any) {
  const lines = [
    `*${orderHeadline(o)}*`,
    `Status: *${o.status}*`,
  ];
  if (o.shippingAddress) lines.push(`Address: ${o.shippingAddress}`);
  if (o.notes) lines.push(`Note: ${o.notes}`);
  if (o.items?.length) lines.push('', ...o.items.map((it: any) => `• ${it.title} x${it.qty} — ${money(it.price * it.qty, o.currency)}`));
  return lines.join('\n');
}

export class Publisher {
  // Always end up with a post in the group: edit if exists, otherwise create.
  static async upsertProductPost(bot: Telegraf | any, productId: string) {
    const p = await db.product.findUnique({
      where: { id: productId },
      include: { category: true },
    });
    if (!p) throw new Error('Product not found');

    const chatId = p.groupChatId || ENV.GROUP_CHAT_ID;
    const messageId = p.groupMessageId ? Number(p.groupMessageId) : null;

    const caption = captionFor(p);
    const media = mediaFor(p);

    // If we have a previous message in (this) group, try editing it
    if (messageId && chatId) {
      try {
        // Try editing both media and caption (works for bots on their own messages)
        await bot.telegram.editMessageMedia(
          chatId,
          messageId,
          undefined,
          {
            type: 'photo',
            media: typeof media === 'string' ? media : (media as any).url,
            caption,
            parse_mode: 'Markdown',
          } as any
        );
        return;
      } catch (_) {
        // fall through to sending a new message
      }
    }

    // Otherwise, send a fresh post
    const msg = await bot.telegram.sendPhoto(chatId, media as any, {
      caption,
      parse_mode: 'Markdown',
    });

    // Save the new message reference
    await db.product.update({
      where: { id: productId },
      data: {
        groupMessageId: String(msg.message_id),
        groupChatId: String(chatId),
      },
    });
  }

  // If you still want a "fresh post every time" call this instead of upsert.
  static async postProduct(bot: Telegraf | any, productId: string) {
    const p = await db.product.findUnique({
      where: { id: productId },
      include: { category: true },
    });
    if (!p) throw new Error('Product not found');

    const caption = captionFor(p);
    const media = mediaFor(p);

    const msg = await bot.telegram.sendPhoto(ENV.GROUP_CHAT_ID, media as any, {
      caption,
      parse_mode: 'Markdown',
    });

    await db.product.update({
      where: { id: productId },
      data: {
        groupMessageId: String(msg.message_id),
        groupChatId: String(ENV.GROUP_CHAT_ID),
      },
    });
  }

  static async notifyOrderNew(bot: Telegraf | any, orderId: string) {
    if (!ENV.ADMIN_GROUP_CHAT_ID) return; // gracefully no-op if unset
    const o = await db.order.findUnique({
      where: { id: orderId },
      include: { items: true, user: true },
    });
    if (!o) return;
    await bot.telegram.sendMessage(
      ENV.ADMIN_GROUP_CHAT_ID,
      `🆕 *New order*\n${orderDetails(o)}`,
      { parse_mode: 'Markdown' }
    );
  }

  static async notifyOrderStatus(bot: any, orderId: string, prev: string, next: string) {
  // --- fetch order with items and user
  const o = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: true },
  });
  if (!o) return;

  // ---------- USER DM (details + item list + buttons) ----------
  const itemsList = (o.items || []).map(it => `• ${esc(it.title)} ×${it.qty}`).join('\n') || '—';
  const lines = [
    `📦 Your order <b>#${esc(o.id.slice(0,6))}</b> status updated`,
    `<b>${esc(prev)}</b> → <b>${esc(next)}</b>`,
    '',
    '<b>Items</b>',
    itemsList,
    '',
    `<b>Total:</b> ${esc(money(o.total, o.currency))}`,
  ];
  if (o.shippingAddress) lines.push(`<b>Address:</b>\n${esc(o.shippingAddress)}`);
  if (next === 'shipped')   lines.push('🚚 Your package is on the way.');
  if (next === 'delivered') lines.push('🎉 Delivered — enjoy!');
  if (next === 'canceled')  lines.push('⚠️ This order was canceled. If this is unexpected, reply here.');

  // Build up to 3 “View item” buttons (callback to VIEW_ITEM_<productId>)
  const viewButtons = (o.items || [])
    .slice(0, 3)
    .map(it => [{ text: `🔎 ${it.title}`.slice(0, 30), callback_data: `VIEW_ITEM_${it.productId}` }]);

  try {
    await bot.telegram.sendMessage(
      o.userId,
      lines.join('\n'),
      {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: viewButtons.length ? { inline_keyboard: viewButtons } : undefined,
      }
    );
  } catch {}

  // ---------- ADMIN GROUP (same as before) ----------
  if (!ENV.ADMIN_GROUP_CHAT_ID) return;
  await bot.telegram.sendMessage(
    ENV.ADMIN_GROUP_CHAT_ID,
    `🔔 *Order status changed* ${prev} → *${next}*\n${orderDetails(o)}`,
    { parse_mode: 'Markdown' }
  );
}

}
