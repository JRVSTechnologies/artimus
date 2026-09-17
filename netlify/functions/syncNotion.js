import pkg from 'pg';
const { Client: PgClient } = pkg;

export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const notionApiKey = process.env.NOTION_API_KEY;
  const notionDatabaseId = process.env.NOTION_BILLS_SIGNAL_DATABASE_ID;
  const connectionString = process.env.POSTGRES_URL;

  if (!notionApiKey || notionApiKey === 'your_notion_api_key_here') {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'NOTION_API_KEY is not set correctly' }) };
  }
  if (!notionDatabaseId || notionDatabaseId === 'your_notion_database_id_here') {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'NOTION_BILLS_SIGNAL_DATABASE_ID is not set correctly' }) };
  }
  if (!connectionString) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'POSTGRES_URL is not set' }) };
  }

  const provider = (event.queryStringParameters && event.queryStringParameters.provider) || 'bills';
  if (provider !== 'bills') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Sync is only supported for Bills Trading at this time.' }) };
  }

  const pgClient = new PgClient({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await pgClient.connect();

    // Ensure notion_id exists
    await pgClient.query(`
      ALTER TABLE bills_signals ADD COLUMN IF NOT EXISTS notion_id text UNIQUE;
    `);

    const notionResults = [];
    let hasMore = true;
    let nextCursor = undefined;

    while (hasMore) {
      const requestBody = nextCursor ? JSON.stringify({ start_cursor: nextCursor }) : '{}';
      const response = await fetch(`https://api.notion.com/v1/databases/${notionDatabaseId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: requestBody
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Notion API error: ${response.status} ${errorData}`);
      }
      
      const responseData = await response.json();
      notionResults.push(...responseData.results);
      hasMore = responseData.has_more;
      nextCursor = responseData.next_cursor;
    }

    let insertedOrUpdated = 0;

    for (const page of notionResults) {
      const props = page.properties;

      // Helper function to extract Notion property values safely
      const getTitle = (prop) => prop?.title?.[0]?.plain_text || null;
      const getRichText = (prop) => prop?.rich_text?.[0]?.plain_text || null;
      const getSelect = (prop) => prop?.select?.name || null;
      const getDate = (prop) => prop?.date?.start ? new Date(prop.date.start).toISOString() : null;
      const getNumber = (prop) => typeof prop?.number === 'number' ? prop.number : null;

      const signal = getTitle(props['Signal']) || getRichText(props['Signal']);
      const signal_date = getDate(props['Date']);
      const direction = getSelect(props['Direction']) || getRichText(props['Direction']);
      const entry_high = getNumber(props['Entry High']) || parseFloat(getRichText(props['Entry High']) || 'NaN') || null;
      const entry_low = getNumber(props['Entry Low']) || parseFloat(getRichText(props['Entry Low']) || 'NaN') || null;
      const raw_signal_text = getRichText(props['Raw Signal Text']);
      const sl = getNumber(props['S/L']) || parseFloat(getRichText(props['S/L']) || 'NaN') || null;
      const session = getSelect(props['Session']) || getRichText(props['Session']);
      const source = getSelect(props['Source']) || getRichText(props['Source']);
      const status = getSelect(props['Status']) || getRichText(props['Status']);
      const symbol = getSelect(props['Symbol']) || getRichText(props['Symbol']);
      const tp1 = getNumber(props['TP1']) || parseFloat(getRichText(props['TP1']) || 'NaN') || null;
      const tp2 = getNumber(props['TP2']) || parseFloat(getRichText(props['TP2']) || 'NaN') || null;
      const tp3 = getNumber(props['TP3']) || parseFloat(getRichText(props['TP3']) || 'NaN') || null;
      const tp4 = getNumber(props['TP4']) || parseFloat(getRichText(props['TP4']) || 'NaN') || null;
      const tp5 = getNumber(props['TP5']) || parseFloat(getRichText(props['TP5']) || 'NaN') || null;

      const notion_id = page.id;

      if (!signal) continue;

      const query = `
        INSERT INTO bills_signals (
          signal, signal_date, direction, entry_high, entry_low, raw_signal_text,
          sl, session, source, status, symbol, tp1, tp2, tp3, tp4, tp5, notion_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        )
        ON CONFLICT (notion_id) 
        DO UPDATE SET
          signal = EXCLUDED.signal,
          signal_date = EXCLUDED.signal_date,
          direction = EXCLUDED.direction,
          entry_high = EXCLUDED.entry_high,
          entry_low = EXCLUDED.entry_low,
          raw_signal_text = EXCLUDED.raw_signal_text,
          sl = EXCLUDED.sl,
          session = EXCLUDED.session,
          source = EXCLUDED.source,
          status = EXCLUDED.status,
          symbol = EXCLUDED.symbol,
          tp1 = EXCLUDED.tp1,
          tp2 = EXCLUDED.tp2,
          tp3 = EXCLUDED.tp3,
          tp4 = EXCLUDED.tp4,
          tp5 = EXCLUDED.tp5
      `;
      
      const values = [
        signal, signal_date, direction, entry_high, entry_low, raw_signal_text,
        sl, session, source, status, symbol, tp1, tp2, tp3, tp4, tp5, notion_id
      ];

      await pgClient.query(query, values);
      insertedOrUpdated++;
    }

    await pgClient.end();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: `Successfully synced ${insertedOrUpdated} rows from Notion.` })
    };
  } catch (error) {
    console.error('Database query error:', error);
    try { await pgClient.end(); } catch (e) {} // best effort close
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error syncing data: ' + error.message })
    };
  }
};
