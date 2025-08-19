import { db } from '../lib/db';

export const UsersService = {
  ensure(tgId: string, name?: string) {
    return db.user.upsert({
      where: { tgId },
      update: { name },
      create: { tgId, name },
    });
  }
};
