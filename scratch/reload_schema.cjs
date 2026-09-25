require('dotenv').config({ path: '../.env' });
const { Client } = require('pg');

async function reloadSchema() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  try {
    await client.connect();
    console.log("Connected to database");
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log("Notified PostgREST to reload schema");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

reloadSchema();
