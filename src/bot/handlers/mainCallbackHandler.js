// Централизованный обработчик всех callback_query
const { handleCallbackQuery: handleTasksCallback } = require('./callbackHandler');

async function mainCallbackHandler(bot, callbackQuery) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  
  console.log('Main callback handler - data:', data, 'userId:', userId);
  
  try {
    // Сначала обрабатываем основные команды
    switch (data) {
      case 'help':
        await bot.answerCallbackQuery(callbackQuery.id);
        const helpText = 
          '📖 *Доступные команды:*\n\n' +
          '/start - Начать работу с ботом\n' +
          '/help - Показать это сообщение\n' +
          '/status - Проверить статус отчета за сегодня\n' +
          '/history - Показать последние 5 отчетов\n' +
          '/profile - Информация о вашем профиле\n\n' +
          '*Как работает бот:*\n' +
          '1. Каждый день в 20:00 вы получите напоминание\n' +
          '2. Нажмите "Отправить отчет" и заполните форму\n' +
          '3. Отчет автоматически сохранится в Notion\n\n' +
          '_Если у вас есть вопросы, обратитесь к администратору_';
        
        const keyboards = require('../keyboards/inline');
        await bot.sendMessage(chatId, helpText, {
          parse_mode: 'Markdown',
          reply_markup: keyboards.mainMenu()
        });
        return;
        
      case 'my_stats':
        await bot.answerCallbackQuery(callbackQuery.id);
        try {
          const notionService = require('../../services/notionService');
          const userService = require('../../services/userService');
          
          const user = await userService.getUserByTelegramId(userId);
          if (!user) {
            await bot.sendMessage(chatId, 'Пожалуйста, сначала зарегистрируйтесь с помощью /start');
            return;
          }
          
          // Получаем отчеты за последние 30 дней
          const reports = await notionService.getUserReports(userId, 30);
          const totalReports = reports.length;
          const completedReports = reports.filter(r => r.status === 'Отправлен').length;
          
          // Получаем отчеты за текущую неделю
          const weekReports = await notionService.getUserReports(userId, 7);
          const completedThisWeek = weekReports.filter(r => r.status === 'Отправлен').length;
          
          let statsText = '📊 *Ваша статистика:*\n\n';
          statsText += `📅 За последние 30 дней:\n`;
          statsText += `└ Отправлено отчетов: ${completedReports} из ${totalReports}\n\n`;
          statsText += `📅 За текущую неделю:\n`;
          statsText += `└ Отправлено отчетов: ${completedThisWeek} из 7\n`;
          statsText += `└ Процент выполнения: ${Math.round(completedThisWeek / 7 * 100)}%\n\n`;
          
          if (completedReports > 0) {
            // Проверяем серию дней подряд
            let currentStreak = 0;
            const moment = require('moment-timezone');
            const today = moment().tz('Asia/Bangkok');
            
            for (let i = 0; i < 30; i++) {
              const checkDate = today.clone().subtract(i, 'days').format('YYYY-MM-DD');
              const hasReport = reports.some(r => 
                moment(r.date).format('YYYY-MM-DD') === checkDate && 
                r.status === 'Отправлен'
              );
              
              if (hasReport) {
                currentStreak++;
              } else if (i > 0) {
                // Пропускаем сегодня, если еще нет отчета
                break;
              }
            }
            
            if (currentStreak > 1) {
              statsText += `🔥 Текущая серия: ${currentStreak} дней подряд!\n`;
            }
          }
          
          const keyboards = require('../keyboards/inline');
          await bot.sendMessage(chatId, statsText, {
            parse_mode: 'Markdown',
            reply_markup: keyboards.mainMenu()
          });
        } catch (error) {
          console.error('Error getting stats:', error);
          await bot.sendMessage(chatId, '❌ Ошибка при получении статистики');
        }
        return;
        
      case 'send_report':
        await bot.answerCallbackQuery(callbackQuery.id);
        const reportHandler = require('./report');
        if (reportHandler.startReportSession) {
          await reportHandler.startReportSession(bot, chatId, userId);
        }
        return;
        
      case 'tasks_menu':
        await bot.answerCallbackQuery(callbackQuery.id);
        const { handleTasksCommand } = require('./tasks');
        await handleTasksCommand(bot, callbackQuery);
        return;
        
      case 'remind_later':
        await bot.answerCallbackQuery(callbackQuery.id);
        const schedulerService = require('../../services/schedulerService');
        await schedulerService.handleRemindLater(bot, chatId, userId);
        return;
        
      case 'classic_mode':
        await bot.answerCallbackQuery(callbackQuery.id);
        const replyKeyboards = require('../keyboards/reply');
        const MANAGER_IDS = [385436658, 1734337242];
        const isManager = MANAGER_IDS.includes(userId);
        
        await bot.editMessageText(
          'Классический режим активирован ✅',
          {
            chat_id: chatId,
            message_id: callbackQuery.message.message_id,
            reply_markup: keyboards.mainMenu()
          }
        );
        
        // Устанавливаем reply клавиатуру
        await bot.sendMessage(chatId, 'Выберите действие:', {
          reply_markup: isManager ? replyKeyboards.managerMenuKeyboard() : replyKeyboards.mainMenuKeyboard()
        });
        return;
        
      case 'report_history':
        await bot.answerCallbackQuery(callbackQuery.id);
        try {
          const notionService = require('../../services/notionService');
          const userService = require('../../services/userService');
          const moment = require('moment-timezone');
          
          const user = await userService.getUserByTelegramId(userId);
          if (!user) {
            await bot.sendMessage(chatId, 'Пожалуйста, сначала зарегистрируйтесь с помощью команды /start');
            return;
          }

          const reports = await notionService.getUserReports(userId, 5);
          
          if (reports.length === 0) {
            const keyboards = require('../keyboards/inline');
            await bot.sendMessage(chatId, 
              '📋 У вас пока нет отчетов.',
              { reply_markup: keyboards.mainMenu() }
            );
          } else {
            let historyText = '📋 *Ваши последние отчеты:*\n\n';
            
            reports.forEach((report, index) => {
              const date = moment(report.date).format('DD.MM.YYYY');
              const statusEmoji = report.status === 'Отправлен' ? '✅' : '❌';
              
              historyText += `${statusEmoji} *${date}*\n`;
              historyText += `├ Что сделал: ${report.whatDone.substring(0, 50)}${report.whatDone.length > 50 ? '...' : ''}\n`;
              historyText += `├ Проблемы: ${report.problems.substring(0, 50)}${report.problems.length > 50 ? '...' : ''}\n`;
              historyText += `└ Цели: ${report.goals.substring(0, 50)}${report.goals.length > 50 ? '...' : ''}\n\n`;
            });

            const keyboards = require('../keyboards/inline');
            await bot.sendMessage(chatId, historyText, {
              parse_mode: 'Markdown',
              reply_markup: keyboards.mainMenu()
            });
          }
        } catch (error) {
          console.error('History error:', error);
          await bot.sendMessage(chatId, 'Произошла ошибка при получении истории.');
        }
        return;
    }
    
    // Обработка callback'ов отчетов
    if (data.startsWith('report_') || data.startsWith('edit_')) {
      await bot.answerCallbackQuery(callbackQuery.id);
      const reportHandler = require('./report');
      if (data.startsWith('report_')) {
        await reportHandler.handleReportFlow(bot, chatId, userId, data, callbackQuery.message.message_id);
      } else if (data.startsWith('edit_')) {
        await reportHandler.handleReportEdit(bot, chatId, userId, data, callbackQuery.message.message_id);
      }
      return;
    }
    
    // Все остальные callback'и передаем в обработчик задач
    await handleTasksCallback(bot, callbackQuery);
    
  } catch (error) {
    console.error('Error in main callback handler:', error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ Произошла ошибка',
      show_alert: true
    });
  }
}

module.exports = mainCallbackHandler;