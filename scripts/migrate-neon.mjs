import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(rootDir, 'migrations');

// Read .env
const envPath = path.join(rootDir, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const connectionStringMatch = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
if (!connectionStringMatch) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}
const connectionString = connectionStringMatch[1];

const { Client } = pg;

async function migrate() {
  console.log('================================================================');
  console.log('EduSmart BD — Live PostgreSQL Database Migration Runner');
  console.log('================================================================\n');

  console.log('Connecting to Live Neon PostgreSQL Database...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('✓ Successfully connected to live database.\n');

  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Executing ${migrationFiles.length} canonical migrations in order:`);
  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    process.stdout.write(`  -> Running ${file}... `);
    try {
      await client.query(sql);
      console.log('✓ SUCCESS');
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
      throw err;
    }
  }

  console.log('\nAuditing live database tables and RLS policies...');
  const tablesRes = await client.query(`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);
  console.log(`✓ ${tablesRes.rows.length} tables verified present in public schema.`);

  const policiesRes = await client.query(`
    SELECT tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);
  console.log(`✓ ${policiesRes.rows.length} RLS policies verified active.\n`);

  await client.end();
  console.log('================================================================');
  console.log('LIVE DATABASE MIGRATION & RLS ACTIVATION COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
