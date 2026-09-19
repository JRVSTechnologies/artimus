require('dotenv').config();
const { Telegraf } = require('telegraf');
const Anthropic = require('@anthropic-ai/sdk');
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const token = process.env.TELEGRAM_BOT_TOKEN;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

if (!token) {
  console.error('Error: TELEGRAM_BOT_TOKEN is missing in .env file.');
  process.exit(1);
}

const bot = new Telegraf(token);
const { initTelemetry, emitTelemetry } = require('./telemetry');
let anthropic = null;
const fs = require('fs');
const DB_FILE = './database.json';
let chatSessions = {};
try {
  if (fs.existsSync(DB_FILE)) {
    chatSessions = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  }
} catch (e) {
  console.error("Failed to load DB:", e);
}

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(chatSessions));
  } catch (e) {}
}

const SETTINGS_FILE = './settings.json';
let chatModels = {};
try {
  if (fs.existsSync(SETTINGS_FILE)) {
    chatModels = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  }
} catch (e) {}

function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(chatModels));
  } catch (e) {}
}
 

let mcpClient = null;
let anthropicTools = [];

// Local tool to run bash commands
const localTools = [
  {
    name: "run_bash_command",
    description: "Run a bash shell command on the host server. The command will be executed in the /home/jrvs/developerWorkspace/artimus directory. NOTE: Do NOT try to run 'agy screenshot' or 'agy send-media'. Use the 'capture_screenshot' MCP tool for screenshots, and the 'send_file_to_chat' tool to send them.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "The bash command to execute" }
      },
      required: ["command"]
    }
  },
  {
    name: "send_file_to_chat",
    description: "Send a file (like an image or screenshot) from the local server directly to the Telegram chat. Use this immediately after you capture a screenshot using TradingView so the user can see it.",
    input_schema: {
      type: "object",
      properties: {
        filepath: { type: "string", description: "Absolute path to the file on the server" },
        caption: { type: "string", description: "Optional text caption for the file" }
      },
      required: ["filepath"]
    }
  }
];

async function initMcp() {
  console.log("Initializing MCP Client...");
  try {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["/home/jrvs/tradingview-mcp/src/server.js"],
    });
    
    mcpClient = new Client(
      { name: "TelegramBot", version: "1.0.0" },
      { capabilities: { prompts: {}, resources: {}, tools: {} } }
    );
    
    await mcpClient.connect(transport);
    const toolsResponse = await mcpClient.listTools();
    
    anthropicTools = toolsResponse.tools.map(t => ({
      name: t.name,
      description: t.description || "",
      input_schema: t.inputSchema
    }));
    console.log(`Connected to MCP! Loaded ${anthropicTools.length} tools.`);
  } catch (error) {
    console.error("Failed to connect to MCP:", error);
  }
}

if (anthropicApiKey) {
  anthropic = new Anthropic({ apiKey: anthropicApiKey });
} else {
  console.warn('Warning: ANTHROPIC_API_KEY is missing.');
}

bot.command('clear', (ctx) => {
  const chatId = ctx.chat.id;
  delete chatSessions[chatId];
  saveDb();
  ctx.reply("I've cleared my memory of our previous conversation!").catch(e => console.error(e));
});

bot.command('ping', (ctx) => {
  ctx.reply('Pong! The chatbot is active.').catch(err => console.error(err));
});

bot.command('model', (ctx) => {
  const parts = ctx.message.text.split(' ');
  if (parts.length > 1) {
    const modelName = parts[1].toLowerCase();
    if (modelName === 'help' || modelName === 'list') {
      return ctx.reply("Recommended models:\n- /model claude (Claude Sonnet CLI)\n- /model gemini-3.1-pro-high\n- /model gemini-3.8-flash-high\n- /model claude-sonnet-4-6\n- /model clear (to reset to default)");
    }
    if (modelName === 'clear') {
      delete chatModels[ctx.chat.id];
      saveSettings();
      return ctx.reply("Custom model cleared. Now using the global default model.");
    }
    chatModels[ctx.chat.id] = modelName;
    saveSettings();
    ctx.reply(`Model set to ${modelName} for this chat.`);
  } else {
    const current = chatModels[ctx.chat.id];
    ctx.reply(current ? `Current model is: ${current}. To change, use /model [name] (or /model help)` : `Using global default model. To change, use /model [name] (or /model help)`);
  }
});

const chatLocks = {};

