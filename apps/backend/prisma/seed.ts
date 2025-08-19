// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const PLACEHOLDER = 'https://placehold.co/800x500/png?text=Product';

async function main() {
  // 1) Categories (idempotent via upsert)
  const catNames = ['T-Shirts', 'Mugs', 'Hoodies', 'Stickers'];
  const categories = await Promise.all(
    catNames.map((name) =>
      db.category.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    )
  );

  const catByName = Object.fromEntries(categories.map((c) => [c.name, c]));

  // 2) Products (createMany + skipDuplicates keeps it idempotent by unique (id) only,
  // so we’ll key on title uniqueness instead: check existing titles first)
  const existing = await db.product.findMany({ select: { title: true } });
  const existingTitles = new Set(existing.map((p) => p.title));

  const products = [
    { title: 'Classic Tee',   price: 1999, currency: 'USD', stock: 50,  categoryId: catByName['T-Shirts'].id, photoUrl: PLACEHOLDER, isActive: true },
    { title: 'Logo Tee',      price: 2499, currency: 'USD', stock: 40,  categoryId: catByName['T-Shirts'].id, photoUrl: PLACEHOLDER, isActive: true },
    { title: 'Comfy Hoodie',  price: 3999, currency: 'USD', stock: 25,  categoryId: catByName['Hoodies'].id,  photoUrl: PLACEHOLDER, isActive: true },
    { title: 'Logo Mug',      price: 1299, currency: 'USD', stock: 120, categoryId: catByName['Mugs'].id,     photoUrl: PLACEHOLDER, isActive: true },
    { title: 'Travel Mug',    price: 1499, currency: 'USD', stock: 80,  categoryId: catByName['Mugs'].id,     photoUrl: PLACEHOLDER, isActive: true },
    { title: 'Vinyl Sticker', price:  499, currency: 'USD', stock: 300, categoryId: catByName['Stickers'].id, photoUrl: PLACEHOLDER, isActive: true },
  ];

  const toCreate = products.filter((p) => !existingTitles.has(p.title));
  if (toCreate.length > 0) {
    await db.product.createMany({
      data: toCreate,
      skipDuplicates: true, // safe if titles repeat in the input
    });
  }

  console.log(`Seed done. Categories: ${categories.length}, new products: ${toCreate.length}`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
