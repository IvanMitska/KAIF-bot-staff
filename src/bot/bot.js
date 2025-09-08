const SimpleBot = require('./simple-bot');
const startHandler = require('./handlers/start');
const schedulerService = require('../services/schedulerService');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not provided!');
  process.exit(1);
}

const bot = new SimpleBot(token);

console.log('Bot initialized with token:', token.substring(0, 10) + '...');

// Удаляем webhook и запускаем polling
bot.deleteWebHook().then(() => {
  console.log('Webhook deleted');
  
  // Проверяем бота
  bot.getMe().then(info => {
    console.log('Bot info:', info);
    console.log(`Bot username: @${info.username}`);
    
    // Регистрируем только start handler для WebApp
    startHandler(bot);
    // Убираем все остальные обработчики - теперь все через WebApp
    
    schedulerService.initScheduler(bot);
    
    // Запускаем polling
    bot.startPolling();
    
    console.log('Bot is ready!');
  }).catch(err => {
    console.error('Failed to get bot info:', err);
  });
}).catch(err => {
  console.error('Failed to delete webhook:', err);
});

module.exports = bot;