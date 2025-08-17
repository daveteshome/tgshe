import { Markup } from 'telegraf';
import { db } from '../../../lib/db';
import { OrdersService } from '../../../services/orders.service';
import { money } from '../../../lib/money';

// ---- Helpers / small state machine ----
type Step = 'idle' | 'need_phone' | 'need_city' | 'need_place' | 'need_ref' | 'confirm_address';
type CheckoutState = { step: Step; draft: { city?: string; place?: string; ref?: string } };
const states = new Map<string, CheckoutState>(); // key = tgId

const awaitingPhone = new Set<string>(); // we keep this separate because Telegram contact events are global

function tgIdOf(ctx: any): string {
  const id = ctx.from?.id;
  if (!id) throw new Error('No from.id');
  return String(id);
}

function setState(id: string, s: CheckoutState) { states.set(id, s); }
function getState(id: string) { return states.get(id); }
function clearState(id: string) { states.delete(id); awaitingPhone.delete(id); }

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

// ---- Main flow ----
export function registerCheckoutFlow(bot: any, adminIds: string[] = []) {
  // ENTRY: From cart footer
  bot.action('CHECKOUT', async (ctx: any) => {
    await ctx.answerCbQuery();
    const id = tgIdOf(ctx);
    const user = await db.user.findUnique({ where: { tgId: id } });

    if (!user) return ctx.reply('Please /start first.');

    if (!user.phone) {
      setState(id, { step: 'need_phone', draft: {} });
      return askPhone(ctx, id);
    }

    const needsCity = !user.city;
    const needsPlace = !user.place;
    const needsRef = !user.specialReference;

    if (needsCity || needsPlace || needsRef) {
      const nextStep: Step = needsCity ? 'need_city' : needsPlace ? 'need_place' : 'need_ref';
      setState(id, { step: nextStep, draft: {} });
      if (nextStep === 'need_city') return askCity(ctx);
      if (nextStep === 'need_place') return askPlace(ctx);
      return askRef(ctx);
    }

    // Have phone + full address → confirm
    setState(id, { step: 'confirm_address', draft: {} });
    return showConfirm(ctx, user);
  });

    // PHONE via contact
  bot.on('contact', async (ctx: any) => {
    const id = tgIdOf(ctx);
    if (!awaitingPhone.has(id)) return;

    const phone = ctx.message?.contact?.phone_number;
    if (!phone) return;

    awaitingPhone.delete(id);
    await db.user.update({ where: { tgId: id }, data: { phone } });

    try { await ctx.reply('✅ Phone saved!', Markup.removeKeyboard()); } catch {}

    // ---- NEW: immediately continue to address step (or confirm if already present)
    const user = await db.user.findUnique({ where: { tgId: id } });

    // Guard: if somehow user is missing, restart flow safely
    if (!user) {
      setState(id, { step: 'need_city', draft: {} });
      return askCity(ctx);
    }

    const needsCity = !user.city;
    const needsPlace = !user.place;
    const needsRef = !user.specialReference;

    if (needsCity || needsPlace || needsRef) {
      const nextStep: Step = needsCity ? 'need_city' : needsPlace ? 'need_place' : 'need_ref';
      setState(id, { step: nextStep, draft: {} });

      if (nextStep === 'need_city') return askCity(ctx);
      if (nextStep === 'need_place') return askPlace(ctx);
      return askRef(ctx);
    }

    // All address parts already exist → confirm/edit
    setState(id, { step: 'confirm_address', draft: {} });
    return showConfirm(ctx, user);
  });


  // ADDRESS text capture (city → place → ref)
  bot.on('text', async (ctx: any, next: any) => {
    const id = tgIdOf(ctx);
    const st = getState(id);
    if (!st) return next();

    const text = String(ctx.message.text || '').trim();
    if (!text) return next();

    if (st.step === 'need_city') {
      st.draft.city = text;
      st.step = 'need_place';
      setState(id, st);
      return askPlace(ctx);
    }

    if (st.step === 'need_place') {
      st.draft.place = text;
      st.step = 'need_ref';
      setState(id, st);
      return askRef(ctx);
    }

    if (st.step === 'need_ref') {
      st.draft.ref = text;

      // Persist to User
      await db.user.update({
        where: { tgId: id },
        data: {
          city: st.draft.city,
          place: st.draft.place,
          specialReference: st.draft.ref,
        },
      });

      st.step = 'confirm_address';
      setState(id, st);

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
      const order = await OrdersService.checkoutFromCartWithDetails(id, { shippingAddress });
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

      // Admin notifications (best-effort)
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
