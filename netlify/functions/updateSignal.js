import pkg from 'pg';
const { Client } = pkg;

export const handler = async (event, context) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'PUT, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST' && event.httpMethod !== 'PUT') {
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
  
  if (!body.id) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing signal id' }) };
  }

  const provider = body.provider || 'bills';
  let tableName = 'bills_signals';
  if (provider === 'fx_clarity') {
    tableName = 'fx_clarity_signals';
  } else if (provider !== 'bills') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid provider specified' }) };
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    let query = '';
    let values = [];
    
    if (tableName === 'fx_clarity_signals') {
      query = `
        UPDATE fx_clarity_signals SET
          signal_date = $1,
          direction = $2,
          entry_high = $3,
          entry_low = $4,
          raw_signal_text = $5,
          sl = $6,
          status = $7,
          symbol = $8,
          tp1 = $9,
          tp2 = $10,
          tp3 = $11,
          tp4 = $12,
          tp5 = $13,
          tp6 = $14,
          tp7 = $15
        WHERE id = $16
        RETURNING id
      `;
      values = [
        body.signal_date || null,
        body.direction || null,
        body.entry_high ? parseFloat(body.entry_high) : null,
        body.entry_low ? parseFloat(body.entry_low) : null,
        body.raw_signal_text || null,
        body.sl ? parseFloat(body.sl) : null,
        body.status || null,
        body.symbol || null,
        body.tp1 ? parseFloat(body.tp1) : null,
        body.tp2 ? parseFloat(body.tp2) : null,
        body.tp3 ? parseFloat(body.tp3) : null,
        body.tp4 ? parseFloat(body.tp4) : null,
        body.tp5 ? parseFloat(body.tp5) : null,
        body.tp6 ? parseFloat(body.tp6) : null,
        body.tp7 ? parseFloat(body.tp7) : null,
        body.id
      ];
    } else {
      query = `
        UPDATE bills_signals SET
          signal = $1,
          signal_date = $2,
          direction = $3,
          entry_high = $4,
          entry_low = $5,
          raw_signal_text = $6,
          sl = $7,
          session = $8,
          source = $9,
          status = $10,
          symbol = $11,
          tp1 = $12,
          tp2 = $13,
          tp3 = $14,
          tp4 = $15,
          tp5 = $16,
          tp6 = $17,
          tp7 = $18
        WHERE id = $19
        RETURNING id
      `;
      values = [
        body.signal || null,
        body.signal_date || null,
        body.direction || null,
        body.entry_high ? parseFloat(body.entry_high) : null,
        body.entry_low ? parseFloat(body.entry_low) : null,
        body.raw_signal_text || null,
        body.sl ? parseFloat(body.sl) : null,
        body.session || null,
        body.source || null,
        body.status || null,
        body.symbol || null,
        body.tp1 ? parseFloat(body.tp1) : null,
        body.tp2 ? parseFloat(body.tp2) : null,
        body.tp3 ? parseFloat(body.tp3) : null,
        body.tp4 ? parseFloat(body.tp4) : null,
        body.tp5 ? parseFloat(body.tp5) : null,
        body.tp6 ? parseFloat(body.tp6) : null,
        body.tp7 ? parseFloat(body.tp7) : null,
        body.id
      ];
    }
    
    const result = await client.query(query, values);
    await client.end();

    if (result.rowCount === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Signal not found' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: result.rows[0] })
    };
  } catch (error) {
    console.error('Database update error:', error);
    try { await client.end(); } catch (e) {}
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error updating data: ' + error.message })
    };
  }
};
