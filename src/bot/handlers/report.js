const notionService = require('../../services/notionService');
const userService = require('../../services/userService');
const keyboards = require('../keyboards/inline');
const moment = require('moment-timezone');
const security = require('../../utils/security');

const reportSessions = new Map();

// Экспортируем функцию для обработки сообщений
async function handleMessageInput(bot, msg) {
  // Игнорируем команды
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }
  
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  if (reportSessions.has(userId)) {
    const session = reportSessions.get(userId);
    if (session.waitingForInput) {
      await handleReportInput(bot, chatId, userId, msg.text);
    }
  }
}

module.exports = (bot) => {
  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    if (data === 'send_report') {
      await startReportSession(bot, chatId, userId);
    } else if (data.startsWith('report_')) {
      await handleReportFlow(bot, chatId, userId, data, callbackQuery.message.message_id);
    } else if (data.startsWith('edit_')) {
      await handleReportEdit(bot, chatId, userId, data, callbackQuery.message.message_id);
    }

    bot.answerCallbackQuery(callbackQuery.id);
  });

  // НЕ регистрируем общий обработчик сообщений здесь
  // Вместо этого будем обрабатывать ввод только когда пользователь в процессе создания отчета
};

async function startReportSession(bot, chatId, userId) {
  try {
    // Проверка авторизации
    if (!security.isUserAuthorized(userId)) {
      bot.sendMessage(chatId, '🚫 У вас нет доступа к этой функции.');
      return;
    }
    
    // Проверка rate limit для отчетов
    const rateLimit = security.checkRateLimit(userId, 'report', 3, 3600000); // 3 отчета в час
    if (!rateLimit.allowed) {
      bot.sendMessage(chatId, 
        `⏳ Слишком много отчетов. Попробуйте через ${rateLimit.resetIn} секунд.`
      );
      return;
    }
    
    const user = await userService.getUserByTelegramId(userId);
    if (!user) {
      bot.sendMessage(chatId, 'Пожалуйста, сначала зарегистрируйтесь с помощью команды /start');
      return;
    }

    const todayReport = await notionService.getTodayReport(userId);
    if (todayReport) {
      bot.sendMessage(chatId, 
        '📋 Вы уже отправили отчет за сегодня.\n\n' +
        'Хотите посмотреть историю отчетов?',
        { reply_markup: keyboards.mainMenu() }
      );
      return;
    }

    reportSessions.set(userId, {
      step: 1,
      data: {
        whatDone: '',
        problems: '',
        goals: '',
        employeeName: user.name
      },
      waitingForInput: true,
      currentField: 'whatDone'
    });

    bot.sendMessage(chatId,
      '📝 *Ежедневный отчет*\n\n' +
      '*Шаг 1 из 3:* Что вы сделали сегодня?\n\n' +
      '_Опишите выполненную работу_',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboards.reportStepNavigation(1, false)
      }
    );
  } catch (error) {
    console.error('Start report session error:', error);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте еще раз.');
  }
}

async function handleReportInput(bot, chatId, userId, text) {
  const session = reportSessions.get(userId);
  if (!session) return;

  session.data[session.currentField] = text;
  session.waitingForInput = false;

  const messageId = await getLastBotMessageId(bot, chatId);
  if (messageId) {
    await handleReportFlow(bot, chatId, userId, 'report_next', messageId);
  }
}

