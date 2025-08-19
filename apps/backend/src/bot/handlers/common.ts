// src/bot/handlers/common.ts
import { mainMenuKb } from '../keyboards/main';
import { UsersService } from '../../services/users.service';
import { Markup } from 'telegraf';               // ← add this
import { ENV } from '../../config/env';          // ← add this

export const registerCommonHandlers = (bot: any) => {
  bot.start(async (ctx: any) => {
    const tgId = String(ctx.from.id);
    const name = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');
    await UsersService.ensure(tgId, name);

    // keep your existing menu keyboard
    await ctx.reply('Welcome to the shop! Choose an option:', mainMenuKb);

    // add a one-off inline WebApp button (opens your Vite app inside Telegram)
    await ctx.reply(
      'Or open the WebApp storefront:',
      Markup.inlineKeyboard([
        Markup.button.webApp('🛍️ Open Shop', ENV.WEBAPP_URL)
      ])
    );
  });

  bot.action('HELP', async (ctx: any) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      'Use “View Products” to browse by category. “My Orders” shows your past orders.\n' +
      'Buying now creates a pending order (no payment yet).'
    );
  });
};
