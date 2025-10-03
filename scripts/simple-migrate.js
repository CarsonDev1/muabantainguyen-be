import { pool } from '../src/setup/db.js';

async function simpleMigrate() {
  try {
    console.log('Creating basic tables...');
    
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name text,
        email text UNIQUE,
        phone text UNIQUE,
        password_hash text,
        role text DEFAULT 'user',
        created_at timestamptz DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS categories (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name text NOT NULL,
        slug text UNIQUE NOT NULL,
        created_at timestamptz DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS products (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name text NOT NULL,
        slug text UNIQUE NOT NULL,
        price numeric NOT NULL DEFAULT 0,
        stock integer NOT NULL DEFAULT 0,
        category_id uuid REFERENCES categories(id),
        created_at timestamptz DEFAULT NOW()
      );
    `);
    
    console.log('Basic tables created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

simpleMigrate();

