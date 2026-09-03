require('dotenv').config();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(process.env.SESSION_STRING || '');

(async () => {
  console.log('Connecting to Telegram...');
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    onError: (err) => console.log(err),
  });

  console.log('✅ Connected!');
  console.log('Fetching your dialogs/chats...\n');
  
  const dialogs = await client.getDialogs();
  console.log('=========================================');
  console.log('      YOUR TELEGRAM CHAT IDs');
  console.log('=========================================');
  
  // We'll filter to only show Groups and Channels to make it easier to read
  for (const dialog of dialogs) {
    if (dialog.isChannel || dialog.isGroup) {
      console.log(`[${dialog.id.toString()}] ${dialog.title || dialog.name}`);
    }
  }
  
  console.log('=========================================');
  console.log('Copy the ID you want and place it in your .env file as TARGET_CHAT_ID');
  process.exit(0);
})();
