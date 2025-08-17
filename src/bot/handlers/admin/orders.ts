// src/bot/handlers/admin/orders.ts
import { Markup } from 'telegraf';
import { OrdersService } from '../../../services/orders.service';
import { money } from '../../../lib/money';
import { isAdmin } from '../../middlewares/isAdmin';
import { db } from '../../../lib/db';
import { Publisher } from '../../../lib/publisher';


import { formatUserLabel } from '../../format/user';

// Helper: build per-status action buttons
function adminButtonsFor(status: string, orderId: string) {
  const btn = (to: string) => Markup.button.callback(to, `A_SET_${orderId}_${to}`);

  switch (status) {
    case 'pending':
      return Markup.inlineKeyboard([
        [btn('confirmed'), btn('shipped'), btn('delivered')],
        [btn('canceled')],
      ]);
    case 'confirmed':
      return Markup.inlineKeyboard([[btn('shipped'), btn('canceled')]]);
    case 'shipped':
      return Markup.inlineKeyboard([[btn('delivered'), btn('canceled')]]);
    default:
      return Markup.inlineKeyboard([]); // delivered/canceled -> no actions
  }
}

function userLabel(o: any) {
  // prefer @username; else name; else the id
  const handle = o.user?.username ? `@${o.user.username}` : (o.user?.name || o.userId);
  // make it clickable (works even if no username)
  return `<a href="tg://user?id=${o.userId}">${handle}</a>`;
}

export const registerAdminOrders = (bot: any) => {
  // /admin menu
  bot.command('admin', isAdmin(), async (ctx: any) => {
    await ctx.reply(
      '🛠 Admin Panel',
      Markup.inlineKeyboard([
        [Markup.button.callback('🕗 Pending', 'A_ORDERS_pending')],
        [Markup.button.callback('✅ Confirmed', 'A_ORDERS_confirmed')],
        [Markup.button.callback('📦 Shipped', 'A_ORDERS_shipped')],
        [Markup.button.callback('📬 Delivered', 'A_ORDERS_delivered')],
        [Markup.button.callback('📚 All (recent)', 'A_ORDERS_all')],
        [Markup.button.callback('🧩 Products', 'A_PROD_LIST_1')],
        [Markup.button.callback('➕ New Product', 'A_PROD_NEW')],
      ])
    );
  });

  // List by status
   bot.action(/A_ORDERS_(pending|confirmed|shipped|delivered)/, isAdmin(), async (ctx: any) => {
    await ctx.answerCbQuery();
    const status = ctx.match[1];
    const orders = await OrdersService.listByStatus(status, 10);
    if (!orders.length) return ctx.reply(`No ${status} orders.`);

    for (const o of orders) {
      const lines = o.items.map((it: any) => `• ${it.title} x${it.qty}`).join('\n');
      await ctx.reply(
        `#${o.id.slice(0,6)} | ${userLabel(o)}\n` +
        `Status: ${o.status}\n` +
        `Total: ${money(o.total, o.currency)}\n\n` +
        `${lines}`,
        {
          ...adminButtonsFor(o.status, o.id),
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }
      );
    }
  });

  // Optional "All recent"
  bot.action('A_ORDERS_all', isAdmin(), async (ctx: any) => {
    await ctx.answerCbQuery();
    const orders = await OrdersService.listByStatus(undefined as any, 10); // implement a listRecent() in service if you prefer
    if (!orders?.length) return ctx.reply('No recent orders.');

    for (const o of orders) {
        const userLabel = o.user ? formatUserLabel(o.user) : o.userId; // service must include user
        const lines = o.items.map((it: any) => `• ${it.title} x${it.qty}`).join('\n');

        await ctx.reply(
            `#${o.id.slice(0,6)} | ${userLabel}\nStatus: ${o.status}\nTotal: ${money(o.total, o.currency)}\n${lines}`,
            {
            ...adminButtonsFor(o.status, o.id),
            parse_mode: 'HTML', // 👈 so the <a href="tg://user?id=..."> works
            disable_web_page_preview: true,
            }
        );
    }    
  });

  // Status updates
  // Status updates
bot.action(/A_SET_([a-z0-9]+)_(pending|confirmed|shipped|delivered|canceled)/, isAdmin(), async (ctx: any) => {
  await ctx.answerCbQuery();
  const [, id, next] = ctx.match;

  // Load current order to know the user & current status
  const before = await db.order.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!before) return ctx.reply('Order not found');

  try {
    // Transition (guards + stock decrement handled inside service)
    await OrdersService.setStatus(id, next);

    await ctx.reply(`✅ Order ${id.slice(0,6)} → ${next}`);

    // DM the buyer about the change (best-effort)
    try {
      await ctx.telegram.sendMessage(
        before.userId,
        `📦 Your order #${id.slice(0,6)} is now *${next}*.`,
        { parse_mode: 'Markdown' }
      );
    } catch {}

    // Notify admin group about the change (best-effort)
    try {
      await Publisher.notifyOrderStatus(ctx.bot ?? ctx, id, before.status, next);
    } catch {}

  } catch (e: any) {
    await ctx.reply(`❌ ${e.message || 'Failed to update status'}`);
  }
});

};
