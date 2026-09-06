import { prisma } from '../src/lib/db.ts';

async function main() {
  const roles = await prisma.$queryRawUnsafe("SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolbypassrls FROM pg_roles WHERE rolname NOT LIKE 'pg_%'");
  console.log('Postgres Roles:', roles);

  const currentUser = await prisma.$queryRawUnsafe('SELECT current_user, session_user');
  console.log('Current user / session user:', currentUser);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
