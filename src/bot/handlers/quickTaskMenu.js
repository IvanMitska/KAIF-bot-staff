const { getUser, getUsers, createTask } = require('../../services/notionService');
const moment = require('moment-timezone');

// Быстрое создание задачи для часто используемых сотрудников
const QUICK_EMPLOYEES = [
  { id: 1734337242, name: 'Иван' },
  { id: 1151085087, name: 'Сотрудник 1' },
  { id: 726915228, name: 'Сотрудник 2' },
  { id: 642664990, name: 'Сотрудник 3' },
  { id: 5937587032, name: 'Сотрудник 4' }
];

// Создание inline клавиатуры для быстрых задач
function quickTaskKeyboard() {
  const keyboard = {
    inline_keyboard: []
  };
  
  // Добавляем кнопки для быстрого создания задач
  QUICK_EMPLOYEES.forEach(emp => {
    keyboard.inline_keyboard.push([
      { text: `📝 Задача для ${emp.name}`, callback_data: `quick_task_${emp.id}` }
    ]);
  });
  
  // Кнопка для обычного создания
  keyboard.inline_keyboard.push([
    { text: '➕ Другой сотрудник', callback_data: 'new_task' }
  ]);
  
  keyboard.inline_keyboard.push([
    { text: '◀️ Назад', callback_data: 'back_to_menu' }
  ]);
  
  return keyboard;
}

// Обработчик быстрого создания задачи
async function handleQuickTaskMenu(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  
  // Проверяем, что это менеджер
  const MANAGER_IDS = [385436658, 1734337242];
  if (!MANAGER_IDS.includes(userId)) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ Только менеджеры могут создавать задачи',
      show_alert: true
    });
    return;
  }
  
  await bot.editMessageText(
    '⚡ *Быстрое создание задачи*\n\n' +
    'Выберите сотрудника или используйте команду:\n' +
    '`/task @username текст задачи завтра`',
    {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
      reply_markup: quickTaskKeyboard(),
      parse_mode: 'Markdown'
    }
  );
}

// Обработчик выбора сотрудника для быстрой задачи
async function handleQuickTaskEmployee(bot, callbackQuery, employeeId) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  
  try {
    const employee = await getUser(employeeId);
    if (!employee) {
      await bot.sendMessage(chatId, '❌ Сотрудник не найден');
      return;
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
      `✅ Готово за 15 секунд!\n\n` +
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
  let deadline = now.add(1, 'day').endOf('day').toISOString();
  
  if (lowerText.includes('сегодня')) {
    deadline = now.endOf('day').toISOString();
  } else if (lowerText.includes('завтра')) {
    deadline = now.add(1, 'day').endOf('day').toISOString();
  } else if (lowerText.includes('послезавтра')) {
    deadline = now.add(2, 'days').endOf('day').toISOString();
  } else if (lowerText.includes('через неделю')) {
    deadline = now.add(7, 'days').endOf('day').toISOString();
  } else {
    const daysMatch = lowerText.match(/через\s+(\d+)\s+д[ень|ня|ней]/);
    if (daysMatch) {
      deadline = now.add(parseInt(daysMatch[1]), 'days').endOf('day').toISOString();
    }
  }
  
  return { priority, deadline };
}

module.exports = {
  handleQuickTaskMenu,
  handleQuickTaskEmployee,
  handleQuickTaskInput
};