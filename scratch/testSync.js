import { handler } from '../netlify/functions/syncNotion.js';

async function test() {
  try {
    const res = await handler({ httpMethod: 'POST', queryStringParameters: { provider: 'bills' } }, {});
    console.log("Response:", res);
  } catch (e) {
    console.error("Crash:", e);
  }
}
test();
