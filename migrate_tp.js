import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    await client.connect();
    console.log('Connected to DB');
    
    await client.query('ALTER TABLE bills_signals ADD COLUMN IF NOT EXISTS tp6 NUMERIC, ADD COLUMN IF NOT EXISTS tp7 NUMERIC');
    console.log('Added tp6 and tp7 to bills_signals');
    
    await client.query('ALTER TABLE fx_clarity_signals ADD COLUMN IF NOT EXISTS tp6 NUMERIC, ADD COLUMN IF NOT EXISTS tp7 NUMERIC');
    console.log('Added tp6 and tp7 to fx_clarity_signals');
    
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

migrate();
