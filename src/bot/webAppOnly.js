const userService = require('../services/userService');
const security = require('../utils/security');

// Глобальный флаг для предотвращения дублирования обработчиков
let handlersRegistered = false;

module.exports = (bot) => {
  console.log('🌐 Инициализация Web App Only режима');
  
  if (handlersRegistered) {
    console.log('⚠️ Обработчики уже зарегистрированы, пропускаем');
    return;
  }
  
  // Получаем URL Web App один раз
  let webAppUrl = process.env.WEBAPP_URL;
  if (!webAppUrl && process.env.RAILWAY_STATIC_URL) {
    webAppUrl = `https://${process.env.RAILWAY_STATIC_URL}/webapp/public`;
  } else if (!webAppUrl && process.env.RAILWAY_PUBLIC_DOMAIN) {
    webAppUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/webapp/public`;
  } else if (!webAppUrl) {
    webAppUrl = 'https://telegram-report-bot-production.up.railway.app/webapp/public';
  }
  
  console.log(`📱 Web App URL: ${webAppUrl}`);
  
  // Команда /start - основная точка входа
  bot.onText(/^\/start$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    console.log(`📱 Получена команда /start от пользователя ${userId} (@${msg.from.username})`);
    
    // Проверка авторизации
    if (!security.isUserAuthorized(userId)) {
      console.log(`❌ Пользователь ${userId} не авторизован`);
      await bot.sendMessage(chatId, 
        '🚫 У вас нет доступа к этому боту.\n\n' +
        'Обратитесь к администратору.'
      );
      return;
    }
    
    try {
      // Проверяем существующего пользователя
      const existingUser = await userService.getUserByTelegramId(userId);
      
      const welcomeText = existingUser 
        ? `Привет, ${existingUser.name}! 👋\n\nВсе функции доступны в приложении:`
        : `Добро пожаловать! 👋\n\nДля начала работы откройте приложение:`;
      
      // Отправляем только кнопку Web App БЕЗ reply_markup клавиатуры
      await bot.sendMessage(chatId, welcomeText, {
        reply_markup: {
          inline_keyboard: [[
            {
              text: '🚀 Открыть KAIF App',
              web_app: { url: webAppUrl }
            }
          ]],
          remove_keyboard: true // Убираем любую существующую клавиатуру
        }
      });
      
    } catch (error) {
      console.error('Ошибка в /start:', error);
      await bot.sendMessage(chatId, 
        'Произошла ошибка. Попробуйте позже.', 
        { 
          reply_markup: { 
            remove_keyboard: true 
          } 
        }
      );
    }
  });
  
  // Обработка других сообщений - НЕ регистрируем общий обработчик message
  // чтобы избежать конфликтов
  
  // Обработка callback queries (если кто-то нажмет старые кнопки)
  bot.on('callback_query', async (callbackQuery) => {
    try {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Используйте Web App для этой функции',
        show_alert: true
      });
    } catch (error) {
      console.error('Ошибка в callback_query:', error);
    }
  });
  
  handlersRegistered = true;
  console.log('✅ Web App Only обработчики зарегистрированы');
};