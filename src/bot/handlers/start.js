const userService = require('../../services/userService');
const keyboards = require('../keyboards/inline');
const replyKeyboards = require('../keyboards/reply');
const security = require('../../utils/security');

// Храним состояния регистрации
const registrationStates = new Map();

module.exports = (bot) => {
  console.log('Registering /start handler');
  
  // Обработчик команды /start
  bot.onText(/\/start/, async (msg) => {
    security.secureLog('Start command received', { 
      userId: msg.from.id,
      username: msg.from.username 
    });
    
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || '';
    
    // Убираем все проверки - бот доступен всем
    
    try {
      console.log('Checking for existing user with ID:', userId);
      const existingUser = await userService.getUserByTelegramId(userId);
      console.log('Existing user:', existingUser);
      
      // Всегда отправляем приветствие с WebApp, независимо от того, новый пользователь или нет
      console.log('Sending welcome message');
      
      // Отправляем приветствие с кнопкой Web App
      let webAppUrl = process.env.WEBAPP_URL;
      
      // Проверяем, установлен ли WEBAPP_URL
      if (!webAppUrl) {
        console.warn('⚠️ WEBAPP_URL not set in environment!');
        
        // Автоматическое определение URL для Railway
        if (process.env.RAILWAY_STATIC_URL) {
          webAppUrl = `https://${process.env.RAILWAY_STATIC_URL}/webapp/public`;
          console.log('Using RAILWAY_STATIC_URL:', webAppUrl);
        } else if (process.env.RAILWAY_PUBLIC_DOMAIN) {
          webAppUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/webapp/public`;
          console.log('Using RAILWAY_PUBLIC_DOMAIN:', webAppUrl);
        } else if (process.env.RAILWAY_DEPLOYMENT_NAME) {
          // Railway v2
          webAppUrl = `https://${process.env.RAILWAY_DEPLOYMENT_NAME}.up.railway.app/webapp/public`;
          console.log('Using RAILWAY_DEPLOYMENT_NAME:', webAppUrl);
        } else {
          // Для локальной разработки используем ngrok или другой HTTPS туннель
          webAppUrl = 'https://tgbotkaifstaff-production.up.railway.app/webapp/public';
          console.log('Using production URL fallback:', webAppUrl);
        }
      }
      
      // Убедимся, что URL использует HTTPS
      if (webAppUrl.startsWith('http://') && !webAppUrl.includes('localhost')) {
        webAppUrl = webAppUrl.replace('http://', 'https://');
        console.log('Converted to HTTPS:', webAppUrl);
      }
      
      console.log('✅ Final WebApp URL:', webAppUrl);
      
      const userName = existingUser ? existingUser.name : 'Пользователь';
      
      await bot.sendMessage(chatId, 
        `Добро пожаловать в KAIF Staff! 👋\n\n` +
        `Используйте Web App для работы с системой.`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🚀 Открыть KAIF App',
                  web_app: { url: webAppUrl }
                }
              ]
            ]
          }
        }
      );
      
      // Удаляем состояние регистрации если есть
      registrationStates.delete(userId);
    } catch (error) {
      console.error('Start command error:', error);
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
      bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте еще раз.');
    }
  });

  // Удаляем обработчик регистрации - теперь все происходит через WebApp
};