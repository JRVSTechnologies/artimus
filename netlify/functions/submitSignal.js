import pkg from 'pg';
const { Client } = pkg;

export const handler = async (event, context) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON payload' }) };
  }

  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database configuration missing' }) };
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const query = `
      INSERT INTO bills_signals (
        signal, signal_date, direction, entry_high, entry_low,
        raw_signal_text, sl, session, source, status, symbol,
        tp1, tp2, tp3, tp4, tp5
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      ) RETURNING id, signal, signal_date
    `;

    // Map the payload to values, providing null fallbacks for numeric fields
    const values = [
      body.signal || null,
      body.signal_date || new Date().toISOString(),
      body.direction || null,
      body.entry_high ? parseFloat(body.entry_high) : null,
      body.entry_low ? parseFloat(body.entry_low) : null,
      body.raw_signal_text || null,
      body.sl ? parseFloat(body.sl) : null,
      body.session || null,
      body.source || 'Manual Entry',
      body.status || 'Open',
      body.symbol || null,
      body.tp1 ? parseFloat(body.tp1) : null,
      body.tp2 ? parseFloat(body.tp2) : null,
      body.tp3 ? parseFloat(body.tp3) : null,
      body.tp4 ? parseFloat(body.tp4) : null,
      body.tp5 ? parseFloat(body.tp5) : null
    ];
    
    const result = await client.query(query, values);
    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: result.rows[0] })
    };
  } catch (error) {
    console.error('Database insert error:', error);
    try { await client.end(); } catch (e) {}
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error inserting data: ' + error.message })
    };
  }
};
