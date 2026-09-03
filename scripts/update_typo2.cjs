const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.POSTGRES_URL || 'postgres://postgres:mvKwaptSr6FgWSsA@bwnvfgiohqfmgkpzyvyn.db.ap-southeast-1.nhost.run:5432/bwnvfgiohqfmgkpzyvyn?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

client.connect()
  .then(() => {
    return client.query("UPDATE bills_signals SET sl = 4622 WHERE id = 'f7fe7879-21bb-4478-9712-7953c5be5c2f'");
  })
  .then(res => {
    console.log('Updated rows:', res.rowCount);
    client.end();
  })
  .catch(console.error);
