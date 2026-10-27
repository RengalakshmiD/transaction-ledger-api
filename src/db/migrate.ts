import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';

export async function runMigrations(): Promise<void> {
  const sqlPath = path.join(__dirname, 'init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = await pool.connect();
  try {
    console.log('🔄 Checking and applying database migrations...');
    await client.query(sql);
    console.log('✅ Database migrations applied successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Allow standalone execution via `npm run migrate`
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migration completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
