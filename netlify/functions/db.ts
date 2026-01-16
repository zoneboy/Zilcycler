import pg from 'pg';

// Handle potential ESM/CJS import mismatch for pg with type casting to avoid TS2551
const { Pool } = (pg as any).default || pg; 

if (!process.env.DATABASE_URL) {
  console.error("CRITICAL: DATABASE_URL environment variable is missing! The app cannot connect to the database.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Neon and many cloud Postgres providers
  }
});

pool.on('error', (err: any) => {
  console.error('Unexpected error on idle client', err);
});

export const query = async (text: string, params?: any[]) => {
    try {
        return await pool.query(text, params);
    } catch (error) {
        console.error("Database Query Error:", error);
        throw error;
    }
};