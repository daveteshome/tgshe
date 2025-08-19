// src/bot/handlers/user/checkout.ts
import { Markup } from 'telegraf';
import { db } from '../../../lib/db';
import { OrdersService } from '../../../services/orders.service';
import { money } from '../../../lib/money';
import { Publisher } from '../../../lib/publisher';

// ---- Helpers / small state machine ----
type Mode = 'cart' | 'buy_now';
type Step = 'idle' | 'need_phone' | 'need_city' | 'need_place' | 'need_ref' | 'confirm_address';

type CheckoutState = {
  mode: Mode;
  product?: { id: string; title: string; price: number; currency: string }; // only for buy-now
  step: Step;
  draft: { city?: string; place?: string; ref?: string };
};

const states = new Map<string, CheckoutState>(); // key = tgId
const awaitingPhone = new Set<string>(); // contact events are global in Telegram

function tgIdOf(ctx: any): string {
  const id = ctx.from?.id;
  if (!id) throw new Error('No from.id');
  return String(id);
}

// SAFE helpers: merge patches and provide defaults so older calls keep working
function ensure(state?: Partial<CheckoutState>): CheckoutState {
  return {
    mode: state?.mode ?? 'cart',
    step: state?.step ?? 'idle',
    draft: state?.draft ?? {},
    product: state?.product,
  };
}
function setState(id: string, patch: Partial<CheckoutState>) {
  const prev = states.get(id);
  const next = ensure({ ...prev, ...patch });
  states.set(id, next);
}
function getState(id: string) {
  const s = states.get(id);
  return s ? ensure(s) : undefined;
}
function clearState(id: string) {
  states.delete(id);
  awaitingPhone.delete(id);
}

function formatAddress(u: { city?: string | null; place?: string | null; specialReference?: string | null }) {
  const main = [u.city, u.place].filter(Boolean).join(', ');
  const ref = u.specialReference ? `\nRef: ${u.specialReference}` : '';
  return (main || '—') + ref;
}

async function askPhone(ctx: any, id: string) {
  awaitingPhone.add(id);
  return ctx.reply(
    '📞 Please share your phone number to continue.',
    Markup.keyboard([[Markup.button.contactRequest('📱 Share phone')], ['❌ Cancel']]).oneTime().resize()
  );
}

async function askCity(ctx: any) { return ctx.reply('🏙️ Which *city* should we deliver to?', { parse_mode: 'Markdown' }); }
async function askPlace(ctx: any) { return ctx.reply('📍 Which *area/place* (e.g., neighborhood)?', { parse_mode: 'Markdown' }); }
async function askRef(ctx: any) { return ctx.reply('🧭 Any *special reference* / landmark for directions?', { parse_mode: 'Markdown' }); }

async function showConfirm(ctx: any, user: any) {
  return ctx.reply(
    `✅ Details found:\n\n*Phone:* ${user.phone || '—'}\n*Address:*\n${formatAddress(user)}`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Use as is', 'CHK_USE_ADDR')],
        [Markup.button.callback('✏️ Edit address', 'CHK_EDIT_ADDR')],
      ])
    }
  );
}

/** NEW: after we have (or just saved) a phone, go straight to address steps or confirm */
async function proceedToAddressOrConfirm(ctx: any, id: string) {
  const user = await db.user.findUnique({ where: { tgId: id } });
  if (!user) {
    setState(id, { step: 'need_city' });
    return askCity(ctx);
  }

  const needsCity  = !user.city;
  const needsPlace = !user.place;
  const needsRef   = !user.specialReference;

  if (needsCity || needsPlace || needsRef) {
    const nextStep: Step = needsCity ? 'need_city' : (needsPlace ? 'need_place' : 'need_ref');
    setState(id, { step: nextStep });
    if (nextStep === 'need_city')  return askCity(ctx);
    if (nextStep === 'need_place') return askPlace(ctx);
    return askRef(ctx);
  }

  setState(id, { step: 'confirm_address' });
  return showConfirm(ctx, user);
}

