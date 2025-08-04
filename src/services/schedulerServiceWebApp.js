const cron = require('node-cron');
const userService = require('./userService');
const notionService = require('./notionService');
const moment = require('moment-timezone');

// Устанавливаем временную зону
moment.tz.setDefault('Asia/Bangkok');

async function sendDailyReminders(bot) {
  try {
    console.log('Sending daily reminders at 20:00...');
    const activeUsers = await userService.getAllActiveUsers();
    
    for (const user of activeUsers) {
      try {
        const todayReport = await notionService.getTodayReport(user.telegramId);
        
        if (!todayReport) {
          const webAppUrl = `https://${process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN}/webapp/public`;
          
          await bot.sendMessage(user.telegramId,
            '🕐 *Время отчета!*\n\n' +
            `Привет, ${user.name}! Не забудьте отправить ежедневный отчет о проделанной работе.\n\n` +
            '_Это займет всего пару минут_',
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [[
                  {
                    text: '📝 Отправить отчет',
                    web_app: { url: webAppUrl }
                  }
                ]]
              }
            }
          );
          
          console.log(`Reminder sent to ${user.name} (${user.telegramId})`);
        }
      } catch (error) {
        console.error(`Error sending reminder to user ${user.telegramId}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in sendDailyReminders:', error);
  }
}

const schedulerServiceWebApp = {
  initScheduler(bot) {
    console.log('Initializing Web App scheduler...');
    
    // Ежедневное напоминание в 20:00 по времени Таиланда
    cron.schedule('0 20 * * *', async () => {
      console.log('Running daily reminder at 20:00 Bangkok time');
      await sendDailyReminders(bot);
    }, {
      timezone: 'Asia/Bangkok'
    });
    
    console.log('Web App scheduler initialized successfully');
  }
};

module.exports = schedulerServiceWebApp;