const { getUser, getUsers, createTask } = require('../../services/notionService');
const moment = require('moment-timezone');

// Создание inline клавиатуры для быстрых задач
async function quickTaskKeyboard(userId) {
  const keyboard = {
    inline_keyboard: []
  };
  
  const MANAGER_IDS = [385436658, 1734337242];
  const isManager = MANAGER_IDS.includes(userId);
  
  try {
    // Кнопка для создания задачи себе
    keyboard.inline_keyboard.push([
      { text: '📝 Себе', callback_data: `quick_task_self` }
    ]);
    
    if (isManager) {
      // Получаем всех пользователей из базы
      const users = await getUsers();
      
      // Фильтруем пользователей - исключаем только самого себя
      const availableUsers = users.filter(u => u.telegramId !== userId);
      
      // Добавляем кнопки для первых 5 пользователей
      availableUsers.slice(0, 5).forEach(user => {
        keyboard.inline_keyboard.push([
          { text: `📝 ${user.name}`, callback_data: `quick_task_${user.telegramId}` }
        ]);
      });
      
      // Кнопка для обычного создания
      keyboard.inline_keyboard.push([
        { text: '➕ Другой пользователь', callback_data: 'new_task' }
      ]);
    }
    
    keyboard.inline_keyboard.push([
      { text: '◀️ Назад', callback_data: 'back_to_menu' }
    ]);
  } catch (error) {
    console.error('Error creating quick task keyboard:', error);
  }
  
  return keyboard;
}

// Обработчик быстрого создания задачи
async function handleQuickTaskMenu(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  
  const MANAGER_IDS = [385436658, 1734337242];
  const isManager = MANAGER_IDS.includes(userId);
  
  const keyboard = await quickTaskKeyboard(userId);
  
  const message = isManager ?
    '⚡ *Быстрое создание задачи*\n\n' +
    'Выберите пользователя для назначения задачи:' :
    '⚡ *Быстрое создание задачи*\n\n' +
    'Вы можете создать задачу себе:';
  
  await bot.editMessageText(
    message,
    {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    }
  );
}

// Обработчик выбора сотрудника для быстрой задачи
async function handleQuickTaskEmployee(bot, callbackQuery, employeeId) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  
  try {
    let employee;
    
    // Проверяем, задача для себя или для другого
    if (employeeId === 'self') {
      employee = await getUser(userId);
      if (!employee) {
        await bot.sendMessage(chatId, '❌ Вы не зарегистрированы в системе');
        return;
      }
    } else {
      // Проверяем права для постановки задач другим
      const MANAGER_IDS = [385436658, 1734337242];
      if (!MANAGER_IDS.includes(userId)) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Вы можете создавать задачи только себе',
          show_alert: true
        });
        return;
      }
      
      employee = await getUser(employeeId);
      if (!employee) {
        await bot.sendMessage(chatId, '❌ Сотрудник не найден');
        return;
      }
    }
    
    // Ждем ввода задачи в одном сообщении
    await bot.editMessageText(
      `👤 *${employee.name}*\n\n` +
      `✏️ Напишите задачу (например: "сделать отчет завтра"):\n\n` +
      `💡 Бот понимает:\n` +
      `• завтра, послезавтра, через 3 дня\n` +
      `• в понедельник, во вторник\n` +
      `• срочно = высокий приоритет`,
      {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'Markdown'
      }
    );
    
    // Сохраняем состояние для быстрой задачи
    const { userStates } = require('../state');
    userStates[userId] = {
      state: 'quick_task_input',
      employeeId: employeeId,
      employeeName: employee.name
    };
    
  } catch (error) {
    console.error('Error in quick task employee selection:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при выборе сотрудника');
  }
}

// Обработчик ввода текста быстрой задачи
async function handleQuickTaskInput(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  
  const { userStates } = require('../state');
  const state = userStates[userId];
  
  if (!state || state.state !== 'quick_task_input') return false;
  
  try {
    // Парсим задачу
    const parsedData = parseQuickTask(text);
    
    // Создаем задачу
    const creator = await getUser(userId);
    const taskData = {
      title: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
      description: text,
      assigneeId: state.employeeId,
      assigneeName: state.employeeName,
      creatorId: userId,
      creatorName: creator.name,
      priority: parsedData.priority,
      deadline: parsedData.deadline
    };
    
    await createTask(taskData);
    
    // Отправляем подтверждение
    const deadlineText = moment(taskData.deadline).tz('Asia/Bangkok').format('DD.MM.YYYY');
    await bot.sendMessage(
      chatId,
      `✅ Задача создана!\n\n` +
      `👤 ${state.employeeName}\n` +
      `📝 ${taskData.title}\n` +
      `⚡ ${taskData.priority}\n` +
      `📅 ${deadlineText}`,
      { parse_mode: 'Markdown' }
    );
    
    // Уведомляем исполнителя
    await bot.sendMessage(
      state.employeeId,
      `🔔 *Новая задача от ${creator.name}!*\n\n` +
      `${text}\n\n` +
      `/tasks - посмотреть все задачи`,
      { parse_mode: 'Markdown' }
    );
    
    delete userStates[userId];
    return true;
    
  } catch (error) {
    console.error('Error creating quick task:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при создании задачи');
    delete userStates[userId];
  }
  
  return false;
}

// Парсер для быстрых задач
function parseQuickTask(text) {
  const bangkokTz = 'Asia/Bangkok';
  const now = moment.tz(bangkokTz);
  const lowerText = text.toLowerCase();
  
  // Приоритет
  let priority = 'Средний';
  if (lowerText.includes('срочно') || lowerText.includes('важно')) {
    priority = 'Высокий';
  } else if (lowerText.includes('не срочно')) {
    priority = 'Низкий';
  }
  
  // Дата (по умолчанию - завтра)
  let deadline = now.clone().add(1, 'day').endOf('day').toISOString();
  
  if (lowerText.includes('сегодня')) {
    deadline = now.clone().endOf('day').toISOString();
  } else if (lowerText.includes('завтра')) {
    deadline = now.clone().add(1, 'day').endOf('day').toISOString();
  } else if (lowerText.includes('послезавтра')) {
    deadline = now.clone().add(2, 'days').endOf('day').toISOString();
  } else if (lowerText.includes('через неделю')) {
    deadline = now.clone().add(7, 'days').endOf('day').toISOString();
  } else {
    const daysMatch = lowerText.match(/через\s+(\d+)\s+д[ень|ня|ней]/);
    if (daysMatch) {
      deadline = now.clone().add(parseInt(daysMatch[1]), 'days').endOf('day').toISOString();
    }
  }
  
  return { priority, deadline };
}

module.exports = {
  handleQuickTaskMenu,
  handleQuickTaskEmployee,
  handleQuickTaskInput
};