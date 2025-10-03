import { initDatabase } from '../src/setup/init.js';

async function migrate() {
  try {
    console.log('Starting database migration...');
    await initDatabase();
    console.log('Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
