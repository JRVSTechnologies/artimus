const fetch = require('node-fetch'); // wait node 18+ has global fetch

async function test() {
  const url = 'https://bwnvfgiohqfmgkpzyvyn.graphql.ap-southeast-1.nhost.run/v1';
  
  const query = `
    query GetSignals {
      bills_signals(order_by: {signal_date: asc}) {
        signal
      }
    }
  `;
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

test();
