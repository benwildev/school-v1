import { prisma } from '../src/lib/db.ts';

async function main() {
  const roles = await prisma.role.findMany({
    select: { id: true, code: true, name: true, schoolId: true, isSystemRole: true }
  });
  console.log('Roles found:', roles);

  const schools = await prisma.school.findMany({
    select: { id: true, slug: true, nameEn: true }
  });
  console.log('Schools found:', schools);

  const permissionsCount = await prisma.permission.count();
  console.log('Permissions count:', permissionsCount);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
