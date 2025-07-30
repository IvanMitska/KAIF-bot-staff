const TelegramBot = require('node-telegram-bot-api');
const startHandler = require('./handlers/start');
const reportHandler = require('./handlers/report');
const commandsHandler = require('./handlers/commands');
const schedulerService = require('../services/schedulerService');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not provided!');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

console.log('Bot initialized with token:', token.substring(0, 10) + '...');

startHandler(bot);
reportHandler(bot);
commandsHandler(bot);

schedulerService.initScheduler(bot);

bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

bot.on('message', (msg) => {
  console.log(`[${new Date().toISOString()}] Message from ${msg.from.username || msg.from.id}: ${msg.text}`);
  
  // Временная проверка для отладки
  if (msg.text && msg.text.startsWith('/start')) {
    console.log('Start command detected in main handler');
  }
});

bot.on('callback_query', (query) => {
  console.log(`[${new Date().toISOString()}] Callback query from ${query.from.username || query.from.id}: ${query.data}`);
});

console.log('Bot started successfully');
console.log('Waiting for messages...');

module.exports = bot;