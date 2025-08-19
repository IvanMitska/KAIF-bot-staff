const { getUser, createTask } = require('../../services/optimizedNotionService');
const { taskKeyboards } = require('../keyboards/taskKeyboards');
const { userStates } = require('../state');
const moment = require('moment-timezone');

async function handleTaskCreationFlow(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  
  const state = userStates[userId];
  if (!state || state.state !== 'creating_task') return false;
  
  try {
    switch (state.step) {
      case 'input_task':
        // Парсим всю информацию из одного сообщения
        const parsedData = parseTaskMessage(text);
        
        // Автоматически создаем название из первых слов
        state.taskData.title = text.slice(0, 50) + (text.length > 50 ? '...' : '');
        state.taskData.description = text;
        state.taskData.priority = parsedData.priority;
        state.taskData.deadline = parsedData.deadline;
        
        // Сразу создаем задачу
        const creator = await getUser(userId);
        state.taskData.creatorId = userId;
        state.taskData.creatorName = creator.name;
        
        await createTask(state.taskData);
        
        const deadlineText = moment(state.taskData.deadline).tz('Asia/Bangkok').format('DD.MM.YYYY');
        await bot.sendMessage(
          chatId,
          `✅ Задача создана!\n\n` +
          `👤 *Исполнитель:* ${state.taskData.assigneeName}\n` +
          `📝 *Задача:* ${state.taskData.title}\n` +
          `⚡ *Приоритет:* ${getPriorityEmoji(state.taskData.priority)} ${state.taskData.priority}\n` +
          `📅 *Срок:* ${deadlineText}`,
          { parse_mode: 'Markdown' }
        );
        
        // Уведомляем исполнителя
        await bot.sendMessage(
          state.taskData.assigneeId,
          `🔔 *Новая задача от ${creator.name}!*\n\n` +
          `📝 ${state.taskData.description}\n` +
          `⚡ *Приоритет:* ${state.taskData.priority}\n` +
          `📅 *Срок:* ${deadlineText}\n\n` +
          `Используйте /tasks для управления`,
          { parse_mode: 'Markdown' }
        );
        
        delete userStates[userId];
        return true;
    }
  } catch (error) {
    console.error('Error in task creation flow:', error);
    await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте еще раз.');
    delete userStates[userId];
  }
  
  return false;
}

async function handleEmployeeSelection(bot, callbackQuery, employeeId) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const state = userStates[userId];
  
  if (!state || state.state !== 'creating_task') return;
  
  try {
    const employee = await getUser(employeeId);
    if (!employee) {
      await bot.sendMessage(chatId, '❌ Сотрудник не найден');
      return;
    }
    
    // Сохраняем данные сотрудника
    state.taskData.assigneeId = employeeId;
    state.taskData.assigneeName = employee.name;
    state.step = 'input_task';
    
    await bot.editMessageText(
      `👤 *Сотрудник:* ${employee.name}\n\n` +
      `📝 *Напишите задачу в одном сообщении*\n\n` +
      `Можете указать срок словами:\n` +
      `• "сделать отчет завтра"\n` +
      `• "подготовить презентацию через 3 дня"\n` +
      `• "провести встречу в пятницу"\n\n` +
      `Для важных задач добавьте: срочно, важно`,
      {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'Markdown'
      }
    );
  } catch (error) {
    console.error('Error selecting employee:', error);
    await bot.sendMessage(chatId, '❌ Произошла ошибка при выборе сотрудника');
  }
}

// Функция больше не нужна, так как приоритет определяется автоматически
async function handlePrioritySelection(bot, callbackQuery, priority) {
  // Deprecated - priority is now parsed automatically
  return;
}

// Функция больше не нужна, так как задача создается сразу после ввода текста
async function confirmTaskCreation(bot, callbackQuery) {
  // Deprecated - task is created immediately after input
  return;
}

function parseTaskMessage(text) {
  const bangkokTz = 'Asia/Bangkok';
  const now = moment.tz(bangkokTz);
  const lowerText = text.toLowerCase();
  
  // Определяем приоритет
  let priority = 'Средний';
  if (lowerText.includes('срочно') || lowerText.includes('важно') || lowerText.includes('urgent')) {
    priority = 'Высокий';
  } else if (lowerText.includes('не срочно') || lowerText.includes('потом')) {
    priority = 'Низкий';
  }
  
  // Определяем дату
  let deadline = now.clone().add(1, 'day').endOf('day').toISOString(); // По умолчанию - завтра
  
  if (lowerText.includes('сегодня') || lowerText.includes('today')) {
    deadline = now.clone().endOf('day').toISOString();
  } else if (lowerText.includes('завтра') || lowerText.includes('tomorrow')) {
    deadline = now.clone().add(1, 'day').endOf('day').toISOString();
  } else if (lowerText.includes('послезавтра')) {
    deadline = now.clone().add(2, 'days').endOf('day').toISOString();
  } else if (lowerText.includes('через неделю') || lowerText.includes('next week')) {
    deadline = now.clone().add(7, 'days').endOf('day').toISOString();
  } else if (lowerText.includes('на этой неделе') || lowerText.includes('this week')) {
    deadline = now.clone().endOf('week').toISOString();
  } else {
    // Проверяем "через X дней"
    const daysMatch = lowerText.match(/через\s+(\d+)\s+д[ен][нье]/);
    if (daysMatch) {
      deadline = now.clone().add(parseInt(daysMatch[1]), 'days').endOf('day').toISOString();
    } else {
      // Проверяем дни недели
      const weekdays = {
        'понедельник': 1, 'вторник': 2, 'среда': 3, 'четверг': 4, 
        'пятницу': 5, 'пятница': 5, 'субботу': 6, 'суббота': 6, 'воскресенье': 0
      };
      for (const [day, num] of Object.entries(weekdays)) {
        if (lowerText.includes(day)) {
          const targetDay = now.clone().day(num);
          if (targetDay.isBefore(now)) {
            targetDay.add(1, 'week');
          }
          deadline = targetDay.endOf('day').toISOString();
          break;
        }
      }
    }
  }
  
  return { priority, deadline };
}

function parseDeadline(text) {
  // Deprecated - use parseTaskMessage instead
  const parsed = parseTaskMessage(text);
  return parsed.deadline;
}

function formatTaskSummary(taskData) {
  return `<b>📋 Подтверждение создания задачи</b>

<b>Исполнитель:</b> ${taskData.assigneeName}
<b>Название:</b> ${taskData.title}
<b>Описание:</b> ${taskData.description}
<b>Приоритет:</b> ${getPriorityEmoji(taskData.priority)} ${taskData.priority}
<b>Срок:</b> ${formatDate(taskData.deadline)}

Создать задачу?`;
}

function getPriorityEmoji(priority) {
  const emojis = {
    'Высокий': '🔴',
    'Средний': '🟡',
    'Низкий': '🟢'
  };
  return emojis[priority] || '⚪';
}

function formatDate(isoDate) {
  return moment(isoDate).tz('Asia/Bangkok').format('DD.MM.YYYY');
}

module.exports = {
  handleTaskCreationFlow,
  handleEmployeeSelection,
  handlePrioritySelection,
  confirmTaskCreation
};