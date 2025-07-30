require('dotenv').config();
const express = require('express');
const https = require('https');
const notionService = require('./services/notionService');
const userService = require('./services/userService');
const keyboards = require('./bot/keyboards/inline');
const moment = require('moment-timezone');

const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

console.log('Starting bot with token:', TOKEN ? TOKEN.substring(0, 20) + '...' : 'NOT SET');

if (!TOKEN) {
  console.error('ERROR: TELEGRAM_BOT_TOKEN not set!');
  process.exit(1);
}

app.use(express.json());

// Состояния регистрации и отчетов
const registrationStates = new Map();
const reportSessions = new Map();

// API endpoints
app.get('/', (req, res) => {
  res.json({ status: 'Bot is running', timestamp: new Date() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Telegram Bot Functions
let offset = 0;

function sendMessage(chatId, text, options = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      ...options
    });
    
    const opts = {
      hostname: 'api.telegram.org',
      path: `/bot${TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const req = https.request(opts, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (result.ok) {
            console.log('✅ Message sent');
            resolve(result);
          } else {
            console.error('❌ Failed to send:', result);
            reject(new Error(result.description));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function editMessage(chatId, messageId, text, options = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML',
      ...options
    });
    
    const opts = {
      hostname: 'api.telegram.org',
      path: `/bot${TOKEN}/editMessageText`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const req = https.request(opts, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (result.ok) {
            resolve(result);
          } else {
            reject(new Error(result.description));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function handleStart(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || '';
  
  try {
    const existingUser = await userService.getUserByTelegramId(userId);
    
    if (existingUser) {
      await sendMessage(chatId, `С возвращением, ${existingUser.name}! 👋`, {
        reply_markup: keyboards.mainMenu()
      });
      registrationStates.delete(userId);
    } else {
      await sendMessage(chatId, 
        'Добро пожаловать! 👋\n\n' +
        'Я бот для сбора ежедневных отчетов.\n' +
        'Давайте начнем с регистрации.\n\n' +
        'Как вас зовут?'
      );
      
      registrationStates.set(userId, {
        step: 'name',
        chatId: chatId,
        username: username
      });
    }
  } catch (error) {
    console.error('Start command error:', error);
    sendMessage(chatId, 'Произошла ошибка. Попробуйте еще раз.');
  }
}

async function handleHelp(chatId) {
  await sendMessage(chatId,
    '<b>📖 Доступные команды:</b>\n\n' +
    '/start - Начать работу с ботом\n' +
    '/help - Показать это сообщение\n' +
    '/status - Проверить статус отчета за сегодня\n' +
    '/history - Показать последние 5 отчетов\n' +
    '/profile - Информация о вашем профиле\n\n' +
    '<b>Как работает бот:</b>\n' +
    '1. Каждый день в 20:00 вы получите напоминание\n' +
    '2. Нажмите "Отправить отчет" и заполните форму\n' +
    '3. Отчет автоматически сохранится в Notion',
    {
      reply_markup: keyboards.mainMenu()
    }
  );
}

async function handleMessage(msg) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Проверяем регистрацию
  if (registrationStates.has(userId)) {
    const state = registrationStates.get(userId);
    
    if (state.step === 'name') {
      await sendMessage(chatId, `Приятно познакомиться, ${text}!\n\nКакая у вас должность?`);
      registrationStates.set(userId, { ...state, step: 'position', name: text });
    }
    else if (state.step === 'position') {
      try {
        await userService.createUser({
          telegramId: userId,
          username: state.username,
          name: state.name,
          position: text
        });
        
        await sendMessage(chatId, 
          `<b>Отлично! Регистрация завершена.</b> ✅\n\n` +
          `<b>Имя:</b> ${state.name}\n` +
          `<b>Должность:</b> ${text}\n\n` +
          `Теперь вы можете отправлять ежедневные отчеты.\n` +
          `Каждый день в 20:00 я буду напоминать вам об этом.`,
          {
            reply_markup: keyboards.mainMenu()
          }
        );
        
        registrationStates.delete(userId);
      } catch (error) {
        console.error('Registration error:', error);
        sendMessage(chatId, 'Произошла ошибка при регистрации. Попробуйте еще раз /start');
        registrationStates.delete(userId);
      }
    }
  }
  // Проверяем сессию отчета
  else if (reportSessions.has(userId)) {
    const session = reportSessions.get(userId);
    if (session.waitingForInput) {
      await handleReportInput(chatId, userId, text);
    }
  }
}

async function handleReportInput(chatId, userId, text) {
  const session = reportSessions.get(userId);
  if (!session) return;
  
  session.data[session.currentField] = text;
  session.waitingForInput = false;
  
  // Переходим к следующему шагу
  if (session.step === 1) {
    session.step = 2;
    session.currentField = 'problems';
    session.waitingForInput = true;
    
    await editMessage(chatId, session.messageId,
      '<b>📝 Ежедневный отчет</b>\n\n' +
      '<b>Шаг 2 из 3:</b> Какие проблемы возникли?\n\n' +
      '<i>Опишите трудности или напишите "нет"</i>',
      {
        reply_markup: keyboards.reportStepNavigation(2)
      }
    );
  } else if (session.step === 2) {
    session.step = 3;
    session.currentField = 'goals';
    session.waitingForInput = true;
    
    await editMessage(chatId, session.messageId,
      '<b>📝 Ежедневный отчет</b>\n\n' +
      '<b>Шаг 3 из 3:</b> Какие цели на завтра?\n\n' +
      '<i>Опишите, что планируете сделать</i>',
      {
        reply_markup: keyboards.reportStepNavigation(3)
      }
    );
  } else if (session.step === 3) {
    await showReportPreview(chatId, userId);
  }
}

async function showReportPreview(chatId, userId) {
  const session = reportSessions.get(userId);
  if (!session) return;
  
  const preview = 
    '<b>📋 Предварительный просмотр отчета</b>\n\n' +
    `<b>Дата:</b> ${moment().tz('Asia/Bangkok').format('DD.MM.YYYY')}\n\n` +
    `<b>Что сделал:</b>\n${session.data.whatDone}\n\n` +
    `<b>Проблемы:</b>\n${session.data.problems}\n\n` +
    `<b>Цели на завтра:</b>\n${session.data.goals}`;
  
  await editMessage(chatId, session.messageId, preview, {
    reply_markup: keyboards.reportConfirmation()
  });
}

async function submitReport(chatId, userId) {
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
    
    await editMessage(chatId, session.messageId,
      '<b>✅ Отчет успешно отправлен!</b>\n\n' +
      'Спасибо за вашу работу сегодня! 👍',
      {
        reply_markup: keyboards.mainMenu()
      }
    );
  } catch (error) {
    console.error('Submit report error:', error);
    sendMessage(chatId, '❌ Произошла ошибка при отправке отчета. Попробуйте еще раз.');
  }
}

async function handleCallback(query) {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;
  
  // Отвечаем на callback query
  https.get(`https://api.telegram.org/bot${TOKEN}/answerCallbackQuery?callback_query_id=${query.id}`, () => {});
  
  switch(data) {
    case 'send_report':
      await startReportSession(chatId, userId);
      break;
      
    case 'help':
      await handleHelp(chatId);
      break;
      
    case 'my_stats':
      const reports = await notionService.getUserReports(userId, 7);
      const completedThisWeek = reports.filter(r => r.status === 'Отправлен').length;
      
      await sendMessage(chatId,
        '<b>📊 Ваша статистика за неделю:</b>\n\n' +
        `Отправлено отчетов: ${completedThisWeek} из 7\n` +
        `Процент выполнения: ${Math.round(completedThisWeek / 7 * 100)}%`,
        {
          reply_markup: keyboards.mainMenu()
        }
      );
      break;
      
    case 'report_history':
      const history = await notionService.getUserReports(userId, 5);
      
      if (history.length === 0) {
        await sendMessage(chatId, '📋 У вас пока нет отчетов.', {
          reply_markup: keyboards.mainMenu()
        });
      } else {
        let historyText = '<b>📋 Ваши последние отчеты:</b>\n\n';
        
        history.forEach((report) => {
          const date = moment(report.date).format('DD.MM.YYYY');
          const statusEmoji = report.status === 'Отправлен' ? '✅' : '❌';
          
          historyText += `${statusEmoji} <b>${date}</b>\n`;
          historyText += `├ Что сделал: ${report.whatDone.substring(0, 50)}${report.whatDone.length > 50 ? '...' : ''}\n`;
          historyText += `├ Проблемы: ${report.problems.substring(0, 50)}${report.problems.length > 50 ? '...' : ''}\n`;
          historyText += `└ Цели: ${report.goals.substring(0, 50)}${report.goals.length > 50 ? '...' : ''}\n\n`;
        });
        
        await sendMessage(chatId, historyText, {
          reply_markup: keyboards.mainMenu()
        });
      }
      break;
      
    case 'report_next':
    case 'report_back':
    case 'report_cancel':
    case 'report_confirm':
    case 'report_edit':
      await handleReportFlow(chatId, userId, data, query.message.message_id);
      break;
  }
}

async function startReportSession(chatId, userId) {
  try {
    const user = await userService.getUserByTelegramId(userId);
    if (!user) {
      sendMessage(chatId, 'Пожалуйста, сначала зарегистрируйтесь с помощью команды /start');
      return;
    }
    
    const todayReport = await notionService.getTodayReport(userId);
    if (todayReport) {
      sendMessage(chatId, 
        '📋 Вы уже отправили отчет за сегодня.\n\n' +
        'Хотите посмотреть историю отчетов?',
        { reply_markup: keyboards.mainMenu() }
      );
      return;
    }
    
    const message = await sendMessage(chatId,
      '<b>📝 Ежедневный отчет</b>\n\n' +
      '<b>Шаг 1 из 3:</b> Что вы сделали сегодня?\n\n' +
      '<i>Опишите выполненную работу</i>',
      {
        reply_markup: keyboards.reportStepNavigation(1, false)
      }
    );
    
    reportSessions.set(userId, {
      step: 1,
      messageId: message.result.message_id,
      data: {
        whatDone: '',
        problems: '',
        goals: '',
        employeeName: user.name
      },
      waitingForInput: true,
      currentField: 'whatDone'
    });
  } catch (error) {
    console.error('Start report session error:', error);
    sendMessage(chatId, 'Произошла ошибка. Попробуйте еще раз.');
  }
}

async function handleReportFlow(chatId, userId, action, messageId) {
  const session = reportSessions.get(userId);
  if (!session) return;
  
  session.messageId = messageId;
  
  switch (action) {
    case 'report_cancel':
      reportSessions.delete(userId);
      await editMessage(chatId, messageId,
        '❌ Отправка отчета отменена.',
        {
          reply_markup: keyboards.mainMenu()
        }
      );
      break;
      
    case 'report_confirm':
      await submitReport(chatId, userId);
      break;
  }
}

// Получение обновлений
function getUpdates() {
  const url = `https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${offset}&timeout=30`;
  console.log('Polling for updates...');
  
  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', async () => {
      try {
        const response = JSON.parse(data);
        
        if (!response.ok) {
          console.error('Telegram API error:', response);
          setTimeout(getUpdates, 5000);
          return;
        }
        
        if (response.result.length > 0) {
          console.log(`Received ${response.result.length} updates`);
          
          for (const update of response.result) {
            offset = update.update_id + 1;
            
            if (update.message) {
              const msg = update.message;
              console.log(`[${new Date().toISOString()}] ${msg.from.username}: ${msg.text}`);
              
              if (msg.text === '/start') {
                await handleStart(msg);
              } else if (msg.text === '/help') {
                await handleHelp(msg.chat.id);
              } else if (!msg.text || !msg.text.startsWith('/')) {
                await handleMessage(msg);
              }
            }
            
            if (update.callback_query) {
              await handleCallback(update.callback_query);
            }
          }
        }
        
        // Продолжаем polling
        setTimeout(getUpdates, 100);
      } catch (error) {
        console.error('Error:', error);
        setTimeout(getUpdates, 5000);
      }
    });
  }).on('error', (error) => {
    console.error('Request error:', error);
    setTimeout(getUpdates, 5000);
  });
}

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Очищаем старые обновления и запускаем бота
  https.get(`https://api.telegram.org/bot${TOKEN}/getUpdates`, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (response.ok && response.result.length > 0) {
          const lastUpdate = response.result[response.result.length - 1];
          offset = lastUpdate.update_id + 1;
        }
        console.log('Telegram bot is active');
        getUpdates();
      } catch (error) {
        console.error('Error clearing updates:', error);
        getUpdates();
      }
    });
  });
});