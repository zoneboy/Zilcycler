import pg from 'pg';

// Handle potential ESM/CJS import mismatch for pg
const { Pool } = (pg as any).default || pg; 

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is missing!");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Neon in some environments
  }
});

export const query = (text: string, params?: any[]) => pool.query(text, params);