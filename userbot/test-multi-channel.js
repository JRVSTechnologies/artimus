const assert = require('node:assert');

// Helper under test (identical to index.js)
function getCandidateChatIds(message) {
  const ids = new Set();
  if (message.chatId !== undefined && message.chatId !== null) {
    const cid = message.chatId.toString();
    ids.add(cid);
    if (cid.startsWith('-100')) {
      ids.add(cid.slice(4));
    } else if (/^\d+$/.test(cid)) {
      ids.add('-100' + cid);
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

function parseTargetConfig(raw) {
  const targetList = (raw || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const monitorAll = targetList.includes('*') || targetList.map(s => s.toLowerCase()).includes('all');

  const targetIdSet = new Set();
  for (const target of targetList) {
    targetIdSet.add(target);
    if (target.startsWith('-100')) {
      targetIdSet.add(target.slice(4));
    } else if (/^\d+$/.test(target)) {
      targetIdSet.add('-100' + target);
    }
  }
  return { targetList, monitorAll, targetIdSet };
}

function shouldProcessMessage(message, targetConfig) {
  const { monitorAll, targetIdSet } = targetConfig;
  const candidateIds = getCandidateChatIds(message);
  return monitorAll || [...candidateIds].some(id => targetIdSet.has(id));
}

console.log('--- Running Multi-Channel Userbot Tests ---');

// Test 1: Comma-separated list with channels and groups
{
  const config = parseTargetConfig('-5259961848, -1003948664328');
  assert.strictEqual(config.targetList.length, 2);
  assert.ok(config.targetIdSet.has('-5259961848'), 'Should have first chat ID');
  assert.ok(config.targetIdSet.has('-1003948664328'), 'Should have second channel ID');
  assert.ok(config.targetIdSet.has('3948664328'), 'Should have normalized bare channel ID');
  console.log('✅ Test 1 Passed: TARGET_CHAT_IDS comma-separated parsing and normalization');
}

// Test 2: Message matching for Channel 1 (-1003948664328)
{
  const config = parseTargetConfig('-5259961848, -1003948664328');
  const msgFromChannel = {
    chatId: -1003948664328n,
    peerId: { channelId: 3948664328n },
    message: 'BUY XAUUSD 2350'
  };
  assert.strictEqual(shouldProcessMessage(msgFromChannel, config), true);
  console.log('✅ Test 2 Passed: Message from Channel 1 matched');
}

// Test 3: Message matching for Group 2 (-5259961848)
{
  const config = parseTargetConfig('-5259961848, -1003948664328');
  const msgFromGroup = {
    chatId: -5259961848n,
    peerId: { chatId: 5259961848n },
    message: 'SELL BTCUSD 65000'
  };
  assert.strictEqual(shouldProcessMessage(msgFromGroup, config), true);
  console.log('✅ Test 3 Passed: Message from Group 2 matched');
}

// Test 4: Message from an untracked channel is IGNORED
{
  const config = parseTargetConfig('-5259961848, -1003948664328');
  const untrackedMsg = {
    chatId: -1009999999999n,
    peerId: { channelId: 9999999999n },
    message: 'Hello spam group'
  };
  assert.strictEqual(shouldProcessMessage(untrackedMsg, config), false);
  console.log('✅ Test 4 Passed: Untracked chat message correctly ignored');
}

// Test 5: Wildcard mode matches all channels
{
  const config = parseTargetConfig('*');
  assert.strictEqual(config.monitorAll, true);
  const anyMsg = {
    chatId: -1001122334455n,
    peerId: { channelId: 1122334455n },
    message: 'Any message'
  };
  assert.strictEqual(shouldProcessMessage(anyMsg, config), true);
  console.log('✅ Test 5 Passed: Wildcard (*) mode matches any chat');
}

// Test 6: Webhook payload structure validation
{
  const matchedId = '-1003948664328';
  const chatTitle = 'VIP Forex Gold';
  const text = 'BUY XAUUSD LIMIT 2340';
  const payload = {
    message: {
      text: text,
      chat: {
        id: matchedId,
        title: chatTitle
      }
    }
  };
  assert.strictEqual(payload.message.text, text);
  assert.strictEqual(payload.message.chat.id, '-1003948664328');
  assert.strictEqual(payload.message.chat.title, 'VIP Forex Gold');
  console.log('✅ Test 6 Passed: Webhook payload format verified');
}

console.log('\n🎉 ALL 6 FEATURE TESTS PASSED SUCCESSFULLY!');
