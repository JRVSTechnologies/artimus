require('dotenv').config({ path: '../.env' });
const { Client } = require('pg');

async function grantPermissions() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  try {
    await client.connect();
    
    // Grant privileges
    await client.query(`GRANT SELECT ON TABLE public.bot_telemetry TO anon;`);
    await client.query(`GRANT SELECT ON TABLE public.bot_telemetry TO authenticated;`);
    await client.query(`GRANT ALL ON TABLE public.bot_telemetry TO service_role;`);
    
    console.log("Granted permissions to anon, authenticated, and service_role.");
    
    // Reload cache
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log("Notified PostgREST to reload schema cache.");
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

grantPermissions();
