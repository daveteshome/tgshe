// src/bot/handlers/user/checkout.ts
import { Markup } from 'telegraf';
import { db } from '../../../lib/db';
import { OrdersService } from '../../../services/orders.service';
import { money } from '../../../lib/money';

// Track per-user steps
const awaitingPhone = new Set<string>();
const awaitingAddress = new Set<string>();

function askForPhone(ctx: any, tgId: string) {
  awaitingPhone.add(tgId);
  // Contact request needs a ReplyKeyboard (not inline)
  return ctx.reply(
    'Please share your phone number to proceed:',
    Markup.keyboard([Markup.button.contactRequest('Share phone 📲')])
      .oneTime()
      .resize()
  );
}

function askForAddress(ctx: any, tgId: string) {
  awaitingAddress.add(tgId);
  return ctx.reply(
    'Great! Now send your delivery address or note (one message).',
    { reply_markup: { force_reply: true, selective: true } }
  );
}

export function registerCheckoutFlow(bot: any, adminIds: string[] = []) {
  // Entry point from cart footer
  bot.action('CHECKOUT', async (ctx: any) => {
    await ctx.answerCbQuery();
    const tgId = String(ctx.from.id);
    const user = await db.user.findUnique({ where: { tgId } });

    if (!user?.phone) {
      return askForPhone(ctx, tgId);
    }
    return askForAddress(ctx, tgId);
  });

  // Handle contact share (comes from the ReplyKeyboard button)
  bot.on('contact', async (ctx: any) => {
    const tgId = String(ctx.from.id);
    if (!awaitingPhone.has(tgId)) return; // ignore unrelated contacts

    const phone = ctx.message?.contact?.phone_number;
    if (!phone) return;

    // Save phone and proceed
    awaitingPhone.delete(tgId);
    await db.user.update({ where: { tgId }, data: { phone } });

    // Remove the reply keyboard
    try { await ctx.reply('✅ Phone saved!', Markup.removeKeyboard()); } catch {}

    // Continue to address automatically
    return askForAddress(ctx, tgId);
  });

  // Capture address reply → place order
  bot.on('message', async (ctx: any) => {
    const tgId = String(ctx.from.id);
    // Only handle replies when we are waiting for an address
    if (!awaitingAddress.has(tgId)) return;
    if (!ctx.message?.reply_to_message) return;

    awaitingAddress.delete(tgId);
    const shippingAddress = String(ctx.message.text || '').trim().slice(0, 500) || null;

    try {
      const order = await OrdersService.checkoutFromCartWithDetails(tgId, { shippingAddress });
      const freshUser = await db.user.findUnique({ where: { tgId } });

      await ctx.reply(
        `✅ Order placed!\n` +
        `#${order.id.slice(0,6)}\n` +
        `Total: ${money(order.total, order.currency)}\n` +
        `Status: ${order.status}\n` +
        `Phone: ${freshUser?.phone || '—'}\n` +
        `Address: ${shippingAddress || '—'}`
      );

      // Notify admins (best-effort)
      for (const id of adminIds) {
        try {
          await ctx.telegram.sendMessage(
            id,
            `🆕 Order #${order.id.slice(0,6)} from tg:${tgId}\nTotal: ${money(order.total, order.currency)}\nStatus: ${order.status}`
          );
        } catch {}
      }
    } catch (e: any) {
      await ctx.reply(`❌ Checkout failed: ${e.message || 'unknown error'}`);
    }
  });
}
