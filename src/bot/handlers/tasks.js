const { getUser } = require('../../services/notionService');
const { taskKeyboards } = require('../keyboards/taskKeyboards');
const { userStates } = require('../state');

const BORIS_ID = 385436658; // ID менеджера Бориса

async function handleTasksCommand(bot, msgOrQuery) {
  // Поддержка как обычных сообщений, так и callback query
  const isCallback = msgOrQuery.message !== undefined;
  const chatId = isCallback ? msgOrQuery.message.chat.id : msgOrQuery.chat.id;
  const userId = isCallback ? msgOrQuery.from.id : msgOrQuery.from.id;
  
  console.log('Raw msgOrQuery:', JSON.stringify(msgOrQuery, null, 2));
  
  try {
    console.log('handleTasksCommand called');
    console.log('isCallback:', isCallback);
    console.log('chatId:', chatId);
    console.log('userId:', userId);
    console.log('from object:', msgOrQuery.from);
    
    const user = await getUser(userId);
    if (!user) {
      await bot.sendMessage(chatId, '❌ Пользователь не найден. Пожалуйста, зарегистрируйтесь через /start');
      return;
    }
    
    // Проверяем, является ли пользователь менеджером
    const isManager = userId === BORIS_ID;
    
    const messageText = isManager 
      ? '📋 Управление задачами\n\nВыберите действие:'
      : '📋 Мои задачи\n\nВыберите действие:';
    
    const keyboard = isManager 
      ? taskKeyboards.managerMenu() 
      : taskKeyboards.employeeMenu();
    
    if (isCallback) {
      // Если это callback query, редактируем сообщение
      await bot.editMessageText(
        messageText,
        {
          chat_id: chatId,
          message_id: msgOrQuery.message.message_id,
          reply_markup: keyboard
        }
      );
    } else {
      // Если это обычное сообщение, отправляем новое
      await bot.sendMessage(
        chatId,
        messageText,
        { reply_markup: keyboard }
      );
    }
  } catch (error) {
    console.error('Error in handleTasksCommand:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    await bot.sendMessage(chatId, '❌ Произошла ошибка при загрузке меню задач');
  }
}

async function handleNewTask(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  
  if (userId !== BORIS_ID) {
    await bot.sendMessage(chatId, '❌ Только менеджер может создавать задачи');
    return;
  }
  
  // Получаем список сотрудников
  const users = await getAllUsers();
  const employees = users.filter(u => u.telegramId !== BORIS_ID);
  
  if (employees.length === 0) {
    await bot.sendMessage(chatId, '❌ Нет зарегистрированных сотрудников');
    return;
  }
  
  // Инициализируем состояние для создания задачи
  userStates[userId] = {
    state: 'creating_task',
    step: 'select_employee',
    taskData: {}
  };
  
  await bot.editMessageText(
    '👤 Выберите сотрудника для назначения задачи:',
    {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
      reply_markup: taskKeyboards.selectEmployee(employees)
    }
  );
}

async function getAllUsers() {
  const { getUsers } = require('../../services/notionService');
  try {
    return await getUsers();
  } catch (error) {
    console.error('Error getting users:', error);
    return [];
  }
}

module.exports = {
  handleTasksCommand,
  handleNewTask
};