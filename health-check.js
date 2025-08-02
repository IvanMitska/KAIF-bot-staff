// Проверка работоспособности бота
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { Client } = require('@notionhq/client');

console.log('🔍 Проверка конфигурации...\n');

// Проверка переменных окружения
const requiredVars = [
  'TELEGRAM_BOT_TOKEN',
  'NOTION_API_KEY',
  'NOTION_DATABASE_REPORTS_ID',
  'NOTION_DATABASE_USERS_ID',
  'NOTION_DATABASE_TASKS_ID'
];

const missingVars = [];
requiredVars.forEach(varName => {
  if (!process.env[varName]) {
    missingVars.push(varName);
    console.log(`❌ ${varName}: НЕ НАЙДЕНО`);
  } else {
    console.log(`✅ ${varName}: ${process.env[varName].substring(0, 10)}...`);
  }
});

if (missingVars.length > 0) {
  console.log('\n❌ Отсутствуют переменные:', missingVars.join(', '));
  process.exit(1);
}

console.log('\n✅ Все переменные окружения найдены!');

// Проверка подключения к Telegram
console.log('\n🔍 Проверка подключения к Telegram...');
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

bot.getMe()
  .then(botInfo => {
    console.log(`✅ Бот подключен: @${botInfo.username} (${botInfo.first_name})`);
    
    // Проверка подключения к Notion
    console.log('\n🔍 Проверка подключения к Notion...');
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    
    return notion.databases.retrieve({
      database_id: process.env.NOTION_DATABASE_USERS_ID
    });
  })
  .then(database => {
    console.log(`✅ Notion подключен: База "${database.title[0]?.plain_text || 'Users'}"`);
    console.log('\n✅ Все системы работают корректно!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Ошибка:', error.message);
    process.exit(1);
  });