async function handleReportFlow(bot, chatId, userId, action, messageId) {
  const session = reportSessions.get(userId);
  if (!session) return;

  switch (action) {
    case 'report_next':
      if (session.step === 1) {
        if (!session.data.whatDone) {
          bot.sendMessage(chatId, '⚠️ Пожалуйста, опишите, что вы сделали сегодня.');
          return;
        }
        session.step = 2;
        session.currentField = 'problems';
        session.waitingForInput = true;
        
        bot.editMessageText(
          '📝 *Ежедневный отчет*\n\n' +
          '*Шаг 2 из 3:* Какие проблемы возникли?\n\n' +
          '_Опишите трудности, с которыми столкнулись (или напишите "нет", если проблем не было)_',
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboards.reportStepNavigation(2)
          }
        );
      } else if (session.step === 2) {
        if (!session.data.problems) {
          bot.sendMessage(chatId, '⚠️ Пожалуйста, опишите проблемы или напишите "нет".');
          return;
        }
        session.step = 3;
        session.currentField = 'goals';
        session.waitingForInput = true;
        
        bot.editMessageText(
          '📝 *Ежедневный отчет*\n\n' +
          '*Шаг 3 из 3:* Какие цели на завтра?\n\n' +
          '_Опишите, что планируете сделать завтра_',
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboards.reportStepNavigation(3)
          }
        );
      } else if (session.step === 3) {
        if (!session.data.goals) {
          bot.sendMessage(chatId, '⚠️ Пожалуйста, опишите цели на завтра.');
          return;
        }
        await showReportPreview(bot, chatId, userId, messageId);
      }
      break;

    case 'report_back':
      if (session.step === 2) {
        session.step = 1;
        session.currentField = 'whatDone';
        session.waitingForInput = true;
        
        bot.editMessageText(
          '📝 *Ежедневный отчет*\n\n' +
          '*Шаг 1 из 3:* Что вы сделали сегодня?\n\n' +
          `_Текущий ответ: ${session.data.whatDone}_`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboards.reportStepNavigation(1, false)
          }
        );
      } else if (session.step === 3) {
        session.step = 2;
        session.currentField = 'problems';
        session.waitingForInput = true;
        
        bot.editMessageText(
          '📝 *Ежедневный отчет*\n\n' +
          '*Шаг 2 из 3:* Какие проблемы возникли?\n\n' +
          `_Текущий ответ: ${session.data.problems}_`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboards.reportStepNavigation(2)
          }
        );
      }
      break;

    case 'report_cancel':
      reportSessions.delete(userId);
      bot.editMessageText(
        '❌ Отправка отчета отменена.',
        {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboards.mainMenu()
        }
      );
      break;

    case 'report_preview':
      await showReportPreview(bot, chatId, userId, messageId);
      break;

    case 'report_edit':
      bot.editMessageText(
        '✏️ *Выберите, что хотите изменить:*',
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: keyboards.reportEditMenu()
        }
      );
      break;

    case 'report_confirm':
      await submitReport(bot, chatId, userId, messageId);
      break;
  }
}

async function showReportPreview(bot, chatId, userId, messageId) {
  const session = reportSessions.get(userId);
  if (!session) return;

  const preview = 
    '📋 *Предварительный просмотр отчета*\n\n' +
    `*Дата:* ${moment().tz('Asia/Bangkok').format('DD.MM.YYYY')}\n\n` +
    `*Что сделал:*\n${session.data.whatDone}\n\n` +
    `*Проблемы:*\n${session.data.problems}\n\n` +
    `*Цели на завтра:*\n${session.data.goals}`;

  bot.editMessageText(preview, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: keyboards.reportConfirmation()
  });
}

async function handleReportEdit(bot, chatId, userId, action, messageId) {
  const session = reportSessions.get(userId);
  if (!session) return;

  const fieldMap = {
    'edit_done': { field: 'whatDone', title: 'Что сделал', step: 1 },
    'edit_problems': { field: 'problems', title: 'Проблемы', step: 2 },
    'edit_goals': { field: 'goals', title: 'Цели на завтра', step: 3 }
  };

  const editInfo = fieldMap[action];
  if (editInfo) {
    session.currentField = editInfo.field;
    session.waitingForInput = true;
    session.step = editInfo.step;

    bot.editMessageText(
      `✏️ *Редактирование: ${editInfo.title}*\n\n` +
      `Текущий текст:\n_${session.data[editInfo.field]}_\n\n` +
      'Отправьте новый текст:',
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
      }
    );
  }
}

async function submitReport(bot, chatId, userId, messageId) {
  const session = reportSessions.get(userId);
  if (!session) return;

  try {
    const bangkokTime = moment().tz('Asia/Bangkok');
    
    const reportData = {
      date: bangkokTime.format('YYYY-MM-DD'),
      employeeName: session.data.employeeName,
      telegramId: userId,
      whatDone: session.data.whatDone,
      problems: session.data.problems,
      goals: session.data.goals,
      timestamp: bangkokTime.toISOString(),
      status: 'Отправлен'
    };

    await notionService.createReport(reportData);
    
    reportSessions.delete(userId);

    bot.editMessageText(
      '✅ *Отчет успешно отправлен!*\n\n' +
      'Спасибо за вашу работу сегодня! 👍',
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: keyboards.mainMenu()
      }
    );
  } catch (error) {
    console.error('Submit report error:', error);
    bot.sendMessage(chatId, '❌ Произошла ошибка при отправке отчета. Попробуйте еще раз.');
  }
}

async function getLastBotMessageId(bot, chatId) {
  return null;
}

// Экспортируем функцию handleMessageInput
module.exports.handleMessageInput = handleMessageInput;