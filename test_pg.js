import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgres://postgres:mvKwaptSr6FgWSsA@bwnvfgiohqfmgkpzyvyn.db.ap-southeast-1.nhost.run:5432/bwnvfgiohqfmgkpzyvyn?sslmode=require';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    await client.connect();
    console.log("Connected!");
    await client.end();
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
