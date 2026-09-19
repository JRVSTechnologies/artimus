import { Client as NotionClient } from '@notionhq/client';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, '..', '.env') });

const { Client: PgClient } = pg;

async function run() {
  console.log('--- Notion to Nhost Sync ---');
  
  const notionApiKey = process.env.NOTION_API_KEY;
  const notionDatabaseId = process.env.NOTION_BILLS_SIGNAL_DATABASE_ID;
  const connectionString = process.env.POSTGRES_URL;

  if (!notionApiKey || notionApiKey === 'your_notion_api_key_here') {
    console.error('Error: NOTION_API_KEY is not set correctly in .env');
    process.exit(1);
  }
  if (!notionDatabaseId || notionDatabaseId === 'your_notion_database_id_here') {
    console.error('Error: NOTION_BILLS_SIGNAL_DATABASE_ID is not set correctly in .env');
    process.exit(1);
  }
  if (!connectionString) {
    console.error('Error: POSTGRES_URL is not set in .env');
    process.exit(1);
  }

  const notion = new NotionClient({ auth: notionApiKey });
  const pgClient = new PgClient({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Nhost database...');
    await pgClient.connect();
    console.log('Connected!');

    // Ensure notion_id exists
    console.log('Ensuring notion_id column exists on bills_signals...');
    await pgClient.query(`
      ALTER TABLE bills_signals ADD COLUMN IF NOT EXISTS notion_id text UNIQUE;
    `);

    console.log('Fetching signals from Notion (Read-only access)...');
    const notionResults = [];
    let hasMore = true;
    let nextCursor = undefined;

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: notionDatabaseId,
        start_cursor: nextCursor,
      });
      notionResults.push(...response.results);
      hasMore = response.has_more;
      nextCursor = response.next_cursor;
    }

    console.log(`Found ${notionResults.length} signals in Notion. Syncing...`);

    let insertedOrUpdated = 0;

    for (const page of notionResults) {
      const props = page.properties;

      // Helper function to extract Notion property values safely
      const getTitle = (prop) => prop?.title?.[0]?.plain_text || null;
      const getRichText = (prop) => prop?.rich_text?.[0]?.plain_text || null;
      const getSelect = (prop) => prop?.select?.name || null;
      const getDate = (prop) => prop?.date?.start ? new Date(prop.date.start).toISOString() : null;
      const getNumber = (prop) => typeof prop?.number === 'number' ? prop.number : null;

      // Map properties based on expected typical Notion schema names
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

      if (!signal) {
          console.warn(`Skipping Notion Page ${notion_id}: Missing Signal property`);
          continue;
      }

      const query = `
        -- Deduplication logic: We use ON CONFLICT (notion_id) to ensure that if a signal 
        -- is already in the database, it gets updated instead of creating a duplicate.
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
      if (insertedOrUpdated % 10 === 0) console.log(`Processed ${insertedOrUpdated} rows...`);
    }

    console.log(`Successfully synced all ${insertedOrUpdated} rows from Notion!`);
    await pgClient.end();
      
  } catch (err) {
    console.error('\nError connecting or inserting data:', err.message);
    if (err.body) console.error('Notion API Error:', err.body);
    await pgClient.end();
  }
}

run();
