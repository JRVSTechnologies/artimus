const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

async function enableRealtime() {
  const client = new Client({ connectionString: process.env.POSTGRES_URL });
  try {
    await client.connect();
    console.log("Connected to database");
    
    // Check if publication exists
    const check = await client.query(`
      SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime'
    `);
    
    if (check.rows.length === 0) {
      console.log("Creating supabase_realtime publication...");
      await client.query(`CREATE PUBLICATION supabase_realtime;`);
    }

    console.log("Adding bot_telemetry to supabase_realtime publication...");
    await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE bot_telemetry;`);
    console.log("Successfully enabled Realtime for bot_telemetry");
  } catch (err) {
    if (err.message.includes('already in publication')) {
      console.log("bot_telemetry is already in the supabase_realtime publication.");
    } else {
      console.error("Error:", err.message);
    }
  } finally {
    await client.end();
  }
}

enableRealtime();
