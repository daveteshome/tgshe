// prisma/seed.ts
import { PrismaClient, Prisma, $Enums } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  // 1) Create the first shop (tenant)
  const tenant = await db.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      slug: 'demo',
      name: 'Demo Shop',
    },
  });

  // 2) A test shopper (update tgId if you want)
  const user = await db.user.upsert({
    where: { tgId: '389755264' },
    update: { name: 'Dawit', username: 'DawitTAlemu' },
    create: {
      tgId: '389755264',
      name: 'Dawit',
      username: 'DawitTAlemu',
      phone: '+251900000000',
    },
  });

  // 3) Default address for the test user (scoped to tenant)
  await db.address.upsert({
    where: {
      // @@unique([tenantId, userId, label])
      tenantId_userId_label: { tenantId: tenant.id, userId: user.tgId, label: 'Home' },
    },
    update: { isDefault: true },
    create: {
      tenantId: tenant.id,
      userId: user.tgId,
      label: 'Home',
      line1: 'Bole, Woreda 03',
      city: 'Addis Ababa',
      region: 'AA',
      country: 'Ethiopia',
      isDefault: true,
    },
  });

  // 4) Catalog (ETB), with images and simple variants
  const p1 = await db.product.create({
    data: {
      tenantId: tenant.id,
      title: 'Classic T-Shirt',
      description: 'Soft cotton tee for everyday wear.',
      sku: 'TSHIRT-CLSC-001',
      price: new Prisma.Decimal('799.00'),
      currency: $Enums.Currency.ETB,
      stock: 50,
      active: true,
      images: {
        create: [
          { tenantId: tenant.id, url: 'https://picsum.photos/seed/t1/800/800', alt: 'Front' },
          { tenantId: tenant.id, url: 'https://picsum.photos/seed/t2/800/800', alt: 'Back' },
        ],
      },
      variants: {
        create: [
          { tenantId: tenant.id, name: 'Size M', sku: 'TSHIRT-CLSC-001-M', stock: 20 },
          { tenantId: tenant.id, name: 'Size L', sku: 'TSHIRT-CLSC-001-L', stock: 15 },
        ],
      },
    },
  });

  const p2 = await db.product.create({
    data: {
      tenantId: tenant.id,
      title: 'Leather Wallet',
      description: 'Minimal bi-fold wallet, handcrafted.',
      sku: 'WALLET-LEA-001',
      price: new Prisma.Decimal('1599.00'),
      currency: $Enums.Currency.ETB,
      stock: 25,
      active: true,
      images: {
        create: [{ tenantId: tenant.id, url: 'https://picsum.photos/seed/w1/800/800', alt: 'Angle' }],
      },
    },
  });

  const p3 = await db.product.create({
    data: {
      tenantId: tenant.id,
      title: 'Stainless Bottle 750ml',
      description: 'Insulated bottle that keeps drinks cold/hot.',
      sku: 'BOTTLE-SSL-750',
      price: new Prisma.Decimal('999.00'),
      currency: $Enums.Currency.ETB,
      stock: 40,
      active: true,
      images: {
        create: [{ tenantId: tenant.id, url: 'https://picsum.photos/seed/b1/800/800', alt: 'Bottle' }],
      },
    },
  });

  // 5) A ready-to-test cart (composite unique: tenantId_userId)
  const cart = await db.cart.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.tgId } },
    update: { updatedAt: new Date() },
    create: { tenantId: tenant.id, userId: user.tgId },
  });

  // Add a couple items (one with variant)
  const tshirtM = await db.productVariant.findFirst({
    where: { tenantId: tenant.id, productId: p1.id, name: 'Size M' },
  });

  await db.cartItem.createMany({
    data: [
      {
        tenantId: tenant.id,
        cartId: cart.id,
        productId: p1.id,
        variantId: tshirtM?.id ?? null,
        quantity: 1,
        unitPrice: new Prisma.Decimal('799.00'),
        currency: $Enums.Currency.ETB,
      },
      {
        tenantId: tenant.id,
        cartId: cart.id,
        productId: p2.id,
        quantity: 2,
        unitPrice: new Prisma.Decimal('1599.00'),
        currency: $Enums.Currency.ETB,
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Seeded tenant:', tenant.slug);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
  });
