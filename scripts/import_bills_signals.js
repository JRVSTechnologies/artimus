import fs from 'fs';
import csv from 'csv-parser';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const csvPath = join(__dirname, '..', 'data', 'Bills Signals f28dacda255045da9e5946021104905b_all.csv');

async function run() {
  const rl = readline.createInterface({ input, output });

  console.log('--- Nhost PostgreSQL Database Importer ---');
  console.log('You can find these details in your Nhost Dashboard under Settings -> Database -> Connection Info.\n');
  
  let connectionString = process.argv[2] || process.env.NHOST_POSTGRES_URL;

  if (!connectionString) {
    const host = await rl.question('Host (e.g., db.xxx.nhost.run): ');
    const port = await rl.question('Port (usually 5432): ');
    const database = await rl.question('Database Name (usually postgres): ');
    const user = await rl.question('User (usually postgres): ');
    const password = await rl.question('Password: ');

    connectionString = `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  }
  
  rl.close();

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false } // Required for remote Nhost db connections
  });

  try {
    console.log('Connecting to Nhost database...');
    await client.connect();
    console.log('Connected!');

    // Create table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS bills_signals (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        signal text,
        signal_date timestamp with time zone,
        direction text,
        entry_high numeric,
        entry_low numeric,
        raw_signal_text text,
        sl numeric,
        session text,
        source text,
        status text,
        symbol text,
        tp1 numeric,
        tp2 numeric,
        tp3 numeric,
        tp4 numeric,
        tp5 numeric,
        created_at timestamp with time zone DEFAULT now()
      );
    `;
    await client.query(createTableQuery);
    console.log('Table "bills_signals" is ready.');

    // Parse and insert CSV
    const results = [];
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        console.log(`Parsed ${results.length} rows from CSV. Inserting...`);
        
        let inserted = 0;
        for (const row of results) {
          const signalKey = Object.keys(row).find(k => k.includes('Signal') && !k.includes('Raw'));
          const signal = row[signalKey];
          
          let signal_date = null;
          if (row['Date']) {
             const parsed = new Date(row['Date'].replace('(GMT+7)', '+0700'));
             if (!isNaN(parsed.getTime())) signal_date = parsed.toISOString();
          }

          const parseFloatSafe = (val) => val && !isNaN(Number(val)) ? Number(val) : null;

          const query = `
            INSERT INTO bills_signals (
              signal, signal_date, direction, entry_high, entry_low, raw_signal_text,
              sl, session, source, status, symbol, tp1, tp2, tp3, tp4, tp5
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
            )
          `;
          
          const values = [
            signal,
            signal_date,
            row['Direction'],
            parseFloatSafe(row['Entry High']),
            parseFloatSafe(row['Entry Low']),
            row['Raw Signal Text'],
            parseFloatSafe(row['S/L']),
            row['Session'],
            row['Source'],
            row['Status'],
            row['Symbol'],
            parseFloatSafe(row['TP1']),
            parseFloatSafe(row['TP2']),
            parseFloatSafe(row['TP3']),
            parseFloatSafe(row['TP4']),
            parseFloatSafe(row['TP5'])
          ];

          await client.query(query, values);
          inserted++;
          if (inserted % 50 === 0) console.log(`Inserted ${inserted} rows...`);
        }

        console.log(`Successfully inserted all ${inserted} rows!`);
        console.log('\nIMPORTANT: Go to your Nhost dashboard under "Data", click on "bills_signals" (in public schema), and click "Track" so it becomes available in your GraphQL API.');
        await client.end();
      });
      
  } catch (err) {
    console.error('\nError connecting or inserting data:', err.message);
    console.error('Please double-check your connection details (especially password and host).');
    await client.end();
  }
}

run();