bot.on('text', async (ctx) => {
  const chatType = ctx.chat.type;
  const chatId = ctx.chat.id;
  const text = ctx.message.text;
  
  let shouldReply = false;
  if (chatType === 'private') {
    shouldReply = true;
  } else {
    const botMention = ctx.botInfo ? `@${ctx.botInfo.username}` : '@bot';
    const isMentioned = text.includes(botMention) || text.toLowerCase().includes('artimus');
    const isReplyToBot = ctx.message.reply_to_message?.from?.id === ctx.botInfo?.id;
    if (isMentioned || isReplyToBot) shouldReply = true;
  }

  if (shouldReply) {
    
    try {
      ctx.sendChatAction('typing').catch(() => {});

      if (!chatSessions[chatId]) chatSessions[chatId] = [];
      const history = chatSessions[chatId];
      
      const messageContent = chatType !== 'private' ? `${ctx.from.first_name} says: ${text}` : text;
      history.push({ role: 'user', content: messageContent });

      // Keep recent history
      while (history.length > 10) {
        history.shift();
      }
      saveDb();

      let memoryContext = history.map(h => `${h.role}: ${typeof h.content === 'string' ? h.content : '[complex content]'}`).join('\n');
      
      const systemInstruction = `You are Artimus, a smart Telegram chatbot with access to TradingView MCP. Focus ONLY on XAUUSD (Gold), DXY, XAGUSD, OIL. Keep responses natural and concise. DO NOT use markdown. \nWhen using TradingView MCP tools, you MUST ensure you are using the layout "XAUUSD_Claude" (e.g., using layout_switch or similar tool if needed). \nIf you want to send a screenshot, you MUST use the capture_screenshot tool and then output a line formatted exactly as: SEND_FILE: /path/to/file\nIMPORTANT: If the user asks you to switch your AI model or provider, tell them they can do it themselves by typing "/model [model_name]" (e.g. "/model gemini-pro" or "/model claude").\n\nPAST CONTEXT:\n${memoryContext}\n\nUser Query: `;

      const { execFile } = require('child_process');
      const util = require('util');
      const execFileAsync = util.promisify(execFile);

      ctx.reply("Working on this...", { reply_to_message_id: ctx.message.message_id }).catch(() => {});
      await emitTelemetry('artimus', 'Online', 'Processing task...', 'Run AGY', 'processing');

      let cliCommand = 'agy';
      let cliArgs = ['--print', systemInstruction + text, '--dangerously-skip-permissions'];
      
      let customModel = chatModels[chatId];
      if (text.toLowerCase().includes('use claude') || text.toLowerCase().includes('/claude')) {
        cliCommand = 'claude';
      } else if (customModel) {
        customModel = customModel.toLowerCase();
        if (customModel === 'claude') {
          cliCommand = 'claude';
        } else {
          if (customModel === "gemini-pro") customModel = "gemini-3.1-pro-high";
          if (customModel === "gemini-1.5-pro") customModel = "gemini-3.1-pro-high";
          if (customModel === "gemini-flash") customModel = "gemini-3.8-flash-high";
          if (customModel === "gemini-1.5-flash") customModel = "gemini-3.8-flash-high";
          cliArgs.push('--model', customModel);
        }
      }

      const { stdout, stderr } = await execFileAsync(cliCommand, cliArgs, {
        cwd: '/home/jrvs/developerWorkspace/artimus',
        env: { ...process.env, PATH: `${process.env.PATH || ''}:/home/jrvs/.local/bin:/usr/local/bin:/usr/bin` }
      });

      let output = stdout.trim();
      if (!output && stderr) output = "Error:\n" + stderr;
      if (!output) output = "Task completed.";

      // Strip ANSI
      output = output.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');

      // Parse SEND_FILE lines
      const sendFileRegex = /SEND_FILE:\s*(.+)/g;
      let match;
      while ((match = sendFileRegex.exec(output)) !== null) {
         const filepath = match[1].trim();
         console.log("Found file to send: ", filepath);
         try {
           if (filepath.match(/\.(png|jpe?g|gif)$/i)) {
             await ctx.replyWithPhoto({ source: filepath });
           } else {
             await ctx.replyWithDocument({ source: filepath });
           }
         } catch (e) { console.error("Send file error:", e); }
      }
      
      output = output.replace(sendFileRegex, '').trim();

      if (output) {
         history.push({ role: 'assistant', content: output });
         saveDb();
         for (let i = 0; i < output.length; i += 4000) {
            await ctx.reply(output.substring(i, i+4000), { reply_to_message_id: ctx.message.message_id }).catch(e => console.error(e));
         }
      }
      await emitTelemetry('artimus', 'Online', 'Awaiting next task...', 'Run AGY', 'success');

    } catch (error) {
      console.error('[AGY Error]', error.message || error);
      const errMsg = (error.stderr || error.message || "").toLowerCase();
      if (errMsg.includes('model') || errMsg.includes('provider') || errMsg.includes('not found') || errMsg.includes('invalid')) {
        ctx.reply("❌ Failed to run the AI. It seems the model you requested is invalid or unavailable. Type `/model clear` to reset, or `/model help` for recommendations.", { parse_mode: 'Markdown' }).catch(e => console.error(e));
      } else {
        ctx.reply("Sorry, my brain had a hiccup.").catch(e => console.error(e));
      }
      await emitTelemetry('artimus', 'Online', 'Awaiting next task...', 'Run AGY', 'error');
    } finally {
      chatLocks[chatId] = false;
    }

  }
});

bot.catch((err, ctx) => console.error(`[Error]`, err.message));

initMcp().then(async () => {
  await initTelemetry();
  bot.launch().then(async () => {
    console.log('Chatbot is running and connected to MCP!');
    await emitTelemetry('artimus', 'Online', 'Awaiting next task...', 'Startup', 'success');
  });
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
