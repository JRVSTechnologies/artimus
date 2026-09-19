const { Client } = require('pg');
require('dotenv').config({ path: '.env' });
const client = new Client({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
async function run() {
  await client.connect();
  try {
    const res = await client.query("SELECT * FROM bot_telemetry");
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  }
  await client.end();
}
run();
