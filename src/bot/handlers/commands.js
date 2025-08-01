const notionService = require('../../services/notionService');
const userService = require('../../services/userService');
const keyboards = require('../keyboards/inline');

module.exports = (bot) => {
  // Минимальный набор команд
  // Весь основной функционал доступен через кнопки
  
  const ADMIN_IDS = [385436658, 1734337242]; // Boris и Ivan
  
  // Команда для отладки статусов задач (только для администраторов)
  bot.onText(/\/check_task_statuses/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Проверяем, что это администратор
    if (!ADMIN_IDS.includes(userId)) return;
    
    try {
      const { getAllTasks } = require('../../services/notionService');
      
      // Получаем все задачи без фильтра
      const allTasks = await getAllTasks();
      
      // Группируем по статусам
      const statusGroups = {};
      allTasks.forEach(task => {
        const status = task.status || 'Без статуса';
        if (!statusGroups[status]) {
          statusGroups[status] = 0;
        }
        statusGroups[status]++;
      });
      
      let message = '📊 *Статистика задач по статусам:*\n\n';
      message += `Всего задач: ${allTasks.length}\n\n`;
      
      Object.entries(statusGroups).forEach(([status, count]) => {
        message += `${status}: ${count} задач\n`;
      });
      
      // Проверяем конкретные статусы
      message += '\n*Проверка конкретных статусов:*\n';
      const statuses = ['Новая', 'В работе', 'Выполнена'];
      
      for (const status of statuses) {
        const tasksWithStatus = await getAllTasks(status);
        message += `"${status}": ${tasksWithStatus.length} задач\n`;
      }
      
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      
    } catch (error) {
      console.error('Check task statuses error:', error);
      await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
  });
  
  // Команда для проверки базы данных (только для администраторов)
  bot.onText(/\/check_db/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!ADMIN_IDS.includes(userId)) return;
    
    try {
      const connected = await notionService.testTasksDatabase();
      if (connected) {
        await bot.sendMessage(chatId, '✅ База данных задач подключена');
      } else {
        await bot.sendMessage(chatId, '❌ Проблема с подключением к базе данных задач');
      }
    } catch (error) {
      console.error('Check DB error:', error);
      await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
  });
};