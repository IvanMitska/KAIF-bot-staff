const { createTask, getUsers } = require('../../services/notionService');
const moment = require('moment-timezone');

// Маппинг имен на Telegram ID
const USER_MAPPING = {
  'иван': 1734337242,
  'ivan': 1734337242,
  'ivanmitska': 1734337242,
  'ваня': 1734337242,
  'борис': 385436658,
  'boris': 385436658,
  'боря': 385436658
};

// Дополнительные ID сотрудников
const EMPLOYEE_IDS = [1151085087, 726915228, 642664990, 5937587032];

// Парсинг даты из текста
function parseTaskDate(text) {
  const bangkokTz = 'Asia/Bangkok';
  const now = moment.tz(bangkokTz);
  const lowerText = text.toLowerCase();
  
  // Проверяем ключевые слова
  if (lowerText.includes('сегодня') || lowerText.includes('today')) {
    return now.clone().endOf('day').toISOString();
  }
  if (lowerText.includes('завтра') || lowerText.includes('tomorrow')) {
    return now.clone().add(1, 'day').endOf('day').toISOString();
  }
  if (lowerText.includes('послезавтра')) {
    return now.clone().add(2, 'days').endOf('day').toISOString();
  }
  if (lowerText.includes('через неделю') || lowerText.includes('next week')) {
    return now.clone().add(7, 'days').endOf('day').toISOString();
  }
  
  // Проверяем "через X дней"
  const daysMatch = lowerText.match(/через\s+(\d+)\s+д[ен][нье]/);
  if (daysMatch) {
    return now.clone().add(parseInt(daysMatch[1]), 'days').endOf('day').toISOString();
  }
  
  // Проверяем "на этой неделе"
  if (lowerText.includes('на этой неделе') || lowerText.includes('this week')) {
    return now.clone().endOf('week').toISOString();
  }
  
  // Проверяем "в понедельник", "во вторник" и т.д.
  const weekdays = {
    'понедельник': 1, 'вторник': 2, 'среда': 3, 'четверг': 4, 
    'пятница': 5, 'пятницу': 5, 'суббота': 6, 'воскресенье': 0
  };
  for (const [day, num] of Object.entries(weekdays)) {
    if (lowerText.includes(day)) {
      const targetDay = now.clone().day(num);
      if (targetDay.isBefore(now)) {
        targetDay.add(1, 'week');
      }
      return targetDay.endOf('day').toISOString();
    }
  }
  
  // По умолчанию - завтра
  return now.clone().add(1, 'day').endOf('day').toISOString();
}

// Определение приоритета по ключевым словам
function parsePriority(text) {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('срочно') || lowerText.includes('важно') || lowerText.includes('urgent')) {
    return 'Высокий';
  }
  if (lowerText.includes('не срочно') || lowerText.includes('потом')) {
    return 'Низкий';
  }
  return 'Средний';
}

// Проверка наличия имени пользователя в тексте
function hasNameInText(text) {
  const lowerText = text.toLowerCase();
  const names = ['иван', 'ivan', 'ваня', 'борис', 'boris', 'боря'];
  return names.some(name => lowerText.includes(name));
}

// Парсинг пользователя из текста
async function parseAssignee(text) {
  const users = await getUsers();
  const lowerText = text.toLowerCase();
  
  // Ищем упоминание через @
  const mentionMatch = text.match(/@(\w+)/);
  if (mentionMatch) {
    const username = mentionMatch[1].toLowerCase();
    const user = users.find(u => u.username && u.username.toLowerCase() === username);
    if (user) return user;
  }
  
  // Ищем по имени
  for (const user of users) {
    if (user.name && lowerText.includes(user.name.toLowerCase())) {
      return user;
    }
  }
  
  // Ищем по маппингу
  for (const [key, id] of Object.entries(USER_MAPPING)) {
    if (lowerText.includes(key)) {
      const user = users.find(u => u.telegramId === id);
      if (user) return user;
    }
  }
  
  return null;
}

