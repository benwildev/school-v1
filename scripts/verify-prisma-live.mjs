import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing Prisma Client connection to live Neon PostgreSQL database...');
  const schoolsCount = await prisma.school.count();
  console.log(`✓ Prisma Client connected successfully! Total Schools registered: ${schoolsCount}`);
  
  const tablesCount = await prisma.subscriptionPlan.count();
  console.log(`✓ Subscription plans count: ${tablesCount}`);
  
  await prisma.$disconnect();
  console.log('✓ All Prisma live tests passed!');
}

main().catch(async (e) => {
  console.error('❌ Prisma test error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
