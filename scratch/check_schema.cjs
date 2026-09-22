require('dotenv').config({ path: '../.env' });
const { Client } = require('pg');

async function checkSchema() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name = 'bot_telemetry';
    `);
    console.log(res.rows);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

checkSchema();
