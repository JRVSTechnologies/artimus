const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const client = new Client({ connectionString: process.env.POSTGRES_URL });
let connected = false;

async function initTelemetry() {
  try {
    await client.connect();
    connected = true;
    console.log("Telemetry DB connected");
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
