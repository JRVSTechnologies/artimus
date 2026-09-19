require('dotenv').config();
const http = require('http');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const input = require('input');
const { initTelemetry, emitTelemetry } = require('./telemetry');

const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(process.env.SESSION_STRING || ''); // Fill this later with the printed string
const targetChatId = process.env.TARGET_CHAT_ID;
const webhookUrl = process.env.WEBHOOK_URL;

// Helper to extract all possible ID formats for a message
function getCandidateChatIds(message) {
  const ids = new Set();
  if (message.chatId !== undefined && message.chatId !== null) {
    const cid = message.chatId.toString();
    ids.add(cid);
    if (cid.startsWith('-100')) {
      ids.add(cid.slice(4)); // without -100 prefix
    } else if (/^\d+$/.test(cid)) {
      ids.add('-100' + cid); // with -100 prefix
    }
  }
  if (message.peerId) {
    if (message.peerId.channelId) {
      const ch = message.peerId.channelId.toString();
      ids.add(ch);
      ids.add('-100' + ch);
    }
    if (message.peerId.chatId) {
      const grp = message.peerId.chatId.toString();
      ids.add(grp);
      ids.add('-' + grp);
    }
    if (message.peerId.userId) {
      ids.add(message.peerId.userId.toString());
    }
  }
  return ids;
}

(async () => {
  if (!apiId || !apiHash) {
    console.error("❌ API_ID and API_HASH are missing in .env file.");
    process.exit(1);
  }

  // Parse target chat IDs (supports comma-separated TARGET_CHAT_IDS or single TARGET_CHAT_ID)
  const rawTargetConfig = (process.env.TARGET_CHAT_IDS || process.env.TARGET_CHAT_ID || '').trim();
  const targetList = rawTargetConfig
    ? rawTargetConfig.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const monitorAll = targetList.includes('*') || targetList.map(s => s.toLowerCase()).includes('all');

  // Build a lookup set containing both raw and normalized ID variants
  const targetIdSet = new Set();
  for (const target of targetList) {
    targetIdSet.add(target);
    if (target.startsWith('-100')) {
      targetIdSet.add(target.slice(4));
    } else if (/^\d+$/.test(target)) {
      targetIdSet.add('-100' + target);
    }
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

  if (targetList.length === 0) {
    console.log('🔍 TARGET_CHAT_IDS (or TARGET_CHAT_ID) is not set in .env.');
    console.log('Fetching your dialogs to help you find the correct Chat ID(s)...');
    
    const dialogs = await client.getDialogs();
    console.log('\n--- Your Recent Chats ---');
    for (const dialog of dialogs.slice(0, 30)) { // Show top 30
      const type = dialog.isChannel ? 'Channel' : dialog.isGroup ? 'Group' : 'User';
      console.log(`[${dialog.id.toString()}] (${type}) ${dialog.title || dialog.name}`);
    }
    
    console.log('\n⚠️ Please find the Chat ID(s) above and add them to your .env file:');
    console.log('   Single chat:      TARGET_CHAT_IDS=-1001234567890');
    console.log('   Multiple chats:   TARGET_CHAT_IDS=-1001234567890, -1009876543210');
    console.log('   All chats:        TARGET_CHAT_IDS=*');
    console.log('Then restart the script.');
    process.exit(0);
  }

  if (monitorAll) {
    console.log(`\n🎧 Listening for new messages in ALL chats/channels (wildcard mode)`);
  } else {
    console.log(`\n🎧 Listening for new messages across ${targetList.length} configured chat(s): ${targetList.join(', ')}`);
  }

  await initTelemetry();
  await emitTelemetry('userbot', 'Online', 'Listening for new messages', 'Startup', 'success');

  if (!webhookUrl) {
    console.warn("⚠️ WEBHOOK_URL is missing. Messages will be logged but not forwarded.");
  }

  client.addEventHandler(async (event) => {
    const message = event.message;
    if (!message) return;
    const text = message.message || '';
    
    // Log all incoming messages for debugging/monitoring
    const debugChatId = message.chatId ? message.chatId.toString() : 'Unknown';
    if (text) {
      console.log(`[LOG] Read message from chat: ${debugChatId} | Preview: ${text.substring(0, 60).replace(/\n/g, ' ')}...`);
      await emitTelemetry('userbot', 'Online', `Parsing message from ${debugChatId}`, 'Read Message', 'processing');
    }

    // Check if the message is from any of our target chats
    const candidateIds = getCandidateChatIds(message);
    const isTarget = monitorAll || [...candidateIds].some(id => targetIdSet.has(id));

    if (isTarget && text) {
      let chatTitle = 'Unknown';
      try {
        const chat = await message.getChat();
        chatTitle = chat?.title || chat?.username || (chat?.firstName ? `${chat.firstName} ${chat.lastName || ''}`.trim() : 'Unknown');
      } catch {
        // Chat title resolution is non-blocking
      }

      const matchedId = [...candidateIds].find(id => targetIdSet.has(id)) || debugChatId;
      console.log(`\n📩 New message detected in [${chatTitle}] (ID: ${matchedId})!`);
      console.log(`--- Full Content ---`);
      console.log(text);
      console.log(`--------------------`);

      // Forward to Webhook
      if (webhookUrl) {
        try {
          console.log(`🚀 Forwarding to Webhook: ${webhookUrl}`);
          await emitTelemetry('userbot', 'Online', `Forwarding message to Webhook`, 'Forward Webhook', 'processing');
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: {
                text: text,
                chat: {
                  id: matchedId,
                  title: chatTitle
                }
              }
            })
          });
          
          if (response.ok) {
            console.log(`✅ Successfully forwarded message!`);
            await emitTelemetry('userbot', 'Online', `Listening for new messages`, 'Forward Webhook', 'success');
          } else {
            console.error(`❌ Failed to forward. Status: ${response.status}`);
            await emitTelemetry('userbot', 'Online', `Listening for new messages`, 'Forward Webhook', 'error');
          }
        } catch (error) {
          console.error(`❌ Webhook error:`, error);
          await emitTelemetry('userbot', 'Online', `Listening for new messages`, 'Forward Webhook', 'error');
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
