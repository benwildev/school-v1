import { prisma } from '../src/lib/db.ts';

async function main() {
  const indexes = await prisma.$queryRawUnsafe("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'enrollments'");
  console.log('Enrollment indexes:', indexes);

  const constraints = await prisma.$queryRawUnsafe("SELECT conname, contype, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'enrollments'::regclass");
  console.log('Enrollment constraints:', constraints);

  await prisma.$disconnect();
}

main().catch(console.error);
