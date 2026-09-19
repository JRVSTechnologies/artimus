const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });
const client = new Client({ connectionString: process.env.POSTGRES_URL });
async function run() {
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS bot_telemetry (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bot_id VARCHAR(50) UNIQUE NOT NULL,
        status VARCHAR(20) NOT NULL,
        currently_thinking TEXT,
        last_task TEXT,
        task_status VARCHAR(20),
        last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log("Table bot_telemetry created successfully in Nhost Postgres.");
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
run();
