import { Telegraf } from 'telegraf';
import { ENV } from '../config/env';

export const bot = new Telegraf(ENV.BOT_TOKEN);
