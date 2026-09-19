import pkg from 'pg';
const { Client } = pkg;

export const handler = async (event, context) => {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    // Auto-create table if missing so we don't return 500 errors if scripts haven't run
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
    const res = await client.query('SELECT * FROM bot_telemetry ORDER BY bot_id ASC');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(res.rows)
    };
  } catch (error) {
    console.error('DB Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  } finally {
    await client.end();
  }
};
