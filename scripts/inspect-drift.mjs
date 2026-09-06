import { prisma } from '../src/lib/db.ts';

async function main() {
  // Check migration tables
  const migTables = await prisma.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%migration%'");
  console.log('Migration tables:', migTables);

  // Check school_subscriptions columns
  const subCols = await prisma.$queryRawUnsafe("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'school_subscriptions'");
  console.log('school_subscriptions columns:', subCols);

  // Check promotion_items columns
  const promoCols = await prisma.$queryRawUnsafe("SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = 'promotion_items'");
  console.log('promotion_items columns:', promoCols);

  // Check PermissionModule enum values
  const permEnums = await prisma.$queryRawUnsafe("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'PermissionModule'");
  console.log('PermissionModule enum labels:', permEnums.map(e => e.enumlabel));

  // Check MessageType enum values
  const msgEnums = await prisma.$queryRawUnsafe("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'MessageType'");
  console.log('MessageType enum labels:', msgEnums.map(e => e.enumlabel));

  // Check transport_routes / transport_trips time columns
  const tripCols = await prisma.$queryRawUnsafe("SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN ('transport_trips', 'route_stops') AND data_type LIKE '%time%'");
  console.log('Transport time columns:', tripCols);

  await prisma.$disconnect();
}

main().catch(console.error);
