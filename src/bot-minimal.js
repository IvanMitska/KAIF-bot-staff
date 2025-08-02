require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// Проверка токена
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN не найден!');
  process.exit(1);
}

console.log('🚀 Запуск минимального бота...');

// Создаем бота
const bot = new TelegramBot(token, { 
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

// Удаляем вебхук если был
bot.deleteWebHook().then(() => {
  console.log('✅ Webhook удален');
  
  // Проверяем информацию о боте
  bot.getMe().then(botInfo => {
    console.log(`✅ Бот подключен: @${botInfo.username}`);
    
    // Загружаем ТОЛЬКО Web App обработчик
    require('./bot/webAppOnly')(bot);
    
    console.log('✅ Бот готов к работе в режиме Web App Only');
  }).catch(err => {
    console.error('❌ Ошибка получения информации о боте:', err);
    process.exit(1);
  });
}).catch(err => {
  console.error('❌ Ошибка удаления webhook:', err);
});

// Обработка ошибок
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.code, error.message);
});

bot.on('error', (error) => {
  console.error('Bot error:', error.code, error.message);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️ Остановка бота...');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⏹️ Остановка бота...');
  bot.stopPolling();
  process.exit(0);
});