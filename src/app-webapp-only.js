require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const security = require('./utils/security');

// Проверка переменных окружения
const requiredEnvVars = ['TELEGRAM_BOT_TOKEN'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Отсутствуют обязательные переменные:', missingVars.join(', '));
  process.exit(1);
}

// Инициализация бота
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Загружаем обработчик Web App
require('./bot/webAppOnly')(bot);

// Обработка ошибок
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

bot.on('error', (error) => {
  console.error('Bot error:', error);
});

console.log('🤖 Бот запущен в режиме Web App Only');
console.log('📱 Все функции доступны только через Web App');