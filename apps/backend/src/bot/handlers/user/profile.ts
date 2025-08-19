import { Markup } from 'telegraf';
import { db } from '../../../lib/db';

export const registerProfileHandlers = (bot: any) => {
  // /profile → show & edit
  bot.command('profile', async (ctx: any) => {
    const tgId = String(ctx.from.id);
    const user = await db.user.findUnique({ where: { tgId } });
    await ctx.reply(
      `👤 Your profile\nPhone: ${user?.phone ?? '—'}`,
      Markup.inlineKeyboard([
        [Markup.button.callback('📱 Set/Change phone', 'SET_PHONE')],
      ])
    );
  });

  // ask for contact using Telegram’s native button
  bot.action('SET_PHONE', async (ctx: any) => {
    await ctx.answerCbQuery();
    await ctx.reply(
      'Tap the button to share your phone number:',
      Markup.keyboard([Markup.button.contactRequest('Share phone 📲')])
        .oneTime()
        .resize()
    );
  });

  // handle phone share
  bot.on('contact', async (ctx: any) => {
    const tgId = String(ctx.from.id);
    const phone = ctx.message.contact?.phone_number;
    if (!phone) return;
    await db.user.update({ where: { tgId }, data: { phone } });
    await ctx.reply('✅ Phone saved!', Markup.removeKeyboard());
  });
};
