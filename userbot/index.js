require('dotenv').config();
const http = require('http');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const input = require('input');

const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(process.env.SESSION_STRING || ''); // Fill this later with the printed string
const targetChatId = process.env.TARGET_CHAT_ID;
const webhookUrl = process.env.WEBHOOK_URL;

(async () => {
  if (!apiId || !apiHash) {
    console.error("❌ API_ID and API_HASH are missing in .env file.");
    process.exit(1);
  }

  console.log('Connecting to Telegram...');
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text('Please enter your phone number (with country code): '),
    password: async () => await input.text('Please enter your password (if you have 2FA enabled): '),
    phoneCode: async () => await input.text('Please enter the code you received on Telegram: '),
    onError: (err) => console.log(err),
  });

  console.log('✅ You are successfully connected!');
  
  if (!process.env.SESSION_STRING) {
    console.log('\n======================================================');
    console.log('🔑 IMPORTANT: Save this SESSION_STRING in your .env file:');
    console.log(client.session.save());
    console.log('======================================================\n');
  }

  if (!targetChatId) {
    console.log('🔍 TARGET_CHAT_ID is not set in .env.');
    console.log('Fetching your dialogs to help you find the correct Chat ID...');
    
    const dialogs = await client.getDialogs();
    console.log('\n--- Your Recent Chats ---');
    for (const dialog of dialogs.slice(0, 30)) { // Show top 30
      console.log(`[${dialog.id.toString()}] ${dialog.title || dialog.name}`);
    }
    
    console.log('\n⚠️ Please find the Chat ID for your VIP group above, add it as TARGET_CHAT_ID in .env, and restart the script.');
    process.exit(0);
  }

  console.log(`\n🎧 Listening for new messages in chat ID: ${targetChatId}`);
  if (!webhookUrl) {
    console.warn("⚠️ WEBHOOK_URL is missing. Messages will be logged but not forwarded.");
  }

  client.addEventHandler(async (event) => {
    const message = event.message;
    const text = message.message || '';
    
    // Log all incoming messages for debugging/monitoring
    const debugChatId = message.chatId ? message.chatId.toString() : 'Unknown';
    if (text) {
      console.log(`[LOG] Read message from chat: ${debugChatId} | Preview: ${text.substring(0, 60).replace(/\n/g, ' ')}...`);
    }

    // Check if the message is from our target group
    if (message.peerId && message.peerId.channelId) {
      const currentId = '-100' + message.peerId.channelId.toString(); // standard channel prefix
      
      // Match the channel ID or raw ID
      if (currentId === targetChatId || message.chatId.toString() === targetChatId) {
        if (text) {
          console.log(`\n📩 New message detected in VIP Group!`);
          console.log(`--- Full Content ---`);
          console.log(text);
          console.log(`--------------------`);

          // Forward to Webhook
          if (webhookUrl) {
            try {
              console.log(`🚀 Forwarding to Webhook: ${webhookUrl}`);
              const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: { text: text }
                })
              });
              
              if (response.ok) {
                console.log('✅ Successfully forwarded signal to Artimus Webhook!');
              } else {
                console.error(`❌ Webhook returned error status: ${response.status}`);
              }
            } catch (err) {
              console.error('❌ Failed to send webhook request:', err.message);
            }
          }
        }
      }
    }
  }, new NewMessage({}));

  // Dummy HTTP server to satisfy free hosting requirements (like Render Web Services)
  const port = process.env.PORT || 3000;
  http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Artimus Telegram UserBot is running!\n');
  }).listen(port, () => {
    console.log(`🌐 Dummy Web Server listening on port ${port} for hosting health checks`);
  });

})();
