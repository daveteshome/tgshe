import { mainMenuKb } from '../keyboards/main';
import { UsersService } from '../../services/users.service';

export const registerCommonHandlers = (bot: any) => {
  bot.start(async (ctx: any) => {
    const tgId = String(ctx.from.id);
    const name = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');
    await UsersService.ensure(tgId, name);
    await ctx.reply('Welcome to the shop! Choose an option:', mainMenuKb);
  });

  bot.action('HELP', async (ctx: any) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      'Use “View Products” to browse by category. “My Orders” shows your past orders.\n' +
      'Buying now creates a pending order (no payment yet).'
    );
  });
};
