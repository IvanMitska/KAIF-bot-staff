const { getTasksByAssignee, getAllTasks, updateTaskStatus, getUser } = require('../../services/notionService');
const { taskKeyboards } = require('../keyboards/taskKeyboards');
const { userStates } = require('../state');
const moment = require('moment-timezone');

const MANAGER_IDS = [385436658, 1734337242]; // Борис и Иван

async function handleMyTasks(bot, callbackQuery, statusFilter = null) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  
  try {
    console.log('Employee viewing tasks - userId:', userId, 'statusFilter:', statusFilter);
    const tasks = await getTasksByAssignee(userId, statusFilter);
    
    if (tasks.length === 0) {
      const statusText = statusFilter ? ` со статусом "${statusFilter}"` : '';
      await bot.editMessageText(
        `📋 У вас пока нет задач${statusText}`,
        {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          reply_markup: taskKeyboards.employeeMenu()
        }
      );
      return;
    }
    
    const tasksList = formatTasksList(tasks);
    await bot.editMessageText(
      `📋 <b>Ваши задачи (${tasks.length})</b>\n\n${tasksList}`,
      {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'HTML',
        reply_markup: createTasksListKeyboard(tasks)
      }
    );
  } catch (error) {
    console.error('Error getting tasks for employee:', error);
    console.error('User ID:', userId);
    console.error('Status filter:', statusFilter);
    await bot.sendMessage(chatId, '❌ Ошибка при загрузке задач. Пожалуйста, обратитесь к администратору.');
  }
}

async function handleAllTasks(bot, callbackQuery, statusFilter = null) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  
  console.log('handleAllTasks called with callback data:', callbackQuery.data);
  
  if (!MANAGER_IDS.includes(userId)) {
    await bot.sendMessage(chatId, '❌ Только менеджер может просматривать все задачи');
    return;
  }
  
  try {
    const statusMap = {
      'completed_tasks': 'Выполнена',
      'in_progress_tasks': 'В работе',
      'new_tasks': 'Новая'
    };
    
    const status = statusMap[callbackQuery.data] || null;
    console.log('Manager viewing tasks - callback data:', callbackQuery.data);
    console.log('Mapped status:', status);
    
    const tasks = await getAllTasks(status);
    
    if (tasks.length === 0) {
      const statusText = status ? ` со статусом "${status}"` : '';
      await bot.editMessageText(
        `📋 Нет задач${statusText}`,
        {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          reply_markup: taskKeyboards.managerMenu()
        }
      );
      return;
    }
    
    const title = status ? `Задачи: ${status}` : 'Все задачи';
    const tasksList = formatManagerTasksList(tasks);
    
    await bot.editMessageText(
      `📋 <b>${title} (${tasks.length})</b>\n\n${tasksList}`,
      {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'HTML',
        reply_markup: taskKeyboards.managerMenu()
      }
    );
  } catch (error) {
    console.error('Error getting all tasks for manager:', error);
    console.error('Manager ID:', userId);
    console.error('Status filter:', status);
    console.error('Callback data:', callbackQuery.data);
    await bot.sendMessage(chatId, '❌ Ошибка при загрузке задач. Пожалуйста, проверьте консоль для деталей.');
  }
}

async function handleTaskDetails(bot, callbackQuery, taskId) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  
  try {
    const isManager = MANAGER_IDS.includes(userId);
    const tasks = isManager ? await getAllTasks() : await getTasksByAssignee(userId);
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      await bot.sendMessage(chatId, '❌ Задача не найдена');
      return;
    }
    
    const details = formatTaskDetails(task);
    const canModify = !isManager && task.status !== 'Выполнена';
    
    await bot.editMessageText(
      details,
      {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'HTML',
        reply_markup: taskKeyboards.taskActions(taskId, canModify)
      }
    );
  } catch (error) {
    console.error('Error getting task details:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при загрузке деталей задачи');
  }
}

