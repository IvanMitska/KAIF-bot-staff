// Резервная копия команд для разработчиков
const notionService = require('../../services/notionService');
const userService = require('../../services/userService');
const keyboards = require('../keyboards/inline');
const schedulerService = require('../../services/schedulerService');
const moment = require('moment-timezone');

module.exports = (bot) => {
  // Все пользовательские команды закомментированы
  // Функционал доступен через кнопки интерфейса
  
  // Оставляем только команды для разработчиков/администраторов
  const ADMIN_IDS = [385436658, 1734337242]; // Boris и Ivan
  
  // Команда для отладки статусов (только для админов)
  bot.onText(/\/check_statuses/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!ADMIN_IDS.includes(userId)) return;
    
    try {
      const { getAllTasks } = require('../../services/notionService');
      const tasks = await getAllTasks();
      
      const statuses = {};
      tasks.forEach(task => {
        const status = task.status || 'Без статуса';
        statuses[status] = (statuses[status] || 0) + 1;
      });
      
      let message = '📊 Статусы задач:\n\n';
      Object.entries(statuses).forEach(([status, count]) => {
        message += `${status}: ${count}\n`;
      });
      
      await bot.sendMessage(chatId, message);
    } catch (error) {
      console.error('Check statuses error:', error);
      await bot.sendMessage(chatId, `Ошибка: ${error.message}`);
    }
  });
  
  // Команда для отладки пользователей (только для админов)
  bot.onText(/\/debug_users/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!ADMIN_IDS.includes(userId)) return;
    
    try {
      const { getAllActiveUsers } = require('../../services/notionService');
      const users = await getAllActiveUsers();
      
      let message = '👥 Активные пользователи:\n\n';
      users.forEach(user => {
        message += `${user.name} (${user.telegramId})\n`;
      });
      
      await bot.sendMessage(chatId, message);
    } catch (error) {
      console.error('Debug users error:', error);
      await bot.sendMessage(chatId, `Ошибка: ${error.message}`);
    }
  });
};