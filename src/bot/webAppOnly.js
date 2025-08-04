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
  
  // Обработка callback queries
  bot.on('callback_query', async (callbackQuery) => {
    try {
      const userId = callbackQuery.from.id;
      const data = callbackQuery.data;
      
      if (data === 'skip_photo') {
        // Очищаем ожидание фото
        if (global.pendingTaskPhotos) {
          global.pendingTaskPhotos.delete(userId);
        }
        
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: '✅ Задача завершена без фото'
        });
        
        await bot.editMessageText(
          '✅ Задача успешно выполнена!',
          {
            chat_id: callbackQuery.message.chat.id,
            message_id: callbackQuery.message.message_id
          }
        );
      } else {
        // Для старых кнопок
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: 'Используйте Web App для этой функции',
          show_alert: true
        });
      }
    } catch (error) {
      console.error('Ошибка в callback_query:', error);
    }
  });
  
  // Обработка фото для выполненных задач
  bot.on('photo', async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    
    // Проверяем, ожидаем ли мы фото от этого пользователя
    if (!global.pendingTaskPhotos || !global.pendingTaskPhotos.has(userId)) {
      return; // Игнорируем фото, если не ожидаем
    }
    
    const pendingTask = global.pendingTaskPhotos.get(userId);
    
    // Проверяем таймаут (30 минут)
    if (Date.now() - pendingTask.timestamp > 30 * 60 * 1000) {
      global.pendingTaskPhotos.delete(userId);
      return;
    }
    
    try {
      // Получаем файл фото (берем самое большое разрешение)
      const photo = msg.photo[msg.photo.length - 1];
      const file = await bot.getFile(photo.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
      
      console.log('Photo received for task:', pendingTask.taskId, 'from user:', userId);
      
      // Обновляем задачу в Notion с фото
      const notionService = require('../services/notionService');
      await notionService.addPhotoToTask(pendingTask.taskId, fileUrl, msg.caption || '');
      
      // Очищаем ожидание
      global.pendingTaskPhotos.delete(userId);
      
      await bot.sendMessage(chatId, 
        '📸 Фото успешно прикреплено к задаче!',
        {
          reply_markup: {
            inline_keyboard: [[
              {
                text: '📱 Вернуться в KAIF App',
                web_app: { url: `https://${process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN}/webapp/public` }
              }
            ]]
          }
        }
      );
    } catch (error) {
      console.error('Error processing photo:', error);
      await bot.sendMessage(chatId, '❌ Ошибка при сохранении фото. Попробуйте позже.');
    }
  });
  
  handlersRegistered = true;
  console.log('✅ Web App Only обработчики зарегистрированы');
};