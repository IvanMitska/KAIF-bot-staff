const keyboards = require('../keyboards/inline');
const replyKeyboards = require('../keyboards/reply');

async function handleReplyKeyboard(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  
  const MANAGER_IDS = [385436658, 1734337242];
  const isManager = MANAGER_IDS.includes(userId);
  
  switch(text) {
    case '🚀 KAIF App':
      let webAppUrl = process.env.WEBAPP_URL;
      
      // Автоматическое определение URL
      if (!webAppUrl && process.env.RAILWAY_STATIC_URL) {
        webAppUrl = `https://${process.env.RAILWAY_STATIC_URL}/webapp/public`;
      } else if (!webAppUrl && process.env.RAILWAY_PUBLIC_DOMAIN) {
        webAppUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/webapp/public`;
      } else if (!webAppUrl && process.env.RAILWAY_GIT_COMMIT_SHA) {
        // Railway v2
        webAppUrl = `https://${process.env.RAILWAY_DEPLOYMENT_NAME}.up.railway.app/webapp/public`;
      } else if (!webAppUrl) {
        webAppUrl = 'http://localhost:3001';
      }
      
      await bot.sendMessage(chatId, 
        '🚀 Откройте KAIF App для удобной работы с отчетами и задачами', 
        {
          reply_markup: {
            inline_keyboard: [[
              {
                text: '📱 Открыть приложение',
                web_app: { url: webAppUrl }
              }
            ]]
          }
        }
      );
      return true;
      
      
    case '📝 Отчет':
      const { handleReportCommand } = require('./report');
      await handleReportCommand(bot, msg);
      return true;
      
    case '📊 Статистика':
      // Вызываем команду my_stats
      await bot.sendMessage(chatId, 'Загружаю вашу статистику...');
      bot.emit('callback_query', {
        from: { id: userId },
        message: { chat: { id: chatId }, message_id: msg.message_id },
        data: 'my_stats'
      });
      return true;
      
    case '✅ Задачи':
      const { handleTasksCommand } = require('./tasks');
      await handleTasksCommand(bot, msg);
      return true;
      
    case '⚡ Быстрая задача':
      if (isManager) {
        await bot.sendMessage(chatId, 'Загружаю меню быстрых задач...');
        bot.emit('callback_query', {
          from: { id: userId },
          message: { chat: { id: chatId }, message_id: msg.message_id },
          data: 'quick_task_menu'
        });
      }
      return true;
      
    case '👥 Сотрудники':
      if (isManager) {
        const { getAllActiveUsers } = require('../../services/notionService');
        try {
          const users = await getAllActiveUsers();
          let message = '👥 *Список сотрудников:*\n\n';
          
          users.forEach((user, index) => {
            message += `${index + 1}. 👤 ${user.name} - ${user.position}\n`;
          });
          
          await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (error) {
          await bot.sendMessage(chatId, '❌ Ошибка при получении списка сотрудников');
        }
      }
      return true;
      
    case '❓ Помощь':
      await bot.sendMessage(chatId, 'Загружаю справку...');
      bot.emit('callback_query', {
        from: { id: userId },
        message: { chat: { id: chatId }, message_id: msg.message_id },
        data: 'help'
      });
      return true;
      
    default:
      return false;
  }
}

module.exports = {
  handleReplyKeyboard
};