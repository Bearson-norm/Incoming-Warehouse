const path = require('path');
const apiPath = path.resolve(__dirname, '../../Dashboard/api');
const { PrismaClient } = require(path.join(apiPath, 'node_modules', '@prisma/client'));
const bcrypt = require(path.join(apiPath, 'node_modules', 'bcrypt'));

async function main() {
  const password = process.env.ADMIN_INITIAL_PASSWORD?.trim() || 'admin123';
  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        passwordHash,
        role: 'admin',
      },
    });

    const vendor =
      (await prisma.vendor.findFirst({ where: { name: 'Sample Vendor' } })) ||
      (await prisma.vendor.create({ data: { name: 'Sample Vendor' } }));

    const existingPackaging = await prisma.packaging.findFirst({
      where: { vendorId: vendor.id, name: 'Box Small' },
    });
    if (!existingPackaging) {
      await prisma.packaging.create({
        data: {
          vendorId: vendor.id,
          name: 'Box Small',
          tareWeight: 0.5,
          metadata: JSON.stringify({ size: 'small', type: 'box' }),
        },
      });
    }

    console.log('[sqlite-template] Seeded admin / injected password');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
