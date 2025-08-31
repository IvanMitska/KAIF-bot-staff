const { getUser } = require('../../services/railwayOptimizedService');
const { taskKeyboards } = require('../keyboards/taskKeyboards');
const replyKeyboards = require('../keyboards/reply');
const { userStates } = require('../state');

const MANAGER_IDS = [385436658, 1734337242]; // ID менеджеров: Борис и Иван

async function handleTasksCommand(bot, msgOrQuery) {
  // Поддержка как обычных сообщений, так и callback query
  const isCallback = msgOrQuery.message !== undefined;
  const chatId = isCallback ? msgOrQuery.message.chat.id : msgOrQuery.chat.id;
  const userId = isCallback ? msgOrQuery.from.id : msgOrQuery.from.id;
  
  // Удаляем лишнее логирование для продакшена
  // console.log('Raw msgOrQuery:', JSON.stringify(msgOrQuery, null, 2));
  
  try {
    console.log('handleTasksCommand called');
    console.log('isCallback:', isCallback);
    console.log('chatId:', chatId);
    console.log('userId:', userId);
    console.log('userId type:', typeof userId);
    
    // Проверяем, не является ли userId строкой с префиксом
    let actualUserId = userId;
    if (typeof userId === 'string' && userId.startsWith('USER_')) {
      console.log('WARNING: userId has USER_ prefix, this should not happen');
    }
    
    // Проверяем пользователя
    let user = null;
    try {
      user = await getUser(actualUserId);
    } catch (userError) {
      console.error('Error getting user:', userError);
    }
    
    if (!user) {
      const errorMsg = '❌ Пользователь не найден. Пожалуйста, зарегистрируйтесь через /start';
      if (isCallback) {
        await bot.editMessageText(errorMsg, {
          chat_id: chatId,
          message_id: msgOrQuery.message.message_id
        });
      } else {
        await bot.sendMessage(chatId, errorMsg);
      }
      return;
    }
    
    // Проверяем, является ли пользователь менеджером
    const isManager = MANAGER_IDS.includes(actualUserId);
    
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
    
    // Более детальное сообщение об ошибке
    let errorMessage = '❌ Произошла ошибка при загрузке меню задач';
    
    if (error.message.includes('not found')) {
      errorMessage = '❌ Пользователь не найден. Пожалуйста, зарегистрируйтесь через /start';
    } else if (error.message.includes('getUser')) {
      errorMessage = '❌ Ошибка при получении данных пользователя';
    }
    
    await bot.sendMessage(chatId, errorMessage);
  }
}

async function handleNewTask(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  
  const isManager = MANAGER_IDS.includes(userId);
  
  // Получаем список пользователей
  const users = await getAllUsers();
  let availableUsers = [];
  
  if (isManager) {
    // Менеджеры могут ставить задачи всем (включая себя)
    availableUsers = users;
  } else {
    // Обычные сотрудники могут ставить задачи только себе
    const selfUser = users.find(u => u.telegramId === userId);
    if (selfUser) {
      availableUsers = [selfUser];
    }
  }
  
  if (availableUsers.length === 0) {
    await bot.sendMessage(chatId, '❌ Нет доступных пользователей для назначения задач');
    return;
  }
  
  // Инициализируем состояние для создания задачи
  userStates[userId] = {
    state: 'creating_task',
    step: 'select_employee',
    taskData: {}
  };
  
  const message = isManager ? 
    '👤 Выберите сотрудника для назначения задачи:' :
    '📝 Создание задачи для себя:';
  
  await bot.editMessageText(
    message,
    {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
      reply_markup: taskKeyboards.selectEmployee(availableUsers)
    }
  );
}

async function getAllUsers() {
  const { getUsers } = require('../../services/railwayOptimizedService');
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