async function handleQuickTask(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  
  const MANAGER_IDS = [385436658, 1734337242];
  
  // Убираем команду из текста
  const taskText = text.replace(/^\/task\s+/i, '').trim();
  
  if (!taskText) {
    const helpText = MANAGER_IDS.includes(userId) ? 
      '📝 *Как создать задачу:*\n\n' +
      '`/task @username Текст задачи до завтра`\n' +
      '`/task Иван сделать отчет срочно`\n' +
      '`/task @ivan подготовить презентацию через неделю`\n' +
      '`/task себе подготовить отчет`\n\n' +
      '🕐 *Понимаю даты:* сегодня, завтра, послезавтра, через X дней, через неделю, в понедельник\n' +
      '⚡ *Приоритет:* срочно, важно, не срочно\n\n' +
      '💡 *Примеры дат:*\n' +
      '• "до завтра" → завтрашний день\n' +
      '• "через 3 дня" → через 3 дня\n' +
      '• "в пятницу" → ближайшая пятница\n' +
      '• "на этой неделе" → конец недели' :
      '📝 *Как создать задачу себе:*\n\n' +
      '`/task себе текст задачи`\n' +
      '`/task подготовить отчет срочно`\n\n' +
      '🕐 *Понимаю даты:* сегодня, завтра, послезавтра, через X дней\n' +
      '⚡ *Приоритет:* срочно, важно, не срочно\n\n' +
      'ℹ️ Вы можете ставить задачи только себе';
    
    await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
    return;
  }
  
  try {
    // Проверяем, ставит ли задачу себе
    const selfTask = taskText.toLowerCase().includes('себе') || 
                     taskText.toLowerCase().includes('мне') ||
                     !taskText.match(/@\w+/) && !hasNameInText(taskText);
    
    let assignee;
    
    if (selfTask) {
      // Ставим задачу себе
      assignee = await require('../../services/notionService').getUser(userId);
      if (!assignee) {
        await bot.sendMessage(chatId, '❌ Вы не зарегистрированы в системе');
        return;
      }
    } else {
      // Проверяем права для постановки задач другим
      if (!MANAGER_IDS.includes(userId)) {
        await bot.sendMessage(chatId, 
          '❌ Вы можете ставить задачи только себе\n\n' +
          'Используйте: `/task себе текст задачи`',
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      // Парсим исполнителя для менеджеров
      assignee = await parseAssignee(taskText);
      if (!assignee) {
        await bot.sendMessage(chatId, 
          '❌ Не могу определить исполнителя\n\n' +
          'Укажите через @ или имя:\n' +
          '`/task @username задача`\n' +
          '`/task Иван задача`'
        , { parse_mode: 'Markdown' });
        return;
      }
    }
    
    // Убираем имя/username из текста задачи
    let taskDescription = taskText
      .replace(/@\w+/g, '')
      .replace(/\b(себе|мне)\b/gi, '')
      .replace(new RegExp(assignee.name || '', 'gi'), '');
    
    // Убираем временные фразы из описания
    const timePatterns = [
      /\b(сегодня|завтра|послезавтра|срочно|важно|не срочно)\b/gi,
      /\bчерез\s+\d+\s+д[ен][нье]/gi,
      /\b(через неделю|на этой неделе)\b/gi,
      /\b(в понедельник|во вторник|в среду|в четверг|в пятницу|в субботу|в воскресенье)\b/gi
    ];
    
    for (const pattern of timePatterns) {
      taskDescription = taskDescription.replace(pattern, '');
    }
    
    taskDescription = taskDescription.trim();
    
    // Получаем дату и приоритет
    const deadline = parseTaskDate(taskText);
    const priority = parsePriority(taskText);
    
    // Создаем задачу
    const creator = await require('../../services/notionService').getUser(userId);
    const taskData = {
      title: taskDescription.slice(0, 50) + (taskDescription.length > 50 ? '...' : ''),
      description: taskDescription,
      assigneeId: assignee.telegramId,
      assigneeName: assignee.name,
      creatorId: userId,
      creatorName: creator.name,
      priority: priority,
      deadline: deadline
    };
    
    await createTask(taskData);
    
    // Подтверждение
    const deadlineText = moment(deadline).tz('Asia/Bangkok').format('DD.MM.YYYY');
    await bot.sendMessage(chatId, 
      `✅ Задача создана!\n\n` +
      `👤 *Исполнитель:* ${assignee.name}\n` +
      `📝 *Задача:* ${taskDescription}\n` +
      `⚡ *Приоритет:* ${priority}\n` +
      `📅 *Срок:* ${deadlineText}`,
      { parse_mode: 'Markdown' }
    );
    
    // Уведомление исполнителю
    await bot.sendMessage(assignee.telegramId,
      `🔔 *Новая задача от ${creator.name}!*\n\n` +
      `📝 ${taskDescription}\n` +
      `⚡ *Приоритет:* ${priority}\n` +
      `📅 *Срок:* ${deadlineText}\n\n` +
      `Используйте /tasks для управления`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error('Error creating quick task:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при создании задачи');
  }
}

module.exports = { handleQuickTask };