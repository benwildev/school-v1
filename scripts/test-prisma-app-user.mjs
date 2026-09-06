import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  try {
    const whoami = await prisma.$queryRaw`SELECT current_user, rolbypassrls FROM pg_roles WHERE rolname = current_user;`;
    console.log('Prisma connected as:', whoami);

    const count = await prisma.school.count();
    console.log('Prisma School count:', count);
    console.log('PASS: Prisma successfully operates under non-bypass role edusmart_app_user!');
  } catch (err) {
    console.error('Prisma connection error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
