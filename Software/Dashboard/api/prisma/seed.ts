import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const isProd = process.env.NODE_ENV === 'production';
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD?.trim();
  if (!adminPassword && isProd) {
    throw new Error('ADMIN_INITIAL_PASSWORD is required to seed in production.');
  }

  const password = adminPassword || 'admin123';
  const adminPasswordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      role: 'admin',
    },
  });

  console.log('Created admin user:', admin.username);

  const existingVendor = await prisma.vendor.findFirst({
    where: { name: 'Sample Vendor' },
  });
  const vendor =
    existingVendor ??
    (await prisma.vendor.create({
      data: { name: 'Sample Vendor' },
    }));

  console.log('Created vendor:', vendor.name);

  const existingRm = await prisma.rmCode.findFirst({
    where: { code: 'RM-SAMPLE' },
  });
  if (!existingRm) {
    await prisma.rmCode.create({
      data: { code: 'RM-SAMPLE', name: 'Sample Raw Material' },
    });
  }

  const existingPackaging = await prisma.packaging.findFirst({
    where: { vendorId: vendor.id, name: 'Box Small' },
  });
  if (!existingPackaging) {
    await prisma.packaging.create({
      data: {
        vendorId: vendor.id,
        name: 'Box Small',
        tareWeight: 0.5,
        metadata: JSON.stringify({
          size: 'small',
          type: 'box',
        }),
      },
    });
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
