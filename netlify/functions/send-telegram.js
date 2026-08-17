// Netlify Serverless Function: Send Telegram Message
export async function handler(event, context) {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'Successful preflight call' }) };
  }

  try {
    let payload = {};
    if (event.body) {
      try {
        payload = JSON.parse(event.body);
      } catch (e) {
        payload = {};
      }
    }

    // Merge query string parameters if GET request
    if (event.queryStringParameters) {
      payload = { ...event.queryStringParameters, ...payload };
    }

    const botToken = payload.botToken || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = payload.chatId || process.env.TELEGRAM_CHAT_ID;
    const message = payload.message || payload.text || 'Hello World from Artimus! 🚀';
    const parseMode = payload.parseMode || 'HTML';

    if (!botToken) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing Telegram Bot Token. Provide botToken in payload or set TELEGRAM_BOT_TOKEN env variable.'
        })
      };
    }

    if (!chatId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing Telegram Chat ID. Provide chatId in payload or set TELEGRAM_CHAT_ID env variable.'
        })
      };
    }

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: parseMode,
        disable_web_page_preview: false
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      return {
        statusCode: response.status || 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: data.description || 'Telegram API returned an error',
          details: data
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Telegram message sent successfully!',
        result: data.result,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error processing Telegram request'
      })
    };
  }
}
