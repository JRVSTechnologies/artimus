const { Client } = require('pg');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    if (event.httpMethod === 'GET') {
      const res = await client.query('SELECT id, status FROM telegram_signal_statuses');
      const statuses = {};
      res.rows.forEach(row => {
        statuses[row.id] = row.status;
      });
      return { statusCode: 200, headers, body: JSON.stringify(statuses) };
    }

    if (event.httpMethod === 'POST') {
      const { id, status } = JSON.parse(event.body);
      if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing id' }) };
      }

      if (status) {
        // Upsert
        await client.query(
          'INSERT INTO telegram_signal_statuses (id, status) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status',
          [id, status]
        );
      } else {
        // Delete
        await client.query('DELETE FROM telegram_signal_statuses WHERE id = $1', [id]);
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  } catch (error) {
    console.error('Database Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  } finally {
    await client.end();
  }
};
