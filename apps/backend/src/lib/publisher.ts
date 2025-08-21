// apps/backend/src/lib/publisher.ts
import { Markup, Telegraf } from 'telegraf';
import { db } from './db';
import { ENV } from '../config/env';
import { money } from './money';
import type { OrderStatus, Currency } from '@prisma/client';

function esc(s: any) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function toNum(v: any) {
  return v && typeof v === 'object' && 'toNumber' in v ? v.toNumber() : Number(v);
}
function asCurrency(c: any): string {
  return String(c as Currency);
}

function chooseImageInput(url?: string | null) {
  if (!url) return null;
  if (url.startsWith('tg:file_id:')) return url.replace(/^tg:file_id:/, '');
  if (/^https?:\/\//i.test(url)) return { url };
  return null;
}

function ensureTelegram(botOrCtx: any) {
  // Works with either Telegraf instance or ctx
  return botOrCtx?.telegram ?? botOrCtx;
}

function buyerLink(tgId: string, handle?: string | null, name?: string | null) {
  const label = handle ? `@${handle}` : (name || tgId);
  return `<a href="tg://user?id=${tgId}">${esc(label)}</a>`;
}

export const Publisher = {
  /**
   * Post a product to the group/channel configured in ENV.GROUP_CHAT_ID.
   * Uses the first ProductImage if present. Sends fresh message every time.
   */
  async postProduct(botOrCtx: Telegraf | any, productId: string) {
    const telegram = ensureTelegram(botOrCtx);
    const chatId = ENV.GROUP_CHAT_ID;
    if (!chatId) throw new Error('GROUP_CHAT_ID is not configured');

    const p = await db.product.findUnique({
      where: { id: productId },
      include: {
        images: { orderBy: { position: 'asc' } },
      },
    });
    if (!p) throw new Error('Product not found');

    const price = toNum(p.price);
    const cur = asCurrency(p.currency);
    const imgUrl = p.images[0]?.url || null;
    const input = chooseImageInput(imgUrl);

    const caption =
      `<b>${esc(p.title)}</b>\n` +
      (p.description ? `${esc(p.description)}\n` : '') +
      `Price: ${esc(money(price, cur))}\n` +
      `Stock: ${p.stock} ${p.active ? '' : '(inactive)'}`;

    const kb = Markup.inlineKeyboard([
      [
        Markup.button.callback('🛒 Add to Cart', `CART_ADD_${p.id}`),
        Markup.button.callback('⚡️ Buy Now', `BUY_${p.id}`),
      ],
    ]);

    if (input) {
      await telegram.sendPhoto(chatId, input as any, {
        caption,
        parse_mode: 'HTML',
        reply_markup: kb.reply_markup,
        disable_web_page_preview: true,
      });
    } else {
      await telegram.sendMessage(chatId, caption, {
        parse_mode: 'HTML',
        reply_markup: kb.reply_markup,
        disable_web_page_preview: true,
      });
    }
  },

  /**
   * "Upsert" product post — without persisted message ids we just post a fresh message.
   */
  async upsertProductPost(botOrCtx: Telegraf | any, productId: string) {
    return this.postProduct(botOrCtx, productId);
  },

  /**
   * Notify group about a new order.
   */
  async notifyOrderNew(botOrCtx: Telegraf | any, orderId: string) {
    const telegram = ensureTelegram(botOrCtx);
    const chatId = ENV.GROUP_CHAT_ID;
    if (!chatId) return; // best-effort

    const o = await db.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        items: true,
        address: true,
      },
    });
    if (!o) return;

    const itemsList =
      (o.items || [])
        .map(it => `• ${esc(it.titleSnapshot ?? 'Item')} ×${it.quantity}`)
        .join('\n') || '—';

    const lines: string[] = [
      `🆕 <b>New order</b> #${esc(o.id.slice(0, 6))}`,
      `<b>Buyer:</b> ${buyerLink(o.userId, o.user?.username, o.user?.name)}`,
      `<b>Status:</b> ${esc(o.status)}`,
      `<b>Total:</b> ${esc(money(toNum(o.total), asCurrency(o.currency)))}`,
      `<b>Items:</b>\n${itemsList}`,
    ];

    if (o.user?.phone) lines.push(`<b>Phone:</b> ${esc(o.user.phone)}`);

    if (o.address) {
      const addrMain = [o.address.city, o.address.line1].filter(Boolean).join(', ');
      const addrRef = o.address.line2 ? `\nRef: ${o.address.line2}` : '';
      lines.push(`<b>Address:</b>\n${esc(addrMain + addrRef)}`);
    }

    const buttons =
      (o.items || []).slice(0, 3).map(it => [
        { text: `🔎 ${(it.titleSnapshot ?? 'Item').slice(0, 30)}`, callback_data: `VIEW_ITEM_${it.productId}` },
      ]);

    await telegram.sendMessage(chatId, lines.join('\n'), {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons },
      disable_web_page_preview: true,
    });
  },

  /**
   * Notify group that an order changed status.
   */
  async notifyOrderStatus(botOrCtx: Telegraf | any, orderId: string, from: OrderStatus, to: OrderStatus) {
    const telegram = ensureTelegram(botOrCtx);
    const chatId = ENV.GROUP_CHAT_ID;
    if (!chatId) return; // best-effort

    const o = await db.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });
    if (!o) return;

    const msg =
      `🔔 Order #${esc(o.id.slice(0, 6))} ` +
      `for ${buyerLink(o.userId, o.user?.username, o.user?.name)} ` +
      `changed: <b>${esc(from)} → ${esc(to)}</b>`;

    await telegram.sendMessage(chatId, msg, { parse_mode: 'HTML' });
  },
};
