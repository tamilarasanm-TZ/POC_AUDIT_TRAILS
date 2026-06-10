import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminPass = await bcrypt.hash('admin123', 10);
  const userPass = await bcrypt.hash('user123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash: adminPass,
      name: 'Admin User',
      role: Role.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      passwordHash: userPass,
      name: 'Regular User',
      role: Role.USER,
    },
  });

  console.log('Seed complete. Logins:');
  console.log('  admin@example.com / admin123');
  console.log('  user@example.com  / user123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
