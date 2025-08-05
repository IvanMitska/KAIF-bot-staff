const userService = require('../services/userService');
const security = require('../utils/security');

// Глобальный флаг для предотвращения дублирования обработчиков
let handlersRegistered = false;

// Хранилище для предотвращения дублирования сообщений
const processedMessages = new Set();

module.exports = (bot) => {
  console.log('🌐 Инициализация Web App Only режима');
  
  if (handlersRegistered) {
    console.log('⚠️ Обработчики уже зарегистрированы, пропускаем');
    return;
  }
  
  // Логируем все входящие сообщения для отладки
  bot.on('message', (msg) => {
    console.log(`📨 Получено сообщение от ${msg.from.id} (@${msg.from.username}): ${msg.text || '[не текст]'}`);
    console.log('Тип чата:', msg.chat.type);
    console.log('Chat ID:', msg.chat.id);
  });
  
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
  bot.onText(/^\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageId = msg.message_id;
    
    // Проверяем, не обработали ли мы уже это сообщение
    const messageKey = `${chatId}-${messageId}`;
    if (processedMessages.has(messageKey)) {
      console.log('⚠️ Сообщение уже обработано, пропускаем');
      return;
    }
    
    // Добавляем в обработанные
    processedMessages.add(messageKey);
    
    // Очищаем старые записи через 5 минут
    setTimeout(() => {
      processedMessages.delete(messageKey);
    }, 5 * 60 * 1000);
    
    console.log(`📱 Команда /start получена от пользователя ${userId}`);
    console.log('URL для Web App:', webAppUrl);
    
    try {
      // Отправляем приветственное сообщение без проверки авторизации
      const message = await bot.sendMessage(chatId, 
        `Привет! 👋\n\nВсе функции доступны в приложении:`,
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
      
      console.log('✅ Сообщение /start отправлено успешно');
      
    } catch (error) {
      console.error('❌ Ошибка в обработчике /start:', error.message);
      
      // Пробуем отправить простое текстовое сообщение
      try {
        await bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте еще раз.');
      } catch (sendError) {
        console.error('❌ Не удалось отправить даже простое сообщение:', sendError.message);
      }
    }
  });
  
  
  // Обработка callback queries
  bot.on('callback_query', async (callbackQuery) => {
    try {
      const userId = callbackQuery.from.id;
      const data = callbackQuery.data;
      
      console.log(`🔘 Callback query от ${userId}: ${data}`);
      
      if (data === 'retry_start') {
        // Повторная попытка открыть Web App
        await bot.answerCallbackQuery(callbackQuery.id);
        
        try {
          const existingUser = await userService.getUserByTelegramId(userId);
          
          const welcomeText = existingUser 
            ? `Привет, ${existingUser.name}! 👋\n\nВсе функции доступны в приложении:`
            : `Добро пожаловать! 👋\n\nДля начала работы откройте приложение:`;
          
          await bot.editMessageText(welcomeText, {
            chat_id: callbackQuery.message.chat.id,
            message_id: callbackQuery.message.message_id,
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
          console.error('Ошибка при retry_start:', error);
        }
      } else if (data === 'skip_photo') {
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
  
  // Команда /help
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    console.log(`ℹ️ Команда /help от пользователя ${userId}`);
    
    try {
      await bot.sendMessage(chatId, 
        'ℹ️ *Справка по боту*\n\n' +
        '• /start - Открыть приложение\n' +
        '• /help - Показать эту справку\n\n' +
        'Если возникла ошибка, подождите минуту и попробуйте снова.',
        {
          parse_mode: 'Markdown',
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
    } catch (error) {
      console.error('Ошибка в /help:', error);
    }
  });
  
  // Команда /reset_limit (только для администраторов)
  bot.onText(/^\/reset_limit/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Только для менеджеров
    const MANAGER_IDS = [385436658, 1734337242];
    if (!MANAGER_IDS.includes(userId)) {
      return;
    }
    
    // Очищаем rate limiter
    const cleaned = security.cleanupRateLimiter();
    await bot.sendMessage(chatId, `✅ Rate limiter очищен. Удалено записей: ${cleaned}`);
  });
  
  handlersRegistered = true;
  console.log('✅ Web App Only обработчики зарегистрированы');
};