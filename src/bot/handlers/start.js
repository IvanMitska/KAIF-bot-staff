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
    
    // Проверка авторизации
    if (!security.isUserAuthorized(userId)) {
      security.secureLog('Unauthorized access attempt', { userId });
      await bot.sendMessage(chatId, 
        '🚫 Извините, вы не авторизованы для использования этого бота.\n\n' +
        'Обратитесь к администратору для получения доступа.'
      );
      return;
    }
    
    // Проверка rate limit
    const rateLimit = security.checkRateLimit(userId, 'start', 5, 300000); // 5 раз за 5 минут
    if (!rateLimit.allowed) {
      await bot.sendMessage(chatId, 
        `⏳ Слишком много попыток. Попробуйте через ${rateLimit.resetIn} секунд.`
      );
      return;
    }
    
    try {
      console.log('Checking for existing user with ID:', userId);
      const existingUser = await userService.getUserByTelegramId(userId);
      console.log('Existing user:', existingUser);
      
      if (existingUser) {
        console.log('Sending welcome back message');
        const MANAGER_IDS = [385436658, 1734337242];
        const isManager = MANAGER_IDS.includes(userId);
        
        // Отправляем приветствие с кнопкой Web App
        const webAppUrl = process.env.WEBAPP_URL || `https://${process.env.RAILWAY_STATIC_URL || 'localhost:3000'}`;
        
        await bot.sendMessage(chatId, 
          `С возвращением, ${existingUser.name}! 👋\n\n` +
          `Используйте Web App для удобной работы или продолжите в обычном режиме.`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '🚀 Открыть KAIF App',
                    web_app: { url: webAppUrl }
                  }
                ],
                [
                  { text: '📱 Обычный режим', callback_data: 'classic_mode' }
                ]
              ]
            }
          }
        );
        // Удаляем состояние регистрации если есть
        registrationStates.delete(userId);
      } else {
        console.log('New user, sending registration prompt to chat:', chatId);
        await bot.sendMessage(chatId, 
          'Добро пожаловать! 👋\n\n' +
          'Я бот для сбора ежедневных отчетов.\n' +
          'Давайте начнем с регистрации.\n\n' +
          'Как вас зовут?'
        );
        
        // Устанавливаем состояние регистрации
        registrationStates.set(userId, {
          step: 'name',
          chatId: chatId,
          username: username
        });
      }
    } catch (error) {
      console.error('Start command error:', error);
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
      bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте еще раз.');
    }
  });

  // Обработчик всех сообщений для регистрации
  bot.on('message', async (msg) => {
    console.log('Message handler in start.js:', msg.text, 'from:', msg.from.id);
    
    // Игнорируем команды
    if (msg.text && msg.text.startsWith('/')) {
      console.log('Ignoring command in registration handler');
      return;
    }
    
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    
    // Проверяем, есть ли пользователь в процессе регистрации
    console.log('Current registration states:', Array.from(registrationStates.keys()));
    console.log('Checking for userId:', userId);
    
    if (registrationStates.has(userId)) {
      const state = registrationStates.get(userId);
      console.log('User state found:', state);
      
      if (state.step === 'name') {
        const name = msg.text;
        
        // Валидация имени
        const sanitizedName = security.sanitizeInput(name, security.getFieldLimits().name);
        if (sanitizedName.length < 2) {
          await bot.sendMessage(chatId, '❌ Имя слишком короткое. Минимум 2 символа.');
          return;
        }
        
        security.secureLog('User provided name', { userId });
        
        await bot.sendMessage(chatId, `Приятно познакомиться, ${security.escapeMarkdown(sanitizedName)}!\n\nКакая у вас должность?`);
        
        // Обновляем состояние
        registrationStates.set(userId, {
          ...state,
          step: 'position',
          name: sanitizedName
        });
        
      } else if (state.step === 'position') {
        const position = msg.text;
        
        // Валидация должности
        const sanitizedPosition = security.sanitizeInput(position, security.getFieldLimits().position);
        if (sanitizedPosition.length < 2) {
          await bot.sendMessage(chatId, '❌ Должность слишком короткая. Минимум 2 символа.');
          return;
        }
        
        security.secureLog('User provided position', { userId });
        
        try {
          await userService.createUser({
            telegramId: userId,
            username: state.username,
            name: state.name,
            position: sanitizedPosition
          });
          
          await bot.sendMessage(chatId, 
            `Отлично! Регистрация завершена. ✅\n\n` +
            `Имя: ${state.name}\n` +
            `Должность: ${sanitizedPosition}\n\n` +
            `Теперь вы можете отправлять ежедневные отчеты.\n` +
            `Каждый день в 20:00 я буду напоминать вам об этом.`,
            {
              reply_markup: keyboards.mainMenu()
            }
          );
          
          // Удаляем состояние регистрации
          registrationStates.delete(userId);
          
        } catch (error) {
          console.error('Registration error:', error);
          bot.sendMessage(chatId, 'Произошла ошибка при регистрации. Попробуйте еще раз /start');
          registrationStates.delete(userId);
        }
      }
    } else {
      // Если пользователь не в процессе регистрации, проверяем сессию отчета
      const reportHandler = require('./report');
      if (reportHandler.handleMessageInput) {
        await reportHandler.handleMessageInput(bot, msg);
      }
    }
  });
};