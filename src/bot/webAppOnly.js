const TelegramBot = require('node-telegram-bot-api');
const userService = require('../services/userService');
const security = require('../utils/security');

module.exports = (bot) => {
  console.log('🌐 Инициализация Web App Only режима');
  
  // Единственная команда - /start
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Проверка авторизации
    if (!security.isUserAuthorized(userId)) {
      await bot.sendMessage(chatId, 
        '🚫 У вас нет доступа к этому боту.\n\n' +
        'Обратитесь к администратору.'
      );
      return;
    }
    
    try {
      // Получаем URL Web App
      let webAppUrl = process.env.WEBAPP_URL;
      
      if (!webAppUrl && process.env.RAILWAY_STATIC_URL) {
        webAppUrl = `https://${process.env.RAILWAY_STATIC_URL}/webapp/public`;
      } else if (!webAppUrl && process.env.RAILWAY_PUBLIC_DOMAIN) {
        webAppUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/webapp/public`;
      } else if (!webAppUrl) {
        webAppUrl = 'http://localhost:3001';
      }
      
      // Проверяем существующего пользователя
      const existingUser = await userService.getUserByTelegramId(userId);
      
      const welcomeText = existingUser 
        ? `Привет, ${existingUser.name}! 👋\n\nВсе функции доступны в приложении:`
        : `Добро пожаловать! 👋\n\nДля начала работы откройте приложение:`;
      
      // Отправляем только кнопку Web App
      await bot.sendMessage(chatId, welcomeText, {
        reply_markup: {
          inline_keyboard: [[
            {
              text: '🚀 Открыть KAIF App',
              web_app: { url: webAppUrl }
            }
          ]]
        }
      });
      
    } catch (error) {
      console.error('Ошибка в /start:', error);
      await bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
    }
  });
  
  // Обработка любых других сообщений
  bot.on('message', async (msg) => {
    // Игнорируем команду /start
    if (msg.text && msg.text.startsWith('/start')) return;
    
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Проверка авторизации
    if (!security.isUserAuthorized(userId)) return;
    
    // Получаем URL Web App
    let webAppUrl = process.env.WEBAPP_URL;
    
    if (!webAppUrl && process.env.RAILWAY_STATIC_URL) {
      webAppUrl = `https://${process.env.RAILWAY_STATIC_URL}/webapp/public`;
    } else if (!webAppUrl && process.env.RAILWAY_PUBLIC_DOMAIN) {
      webAppUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/webapp/public`;
    } else if (!webAppUrl) {
      webAppUrl = 'http://localhost:3001';
    }
    
    // Всегда отправляем кнопку Web App
    await bot.sendMessage(chatId, 
      'Все функции доступны в приложении:', 
      {
        reply_markup: {
          inline_keyboard: [[
            {
              text: '🚀 Открыть KAIF App',
              web_app: { url: webAppUrl }
            }
          ]]
        }
      }
    );
  });
  
  // Обработка callback queries (если кто-то нажмет старые кнопки)
  bot.on('callback_query', async (callbackQuery) => {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Используйте Web App для этой функции',
      show_alert: true
    });
  });
};