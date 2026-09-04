const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const filePath = path.join(__dirname, '..', 'data', 'messages.html');
const content = fs.readFileSync(filePath, 'utf-8');
const $ = cheerio.load(content);

let hitsCount = 0;
$('.message').each((i, el) => {
  const textNode = $(el).find('.text');
  if (!textNode.length) return;
  const text = textNode.text().trim();
  
  if (text.toLowerCase().includes('sl') && (text.toLowerCase().includes('hit') || text.toLowerCase().includes('kena'))) {
    hitsCount++;
    if (hitsCount <= 3) {
      console.log(`\n--- Hit Message ${hitsCount} ---`);
      console.log('ID:', $(el).attr('id'));
      
      const replyTo = $(el).find('.reply_to');
      if (replyTo.length) {
        console.log('Reply To HREF:', replyTo.find('a').attr('href'));
      } else {
        console.log('Not a reply?');
      }
      
      console.log('Text:', text.replace(/\n/g, ' '));
    }
  }
});

console.log(`\nTotal 'hit tp' messages found: ${hitsCount}`);
