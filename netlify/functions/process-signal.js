// Netlify Serverless Function: Process Data & Signal Information
export async function handler(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'OK' }) };
  }

  try {
    let rawBody = event.body || '{}';
    let signalData = {};
    
    // Handle JSON or raw text payloads (e.g. from Webhooks)
    try {
      signalData = JSON.parse(rawBody);
    } catch (e) {
      signalData = { message: rawBody, signal: 'RAW_TEXT' };
    }

    const botToken = signalData.botToken || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = signalData.chatId || process.env.TELEGRAM_CHAT_ID;

    const ticker = signalData.ticker || signalData.symbol || 'SYSTEM';
    const action = signalData.action || signalData.signal || 'ALERT';
    const price = signalData.price || 'N/A';
    const time = new Date().toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC';
    const customMsg = signalData.message || signalData.text || 'Artimus Signal Received';

    // Format rich Telegram message
    const formattedMessage = `⚡ <b>ARTIMUS SIGNAL DETECTED</b> ⚡\n\n` +
      `<b>Asset:</b> <code>${ticker}</code>\n` +
      `<b>Action:</b> <b>${action}</b>\n` +
      `<b>Price:</b> <code>${price}</code>\n` +
      `<b>Time:</b> ${time}\n\n` +
      `<b>Details:</b> ${customMsg}\n` +
      `<i>Processed via Netlify Serverless Function</i>`;

    // Forward to Telegram if botToken & chatId exist
    let telegramResult = null;
    if (botToken && chatId) {
      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const tgRes = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: formattedMessage,
          parse_mode: 'HTML'
        })
      });
      telegramResult = await tgRes.json();
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        signalId: `artimus_${Date.now()}`,
        status: 'PROCESSED',
        receivedSignal: signalData,
        formattedMessage,
        telegramDispatched: !!(telegramResult && telegramResult.ok),
        telegramDetails: telegramResult
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Error processing signal'
      })
    };
  }
}
