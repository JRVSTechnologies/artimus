import { NhostClient } from '@nhost/nhost-js';

const nhost = new NhostClient({
  subdomain: 'bwnvfgiohqfmgkpzyvyn',
  region: 'ap-southeast-1'
});

async function test() {
  const query = `
    query GetSignals {
      bills_signals(order_by: {signal_date: asc}) {
        signal
      }
    }
  `;
  const { data, error } = await nhost.graphql.request(query);
  console.log('Data:', JSON.stringify(data, null, 2));
  console.log('Error:', JSON.stringify(error, null, 2));
}

test();
