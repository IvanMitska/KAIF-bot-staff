const { getUser, createTask } = require('../../services/notionService');
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
      case 'input_title':
        state.taskData.title = text;
        state.step = 'input_description';
        await bot.sendMessage(
          chatId,
          '📝 Введите описание задачи:\n\n(Опишите, что нужно сделать)'
        );
        return true;
        
      case 'input_description':
        state.taskData.description = text;
        state.step = 'select_priority';
        await bot.sendMessage(
          chatId,
          '⚡ Выберите приоритет задачи:',
          { reply_markup: taskKeyboards.taskPriority() }
        );
        return true;
        
      case 'input_deadline':
        // Парсим дату
        const deadline = parseDeadline(text);
        if (!deadline) {
          await bot.sendMessage(
            chatId,
            '❌ Неверный формат даты. Попробуйте еще раз.\n\nПримеры:\n- 25.12\n- 25.12.2024\n- завтра\n- через 3 дня'
          );
          return true;
        }
        
        state.taskData.deadline = deadline;
        
        // Показываем итоговую информацию
        const summary = formatTaskSummary(state.taskData);
        await bot.sendMessage(
          chatId,
          summary,
          { 
            reply_markup: taskKeyboards.confirmTaskCreation(),
            parse_mode: 'HTML'
          }
        );
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
    state.step = 'input_title';
    
    await bot.editMessageText(
      `👤 Сотрудник: ${employee.name}\n\n💼 Введите название задачи:`,
      {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id
      }
    );
  } catch (error) {
    console.error('Error selecting employee:', error);
    await bot.sendMessage(chatId, '❌ Произошла ошибка при выборе сотрудника');
  }
}

async function handlePrioritySelection(bot, callbackQuery, priority) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const state = userStates[userId];
  
  if (!state || state.state !== 'creating_task') return;
  
  const priorityMap = {
    'high': 'Высокий',
    'medium': 'Средний', 
    'low': 'Низкий'
  };
  
  state.taskData.priority = priorityMap[priority];
  state.step = 'input_deadline';
  
  await bot.editMessageText(
    `📅 Укажите срок выполнения:\n\nФорматы:\n- ДД.ММ (например: 25.12)\n- ДД.ММ.ГГГГ (например: 25.12.2024)\n- "завтра"\n- "через N дней" (например: через 3 дня)`,
    {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id
    }
  );
}

async function confirmTaskCreation(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const state = userStates[userId];
  
  if (!state || state.state !== 'creating_task') return;
  
  try {
    // Получаем данные создателя
    const creator = await getUser(userId);
    state.taskData.creatorId = userId;
    state.taskData.creatorName = creator.name;
    
    // Создаем задачу в Notion
    await createTask(state.taskData);
    
    await bot.editMessageText(
      '✅ Задача успешно создана и отправлена сотруднику!',
      {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id
      }
    );
    
    // Отправляем уведомление исполнителю
    const assigneeId = state.taskData.assigneeId;
    const notificationText = `🔔 <b>Новая задача!</b>

<b>От:</b> ${state.taskData.creatorName}
<b>Задача:</b> ${state.taskData.title}
<b>Описание:</b> ${state.taskData.description}
<b>Приоритет:</b> ${getPriorityEmoji(state.taskData.priority)} ${state.taskData.priority}
<b>Срок:</b> ${formatDate(state.taskData.deadline)}

Используйте /tasks для просмотра всех задач`;
    
    await bot.sendMessage(assigneeId, notificationText, { parse_mode: 'HTML' });
    
    // Очищаем состояние
    delete userStates[userId];
  } catch (error) {
    console.error('Error creating task:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при создании задачи. Попробуйте еще раз.');
  }
}

function parseDeadline(text) {
  const bangkokTz = 'Asia/Bangkok';
  const now = moment.tz(bangkokTz);
  
  // Обрабатываем относительные даты
  if (text.toLowerCase() === 'завтра') {
    return now.add(1, 'day').startOf('day').toISOString();
  }
  
  const daysMatch = text.match(/через\s+(\d+)\s+д/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1]);
    return now.add(days, 'days').startOf('day').toISOString();
  }
  
  // Пробуем разобрать дату в формате ДД.ММ или ДД.ММ.ГГГГ
  const parts = text.split('.');
  if (parts.length === 2 || parts.length === 3) {
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // Месяцы в JS начинаются с 0
    const year = parts.length === 3 ? parseInt(parts[2]) : now.year();
    
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const date = moment.tz({ year, month, day }, bangkokTz);
      if (date.isValid()) {
        return date.startOf('day').toISOString();
      }
    }
  }
  
  return null;
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