async function handleTaskStatusUpdate(bot, callbackQuery, action, taskId) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  
  try {
    const statusMap = {
      'start_task': 'В работе',
      'complete_task': 'Выполнена'
    };
    
    const newStatus = statusMap[action];
    if (!newStatus) return;
    
    // Проверяем, что это задача пользователя
    const tasks = await getTasksByAssignee(userId);
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      await bot.sendMessage(chatId, '❌ У вас нет доступа к этой задаче');
      return;
    }
    
    if (action === 'complete_task') {
      // Запрашиваем комментарий при завершении
      userStates[userId] = {
        state: 'completing_task',
        taskId: taskId,
        taskTitle: task.title
      };
      
      await bot.editMessageText(
        '💬 Введите комментарий о выполнении задачи (или отправьте "-" без комментария):',
        {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id
        }
      );
      return;
    }
    
    // Обновляем статус
    console.log(`Updating task status: ${taskId} -> ${newStatus}`);
    await updateTaskStatus(taskId, newStatus);
    
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: `✅ Статус изменен на "${newStatus}"`,
      show_alert: true
    });
    
    // Обновляем детали задачи
    await handleTaskDetails(bot, callbackQuery, taskId);
    
    // Уведомляем менеджера
    if (newStatus === 'В работе') {
      const user = await getUser(userId);
      console.log('Notifying managers about task start:', task.title);
      // Уведомляем всех менеджеров
      for (const managerId of MANAGER_IDS) {
        if (managerId !== userId) { // Не отправляем себе
          try {
            await bot.sendMessage(
              managerId,
              `🔔 ${user.name} взял в работу задачу "${task.title}"`
            );
            console.log(`Notified manager ${managerId} about task start`);
          } catch (notifyError) {
            console.error(`Failed to notify manager ${managerId}:`, notifyError);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error updating task status:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при обновлении статуса');
  }
}

async function handleTaskCompletion(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  
  const state = userStates[userId];
  if (!state || state.state !== 'completing_task') return false;
  
  try {
    const comment = text === '-' ? null : text;
    console.log('Completing task:', { taskId: state.taskId, status: 'Выполнена', comment });
    
    await updateTaskStatus(state.taskId, 'Выполнена', comment);
    
    console.log('Task completion successful, sending confirmation...');
    
    await bot.sendMessage(
      chatId,
      '✅ Задача отмечена как выполненная!',
      { reply_markup: taskKeyboards.employeeMenu() }
    );
    
    // Уведомляем менеджера
    const user = await getUser(userId);
    const notificationText = `🎉 ${user.name} выполнил задачу "${state.taskTitle}"${comment ? `\n\n💬 Комментарий: ${comment}` : ''}`;
    
    console.log('Sending notifications to managers:', MANAGER_IDS);
    
    // Уведомляем всех менеджеров о выполнении
    for (const managerId of MANAGER_IDS) {
      try {
        await bot.sendMessage(managerId, notificationText);
        console.log(`Notification sent to manager ${managerId}`);
      } catch (notifyError) {
        console.error(`Failed to notify manager ${managerId}:`, notifyError);
      }
    }
    
    delete userStates[userId];
    return true;
  } catch (error) {
    console.error('Error completing task:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при завершении задачи');
    delete userStates[userId];
    return true;
  }
}

function formatTasksList(tasks) {
  return tasks.map(task => {
    const emoji = getStatusEmoji(task.status);
    const priority = getPriorityEmoji(task.priority);
    const deadline = task.deadline ? ` (до ${formatDate(task.deadline)})` : '';
    return `${emoji} ${priority} <b>${task.title}</b>${deadline}`;
  }).join('\n');
}

function formatManagerTasksList(tasks) {
  return tasks.map(task => {
    const emoji = getStatusEmoji(task.status);
    const priority = getPriorityEmoji(task.priority);
    const deadline = task.deadline ? ` (до ${formatDate(task.deadline)})` : '';
    return `${emoji} ${priority} <b>${task.title}</b>\n   👤 ${task.assigneeName}${deadline}`;
  }).join('\n\n');
}

function formatTaskDetails(task) {
  const emoji = getStatusEmoji(task.status);
  const priority = getPriorityEmoji(task.priority);
  
  return `${emoji} <b>Задача: ${task.title}</b>

<b>Описание:</b> ${task.description}
<b>Статус:</b> ${task.status}
<b>Приоритет:</b> ${priority} ${task.priority}
<b>Постановщик:</b> ${task.creatorName}
<b>Создана:</b> ${formatDate(task.createdDate)}
${task.deadline ? `<b>Срок:</b> ${formatDate(task.deadline)}` : ''}`;
}

function createTasksListKeyboard(tasks) {
  const buttons = tasks.map(task => [{
    text: `${getStatusEmoji(task.status)} ${task.title}`,
    callback_data: `task_${task.id}`
  }]);
  
  buttons.push([{ text: '⬅️ Назад', callback_data: 'back_to_tasks' }]);
  
  return { inline_keyboard: buttons };
}

function getStatusEmoji(status) {
  const emojis = {
    'Новая': '🔵',
    'В работе': '🟡',
    'Выполнена': '✅',
    'Отменена': '❌'
  };
  return emojis[status] || '⚪';
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
  handleMyTasks,
  handleAllTasks,
  handleTaskDetails,
  handleTaskStatusUpdate,
  handleTaskCompletion
};