require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { Client } = require('pg');

const dataDir = path.join(__dirname, '..', 'data');
const files = ['messages.html', 'messages2.html'];

async function run() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error("No POSTGRES_URL found in .env");
    process.exit(1);
  }

  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL.");

    // Truncate table
    await client.query(`TRUNCATE TABLE fx_clarity_signals;`);
    console.log("Cleared existing data in fx_clarity_signals.");

    const signalsMap = {}; // key: messageID
    const allReplies = [];

    // Parse files
    files.forEach(file => {
      const filePath = path.join(dataDir, file);
      if (!fs.existsSync(filePath)) return;
      
      console.log(`Parsing ${file}...`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const $ = cheerio.load(content);
      
      $('.message').each((i, el) => {
        const msgId = $(el).attr('id'); // e.g. "message123"
        const dateStr = $(el).find('.date.details').attr('title'); 
        
        const textNode = $(el).find('.text');
        if (!textNode.length) return;
        
        textNode.find('br').replaceWith('\n');
        let text = textNode.text().trim();
        const textLower = text.toLowerCase();
        
        const replyToHref = $(el).find('.reply_to a').attr('href');
        if (replyToHref) {
          const replyToId = replyToHref.replace('#go_to_', ''); // e.g. "message123"
          allReplies.push({
            msgId,
            replyToId,
            textLower
          });
        }
        
        if (textLower.startsWith('poi round')) {
          
          let model = null;
          const lines = text.split('\n').map(l => l.trim()).filter(l => l);
          if (lines.length > 0) {
            const firstLineMatch = lines[0].match(/POI ROUND\s*\d+\s*(.+)/i);
            if (firstLineMatch && firstLineMatch[1].trim()) {
              model = firstLineMatch[1].trim();
            } else if (lines.length > 1) {
              model = lines[1];
            }
          }

          const symbolMatch = text.match(/(XAU\/?USD|GOLD|GBP\/?JPY)/i);
          const symbol = symbolMatch ? symbolMatch[1].replace('/', '') : 'XAUUSD';
          
          const dirMatch = text.match(/(BUY|SELL)/i);
          const direction = dirMatch ? dirMatch[1].toUpperCase() : null;
          
          // BUY LIMIT 4435-4436 or SELL LIMIT 4435-4436
          const entryMatch = text.match(/LIMIT\s+(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)/i) || 
                             text.match(/ZONE\s+(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)/i);
          let entryLow = null, entryHigh = null, entryMid = null;
          if (entryMatch) {
            entryLow = parseFloat(entryMatch[1]);
            entryHigh = parseFloat(entryMatch[2]);
            if (entryLow > entryHigh) {
              const temp = entryLow;
              entryLow = entryHigh;
              entryHigh = temp;
            }
            entryMid = (entryLow + entryHigh) / 2;
          }
          
          const slMatch = text.match(/SL[^\d]*(\d+(?:\.\d+)?)/i);
          const sl = slMatch ? parseFloat(slMatch[1]) : null;

          let tp1 = null, tp2 = null, tp3 = null;
          if (entryMid !== null && direction) {
            // Gold typically: 50 pips = 5.0 points.
            const pipMult = symbol.includes('XAU') || symbol.includes('GOLD') ? 0.1 : 
                            symbol.includes('JPY') ? 0.01 : 0.0001;
                            
            const tpDir = direction === 'BUY' ? 1 : -1;
            
            // Look for explicit TP lines in text (e.g. TP 50 PIPS)
            // Or just hardcode the 50, 100, 200 array based on the screenshot format
            tp1 = entryMid + (tpDir * 50 * pipMult);
            tp2 = entryMid + (tpDir * 100 * pipMult);
            tp3 = entryMid + (tpDir * 200 * pipMult);
          }

          let isoDate = null;
          if (dateStr) {
            const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}:\d{2}:\d{2})\s+UTC([+-]\d{2}:\d{2})/);
            if (match) {
              isoDate = `${match[3]}-${match[2]}-${match[1]}T${match[4]}${match[5]}`;
            }
          }

          signalsMap[msgId] = {
            id: msgId,
            signal_date: isoDate,
            symbol, direction, entryLow, entryHigh, sl, tp1, tp2, tp3,
            model,
            raw: text,
            status: 'Open' // default
          };
        }
      });
    });

    console.log(`Parsed ${Object.keys(signalsMap).length} 'POI Round' signals.`);
    console.log(`Analyzing ${allReplies.length} replies for outcome mapping...`);

    // Process Replies for Outcomes
    allReplies.forEach(reply => {
      const sig = signalsMap[reply.replyToId];
      if (sig) {
        if (reply.textLower.includes('sl') && (reply.textLower.includes('hit') || reply.textLower.includes('kena') || reply.textLower.includes('done'))) {
          sig.status = 'SL Hit';
        } else if (reply.textLower.includes('be') && (reply.textLower.includes('hit') || reply.textLower.includes('kena'))) {
          // If already TP hit, don't overwrite with BE if BE was posted later?
          // Actually, if it hits BE after TP1, the realizedR is smaller, but let's just mark it 'Breakeven' for simplicity.
          sig.status = 'Breakeven';
        } else if (reply.textLower.includes('hit tp') || reply.textLower.includes('tp done') || reply.textLower.includes('done tp')) {
          sig.status = 'TP Hit'; // Could be TP1, TP2, etc. We just mark TP Hit.
        }
      }
    });

    let tpCount = 0, slCount = 0, beCount = 0, openCount = 0;
    Object.values(signalsMap).forEach(s => {
      if (s.status === 'TP Hit') tpCount++;
      else if (s.status === 'SL Hit') slCount++;
      else if (s.status === 'Breakeven') beCount++;
      else openCount++;
    });

    console.log(`Status Mapping Results: TP Hit: ${tpCount} | SL Hit: ${slCount} | Breakeven: ${beCount} | Open: ${openCount}`);
    console.log(`Inserting into DB...`);
    
    let inserted = 0;
    for (const s of Object.values(signalsMap)) {
      const query = `
        INSERT INTO fx_clarity_signals (signal_date, symbol, direction, entry_low, entry_high, sl, tp1, tp2, tp3, model, raw_signal_text, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;
      const values = [s.signal_date, s.symbol, s.direction, s.entryLow, s.entryHigh, s.sl, s.tp1, s.tp2, s.tp3, s.model, s.raw, s.status];
      await client.query(query, values);
      inserted++;
    }
    
    console.log(`Successfully inserted ${inserted} signals into fx_clarity_signals.`);
    
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await client.end();
  }
}

run();
