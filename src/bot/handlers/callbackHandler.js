const { handleNewTask } = require('./tasks');
const { handleEmployeeSelection, handlePrioritySelection, confirmTaskCreation } = require('./taskCreation');
const { handleMyTasks, handleAllTasks, handleTaskDetails, handleTaskStatusUpdate } = require('./taskList');
const { userStates } = require('../state');

async function handleCallbackQuery(bot, callbackQuery) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  
  // Пропускаем только tasks_menu, так как он обрабатывается в commands.js
  if (data === 'tasks_menu') {
    return;
  }
  
  try {
    // Отправляем подтверждение получения callback
    await bot.answerCallbackQuery(callbackQuery.id);
    
    // Обработка callback'ов для задач
    // tasks_menu обрабатывается в commands.js
    
    if (data === 'new_task') {
      await handleNewTask(bot, callbackQuery);
      return;
    }
    
    if (data === 'my_tasks' || data === 'back_to_tasks') {
      await handleMyTasks(bot, callbackQuery);
      return;
    }
    
    if (data === 'all_tasks' || data === 'completed_tasks' || 
        data === 'in_progress_tasks' || data === 'new_tasks') {
      await handleAllTasks(bot, callbackQuery);
      return;
    }
    
    if (data === 'my_new_tasks' || data === 'my_in_progress_tasks' || data === 'my_completed_tasks') {
      const statusMap = {
        'my_new_tasks': 'Новая',
        'my_in_progress_tasks': 'В работе',
        'my_completed_tasks': 'Выполнена'
      };
      
      const status = statusMap[data];
      if (status) {
        // Фильтруем задачи по статусу для сотрудника
        await handleMyTasks(bot, callbackQuery, status);
        return;
      }
    }
    
    if (data.startsWith('assign_to_')) {
      const employeeId = parseInt(data.replace('assign_to_', ''));
      await handleEmployeeSelection(bot, callbackQuery, employeeId);
      return;
    }
    
    if (data.startsWith('priority_')) {
      const priority = data.replace('priority_', '');
      await handlePrioritySelection(bot, callbackQuery, priority);
      return;
    }
    
    if (data === 'confirm_create_task') {
      await confirmTaskCreation(bot, callbackQuery);
      return;
    }
    
    if (data === 'cancel_task') {
      delete userStates[userId];
      await bot.editMessageText(
        '❌ Создание задачи отменено',
        {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id
        }
      );
      return;
    }
    
    if (data.startsWith('task_')) {
      const taskId = data.replace('task_', '');
      await handleTaskDetails(bot, callbackQuery, taskId);
      return;
    }
    
    if (data.startsWith('start_task_') || data.startsWith('complete_task_')) {
      const parts = data.split('_');
      const action = `${parts[0]}_${parts[1]}`;
      const taskId = parts.slice(2).join('_');
      await handleTaskStatusUpdate(bot, callbackQuery, action, taskId);
      return;
    }
    
    if (data === 'back_to_menu') {
      // Возвращаемся в главное меню задач
      const { handleTasksCommand } = require('./tasks');
      await handleTasksCommand(bot, callbackQuery.message);
      return;
    }
    
  } catch (error) {
    console.error('Error handling callback:', error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ Произошла ошибка',
      show_alert: true
    });
  }
}

module.exports = { handleCallbackQuery };