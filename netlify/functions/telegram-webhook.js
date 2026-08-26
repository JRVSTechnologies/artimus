import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
// Note: Netlify injects environment variables defined in the dashboard or .env file
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function handler(event, context) {
  // Telegram webhooks must always return a 200 OK quickly
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const payload = JSON.parse(event.body);
    
    // Telegram sends updates. We care about 'message' or 'channel_post'
    const message = payload.message || payload.channel_post;
    
    if (!message || !message.text) {
      // Ignore non-text messages but return 200 so Telegram stops retrying
      return { statusCode: 200, body: 'Ignored: No text content' };
    }

    const rawText = message.text;
    
    // Attempt parsing for "POI VIP FXCLARITY" format
    let symbol = 'UNKNOWN';
    let action = 'UNKNOWN';
    let price = null;

    const upperText = rawText.toUpperCase();
    
    // Look for symbol (e.g., XAUUSD)
    const symbolMatch = rawText.match(/(XAUUSD|XAGUSD|[A-Z]{6})/i);
    if (symbolMatch) {
      symbol = symbolMatch[1].toUpperCase();
    }

    // Look for action and price
    // Format: "SELL LIMIT 4667-4668" or "BUY LIMIT 4641-4640"
    const actionMatch = rawText.match(/(BUY|SELL)\s+(?:LIMIT|EXECUTION|STOP)?\s*([\d\.]+)(?:-([\d\.]+))?/i);
    
    if (actionMatch) {
      action = actionMatch[1].toUpperCase();
      const p1 = parseFloat(actionMatch[2]);
      
      // If it's a range like 4667-4668, take the average or the first one
      if (actionMatch[3]) {
        const p2 = parseFloat(actionMatch[3]);
        price = (p1 + p2) / 2;
      } else {
        price = p1;
      }
    } else {
      // Fallback generic parsing
      if (upperText.includes('BUY') || upperText.includes('LONG')) action = 'BUY';
      else if (upperText.includes('SELL') || upperText.includes('SHORT')) action = 'SELL';
      
      const priceMatch = rawText.match(/\b\d+(\.\d+)?\b/);
      if (priceMatch) price = parseFloat(priceMatch[0]);
    }

    // Construct the payload for Supabase
    // Matching the expected schema of tv_alerts used by PriceAnalysisDashboard
    const alertData = {
      symbol: symbol,
      action: action,
      price: price,
      message: rawText,
      // Fallbacks to simulate TV alert structure
      bar_close: price,
      interval: 'TG_GROUP',
      received_at: new Date().toISOString()
    };

    // Insert into Supabase
    const { data, error } = await supabase
      .from('tv_alerts')
      .insert([alertData]);

    if (error) {
      console.error('Error inserting into Supabase:', error);
      // Still return 200 to Telegram so it doesn't retry infinitely on DB error
      return { 
        statusCode: 200, 
        body: JSON.stringify({ error: 'DB insert failed but webhook acknowledged' }) 
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Telegram signal ingested successfully' })
    };
    
  } catch (err) {
    console.error('Webhook error:', err);
    // Returning 200 even on error prevents Telegram from spamming retries
    return { statusCode: 200, body: 'Webhook parsing error' };
  }
}
