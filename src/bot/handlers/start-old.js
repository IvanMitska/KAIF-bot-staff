const userService = require('../../services/userService');
const keyboards = require('../keyboards/inline');

module.exports = (bot) => {
  console.log('Registering /start handler');
  
  bot.onText(/\/start/, async (msg) => {
    console.log('Start command received from:', msg.from.username || msg.from.id);
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || '';
    
    try {
      console.log('Checking for existing user with ID:', userId);
      const existingUser = await userService.getUserByTelegramId(userId);
      console.log('Existing user:', existingUser);
      
      if (existingUser) {
        console.log('Sending welcome back message');
        await bot.sendMessage(chatId, `С возвращением, ${existingUser.name}! 👋`, {
          reply_markup: keyboards.mainMenu()
        });
      } else {
        console.log('New user, sending registration prompt to chat:', chatId);
        await bot.sendMessage(chatId, 
          'Добро пожаловать! 👋\n\n' +
          'Я бот для сбора ежедневных отчетов.\n' +
          'Давайте начнем с регистрации.\n\n' +
          'Как вас зовут?'
        ).then(() => {
          console.log('Registration prompt sent successfully');
        }).catch(err => {
          console.error('Failed to send registration prompt:', err);
        });
        
        bot.once('message', async (nameMsg) => {
          if (nameMsg.chat.id !== chatId) return;
          if (nameMsg.text && nameMsg.text.startsWith('/')) return; // Игнорируем команды
          
          const name = nameMsg.text;
          console.log('User provided name:', name);
          await bot.sendMessage(chatId, `Приятно познакомиться, ${name}!\n\nКакая у вас должность?`);
          
          bot.once('message', async (positionMsg) => {
            if (positionMsg.chat.id !== chatId) return;
            if (positionMsg.text && positionMsg.text.startsWith('/')) return; // Игнорируем команды
            
            const position = positionMsg.text;
            
            try {
              await userService.createUser({
                telegramId: userId,
                username: username,
                name: name,
                position: position
              });
              
              bot.sendMessage(chatId, 
                `Отлично! Регистрация завершена. ✅\n\n` +
                `Имя: ${name}\n` +
                `Должность: ${position}\n\n` +
                `Теперь вы можете отправлять ежедневные отчеты.\n` +
                `Каждый день в 20:00 я буду напоминать вам об этом.`,
                {
                  reply_markup: keyboards.mainMenu()
                }
              );
            } catch (error) {
              console.error('Registration error:', error);
              bot.sendMessage(chatId, 'Произошла ошибка при регистрации. Попробуйте еще раз /start');
            }
          });
        });
      }
    } catch (error) {
      console.error('Start command error:', error);
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
      bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте еще раз.');
    }
  });
};