import pkg from 'pg';
const { Client } = pkg;

export const handler = async (event, context) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const connectionString = process.env.POSTGRES_URL;

  if (!connectionString) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'POSTGRES_URL is not defined in environment variables' })
    };
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Fetch signals ordered by date
    const query = `
      SELECT 
        signal,
        signal_date,
        direction,
        entry_high,
        entry_low,
        raw_signal_text,
        sl,
        session,
        source,
        status,
        symbol,
        tp1,
        tp2,
        tp3,
        tp4,
        tp5
      FROM bills_signals
      ORDER BY signal_date ASC
    `;
    
    const result = await client.query(query);
    
    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ data: result.rows })
    };
  } catch (error) {
    console.error('Database query error:', error);
    try { await client.end(); } catch (e) {} // best effort close
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error fetching data: ' + error.message })
    };
  }
};
