const cron = require('node-cron');
const moment = require('moment-timezone');
const notionService = require('./notionService');
const userService = require('./userService');
const keyboards = require('../bot/keyboards/inline');

const scheduledReminders = new Map();

const schedulerService = {
  initScheduler(bot) {
    console.log('Initializing scheduler...');
    
    // Ежедневное напоминание в 20:00 по времени Таиланда
    cron.schedule('0 20 * * *', async () => {
      console.log('Running daily reminder at 20:00 Bangkok time');
      await sendDailyReminders(bot);
    }, {
      timezone: 'Asia/Bangkok'
    });

    // Повторное напоминание в 21:00 для тех, кто не отправил отчет
    cron.schedule('0 21 * * *', async () => {
      console.log('Running second reminder at 21:00 Bangkok time');
      await sendSecondReminders(bot);
    }, {
      timezone: 'Asia/Bangkok'
    });

    // Отметка пропущенных отчетов в полночь
    cron.schedule('0 0 * * *', async () => {
      console.log('Marking missed reports at midnight Bangkok time');
      await markMissedReports();
    }, {
      timezone: 'Asia/Bangkok'
    });

    console.log('Scheduler initialized successfully');
  }
};

async function sendDailyReminders(bot) {
  try {
    const activeUsers = await userService.getAllActiveUsers();
    const today = moment().tz('Asia/Bangkok').format('YYYY-MM-DD');
    
    for (const user of activeUsers) {
      try {
        const todayReport = await notionService.getTodayReport(user.telegramId);
        
        if (!todayReport) {
          await bot.sendMessage(user.telegramId,
            '🕐 *Время отчета!*\n\n' +
            `Привет, ${user.name}! Не забудьте отправить ежедневный отчет о проделанной работе.\n\n` +
            '_Это займет всего пару минут_',
            {
              parse_mode: 'Markdown',
              reply_markup: keyboards.reminderOptions()
            }
          );
          
          // Сохраняем информацию для повторного напоминания
          scheduledReminders.set(user.telegramId, {
            name: user.name,
            firstReminderSent: true
          });
        }
      } catch (error) {
        console.error(`Error sending reminder to user ${user.telegramId}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in sendDailyReminders:', error);
  }
}

async function sendSecondReminders(bot) {
  try {
    for (const [telegramId, reminderData] of scheduledReminders) {
      try {
        const todayReport = await notionService.getTodayReport(telegramId);
        
        if (!todayReport && reminderData.firstReminderSent) {
          await bot.sendMessage(telegramId,
            '⏰ *Повторное напоминание*\n\n' +
            `${reminderData.name}, вы еще не отправили отчет за сегодня.\n\n` +
            'Пожалуйста, уделите этому несколько минут.',
            {
              parse_mode: 'Markdown',
              reply_markup: keyboards.reminderOptions()
            }
          );
        }
      } catch (error) {
        console.error(`Error sending second reminder to user ${telegramId}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in sendSecondReminders:', error);
  }
}

async function markMissedReports() {
  try {
    const activeUsers = await userService.getAllActiveUsers();
    const yesterday = moment().tz('Asia/Bangkok').subtract(1, 'days').format('YYYY-MM-DD');
    
    for (const user of activeUsers) {
      try {
        const yesterdayReport = await notionService.getTodayReport(user.telegramId);
        
        if (!yesterdayReport) {
          // Создаем запись о пропущенном отчете
          await notionService.createReport({
            date: yesterday,
            employeeName: user.name,
            telegramId: user.telegramId,
            whatDone: 'Отчет не предоставлен',
            problems: 'Отчет не предоставлен',
            goals: 'Отчет не предоставлен',
            timestamp: moment().tz('Asia/Bangkok').toISOString(),
            status: 'Просрочен'
          });
        }
      } catch (error) {
        console.error(`Error marking missed report for user ${user.telegramId}:`, error);
      }
    }
    
    // Очищаем карту напоминаний
    scheduledReminders.clear();
  } catch (error) {
    console.error('Error in markMissedReports:', error);
  }
}

// Обработчик для кнопки "Напомнить через час"
schedulerService.handleRemindLater = async (bot, chatId, userId) => {
  const reminderTime = moment().tz('Asia/Bangkok').add(1, 'hour');
  
  await bot.sendMessage(chatId,
    `⏰ Хорошо, я напомню вам через час (около ${reminderTime.format('HH:mm')}).`
  );
  
  // Устанавливаем таймер на час
  setTimeout(async () => {
    try {
      const todayReport = await notionService.getTodayReport(userId);
      
      if (!todayReport) {
        await bot.sendMessage(chatId,
          '⏰ *Напоминание*\n\n' +
          'Прошел час. Пора отправить отчет!',
          {
            parse_mode: 'Markdown',
            reply_markup: keyboards.reminderOptions()
          }
        );
      }
    } catch (error) {
      console.error('Error in delayed reminder:', error);
    }
  }, 60 * 60 * 1000); // 1 час в миллисекундах
};

module.exports = schedulerService;