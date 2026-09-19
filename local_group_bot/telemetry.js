const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const client = new Client({ connectionString: process.env.POSTGRES_URL });
let connected = false;

async function initTelemetry() {
  try {
    await client.connect();
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
    connected = true;
    console.log("Telemetry DB connected and table verified");
  } catch (err) {
    console.error("Telemetry DB connection failed:", err);
  }
}

async function emitTelemetry(botId, status, currentlyThinking, lastTask, taskStatus) {
  if (!connected) return;
  try {
    const query = `
      INSERT INTO bot_telemetry (bot_id, status, currently_thinking, last_task, task_status, last_active_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (bot_id) DO UPDATE SET
        status = EXCLUDED.status,
        currently_thinking = EXCLUDED.currently_thinking,
        last_task = EXCLUDED.last_task,
        task_status = EXCLUDED.task_status,
        last_active_at = NOW();
    `;
    await client.query(query, [botId, status, currentlyThinking, lastTask, taskStatus]);
  } catch (err) {
    console.error("Failed to emit telemetry:", err);
  }
}

module.exports = { initTelemetry, emitTelemetry };
