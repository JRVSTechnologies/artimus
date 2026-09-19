const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });
const client = new Client({ connectionString: process.env.POSTGRES_URL });
async function run() {
  await client.connect();
  const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bills_signals'");
  console.log(res.rows);
  await client.end();
}
run();