// ---- Main flow ----
export function registerCheckoutFlow(bot: any, adminIds: string[] = []) {
  // ENTRY (Cart): From cart footer
  bot.action('CHECKOUT', async (ctx: any) => {
    await ctx.answerCbQuery();
    const id = tgIdOf(ctx);
    setState(id, { mode: 'cart', step: 'idle', draft: {} });

    const user = await db.user.findUnique({ where: { tgId: id } });
    if (!user) return ctx.reply('Please /start first.');

    if (!user.phone) {
      setState(id, { step: 'need_phone' });
      return askPhone(ctx, id);
    }

    // ✅ Go straight into address steps/confirm
    return proceedToAddressOrConfirm(ctx, id);
  });

  // ENTRY (Buy Now): from product card button
  bot.action(/BUY_(.+)/, async (ctx: any) => {
    await ctx.answerCbQuery();
    const id = tgIdOf(ctx);
    const productId = ctx.match[1];

    const p = await db.product.findUnique({ where: { id: productId } });
    if (!p || !p.isActive) return ctx.reply('This product is unavailable.');

    // seed buy-now state
    setState(id, {
      mode: 'buy_now',
      product: { id: p.id, title: p.title, price: p.price, currency: p.currency },
      step: 'idle',
      draft: {},
    });

    const user = await db.user.findUnique({ where: { tgId: id } });

    if (!user?.phone) {
      setState(id, { step: 'need_phone' });
      return askPhone(ctx, id);
    }

    // ✅ Go straight into address steps/confirm
    return proceedToAddressOrConfirm(ctx, id);
  });

  // PHONE via contact
  bot.on('contact', async (ctx: any) => {
    const id = tgIdOf(ctx);
    if (!awaitingPhone.has(id)) return;

    const phone = ctx.message?.contact?.phone_number;
    if (!phone) return;

    // (optional) make sure they shared their own contact
    const contactUserId = String(ctx.message?.contact?.user_id || '');
    if (contactUserId && contactUserId !== id) {
      return ctx.reply('Please share *your* contact using the button.', { parse_mode: 'Markdown' });
    }

    awaitingPhone.delete(id);
    await db.user.update({ where: { tgId: id }, data: { phone } });

    try { await ctx.reply('✅ Phone saved!', Markup.removeKeyboard()); } catch {}

    // ✅ Immediately continue (no extra "Checkout" tap)
    return proceedToAddressOrConfirm(ctx, id);
  });

  // ADDRESS text capture (city → place → ref)
  bot.on('text', async (ctx: any, next: any) => {
    const id = tgIdOf(ctx);
    const st = getState(id);
    if (!st) return next();

    const text = String(ctx.message.text || '').trim();
    if (!text) return next();

    if (st.step === 'need_city') {
      setState(id, { draft: { ...st.draft, city: text }, step: 'need_place' });
      return askPlace(ctx);
    }

    if (st.step === 'need_place') {
      setState(id, { draft: { ...st.draft, place: text }, step: 'need_ref' });
      return askRef(ctx);
    }

    if (st.step === 'need_ref') {
      const draft = { ...st.draft, ref: text };

      // Persist to User
      await db.user.update({
        where: { tgId: id },
        data: {
          city: draft.city,
          place: draft.place,
          specialReference: draft.ref,
        },
      });

      setState(id, { draft, step: 'confirm_address' });

      const user = await db.user.findUnique({ where: { tgId: id } });
      return ctx.reply(
        `📦 Address saved:\n*${formatAddress(user!)}*`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Use this address', 'CHK_USE_ADDR')],
            [Markup.button.callback('✏️ Edit address', 'CHK_EDIT_ADDR')],
          ])
        }
      );
    }

    return next();
  });

  // Confirm / Edit buttons
  bot.action('CHK_USE_ADDR', async (ctx: any) => {
    await ctx.answerCbQuery();
    const id = tgIdOf(ctx);
    const user = await db.user.findUnique({ where: { tgId: id } });
    if (!user) return ctx.reply('Please /start first.');

    const shippingAddress = formatAddress(user);
    try {
      const st = getState(id);
      if (!st) return ctx.reply('Session expired. Please try again.');

      let order;
      if (st.mode === 'buy_now') {
        if (!st.product) return ctx.reply('Product missing. Please try again.');
        order = await OrdersService.createSingleItemPending(id, st.product, { shippingAddress });
      } else {
        order = await OrdersService.checkoutFromCartWithDetails(id, { shippingAddress });
      }

      // notify admin group (best-effort)
      try { await Publisher.notifyOrderNew(ctx.bot ?? ctx, order.id); } catch {}

      clearState(id);

      await ctx.editMessageText(
        `✅ Order placed!\n` +
        `#${order.id.slice(0,6)}\n` +
        `Total: ${money(order.total, order.currency)}\n` +
        `Status: ${order.status}\n` +
        `Phone: ${user.phone || '—'}\n` +
        `Address:\n${shippingAddress}`,
        { parse_mode: 'Markdown' }
      );

      // Optional: per-admin DM loop if you want
      for (const admin of adminIds) {
        try {
          await ctx.telegram.sendMessage(
            admin,
            `🆕 Order #${order.id.slice(0,6)} from tg:${id}\nTotal: ${money(order.total, order.currency)}\nStatus: ${order.status}`
          );
        } catch {}
      }
    } catch (e: any) {
      await ctx.answerCbQuery(`❌ ${e.message || 'Failed'}`, { show_alert: true });
    }
  });

  bot.action('CHK_EDIT_ADDR', async (ctx: any) => {
    await ctx.answerCbQuery();
    const id = tgIdOf(ctx);
    setState(id, { step: 'need_city', draft: {} });
    return ctx.editMessageText('✏️ Let’s update your address.\nWhat *city*?', { parse_mode: 'Markdown' });
  });
}
