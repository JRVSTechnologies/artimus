const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const dataDir = path.join(__dirname, '..', 'data');
const files = ['messages.html', 'messages2.html'];

let poiCount = 0;
const parsedSignals = [];

files.forEach(file => {
  const filePath = path.join(dataDir, file);
  if (!fs.existsSync(filePath)) return;
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const $ = cheerio.load(content);
  
  $('.message').each((i, el) => {
    // Attempt to extract the date
    let dateStr = $(el).find('.date.details').attr('title');
    
    // Find text content
    const textNode = $(el).find('.text');
    if (!textNode.length) return;
    
    // Telegram HTML uses <br> for line breaks. Let's convert them to \n before getting text.
    textNode.find('br').replaceWith('\n');
    let text = textNode.text().trim();
    
    if (text.toLowerCase().startsWith('poi round')) {
      poiCount++;
      
      const symbolMatch = text.match(/(XAU\/?USD|GOLD|GBP\/?JPY)/i);
      const symbol = symbolMatch ? symbolMatch[1].replace('/', '') : 'XAUUSD';
      
      const dirMatch = text.match(/(BUY|SELL)/i);
      const direction = dirMatch ? dirMatch[1].toUpperCase() : null;
      
      const entryMatch = text.match(/ZONE\s+(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)/i);
      let entryLow = null, entryHigh = null;
      if (entryMatch) {
        entryLow = parseFloat(entryMatch[1]);
        entryHigh = parseFloat(entryMatch[2]);
        if (entryLow > entryHigh) {
          const temp = entryLow;
          entryLow = entryHigh;
          entryHigh = temp;
        }
      }
      
      const slMatch = text.match(/SL[^\d]*(\d+(?:\.\d+)?)/i);
      const sl = slMatch ? parseFloat(slMatch[1]) : null;

      parsedSignals.push({
        date: dateStr,
        symbol, direction, entryLow, entryHigh, sl,
        raw: text
      });
    }
  });
});

console.log(`Found ${poiCount} POI Round messages.`);
if (parsedSignals.length > 0) {
  console.log('Sample format of first 3 messages:');
  parsedSignals.slice(0, 5).forEach((s, idx) => {
    console.log(`\n--- Signal ${idx + 1} ---`);
    console.log(`Date: ${s.date}`);
    console.log(`Symbol: ${s.symbol} | Dir: ${s.direction} | Entry: ${s.entryLow}-${s.entryHigh} | SL: ${s.sl}`);
    console.log(`Raw: \n${s.raw.split('\n')[0]}`);
  });
}
