const notionService = require('../../services/notionService');
const userService = require('../../services/userService');
const keyboards = require('../keyboards/inline');
const schedulerService = require('../../services/schedulerService');
const moment = require('moment-timezone');

module.exports = (bot) => {
  // Команда помощи
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    
    const helpText = 
      '📖 *Доступные команды:*\n\n' +
      '/start - Начать работу с ботом\n' +
      '/help - Показать это сообщение\n' +
      '/task - Быстрое создание задачи (для менеджеров)\n' +
      '/tasks - Меню задач\n' +
      '/status - Проверить статус отчета за сегодня\n' +
      '/history - Показать последние 5 отчетов\n' +
      '/profile - Информация о вашем профиле\n\n' +
      '*Как работает бот:*\n' +
      '1. Каждый день в 20:00 вы получите напоминание\n' +
      '2. Нажмите "Отправить отчет" и заполните форму\n' +
      '3. Отчет автоматически сохранится в Notion\n\n' +
      '_Если у вас есть вопросы, обратитесь к администратору_';
    
    bot.sendMessage(chatId, helpText, {
      parse_mode: 'Markdown',
      reply_markup: keyboards.mainMenu()
    });
  });

  // Команда статуса
  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
      const user = await userService.getUserByTelegramId(userId);
      if (!user) {
        bot.sendMessage(chatId, 'Пожалуйста, сначала зарегистрируйтесь с помощью команды /start');
        return;
      }

      const todayReport = await notionService.getTodayReport(userId);
      const today = moment().tz('Asia/Bangkok').format('DD.MM.YYYY');
      
      if (todayReport) {
        bot.sendMessage(chatId,
          `✅ *Статус отчета за ${today}*\n\n` +
          'Отчет отправлен ✓\n\n' +
          '_Спасибо за вашу работу!_',
          {
            parse_mode: 'Markdown',
            reply_markup: keyboards.mainMenu()
          }
        );
      } else {
        bot.sendMessage(chatId,
          `❌ *Статус отчета за ${today}*\n\n` +
          'Отчет еще не отправлен\n\n' +
          '_Не забудьте отправить отчет до конца дня_',
          {
            parse_mode: 'Markdown',
            reply_markup: keyboards.mainMenu()
          }
        );
      }
    } catch (error) {
      console.error('Status command error:', error);
      bot.sendMessage(chatId, 'Произошла ошибка при проверке статуса.');
    }
  });

  // Команда истории
  bot.onText(/\/history/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
      const user = await userService.getUserByTelegramId(userId);
      if (!user) {
        bot.sendMessage(chatId, 'Пожалуйста, сначала зарегистрируйтесь с помощью команды /start');
        return;
      }

      const reports = await notionService.getUserReports(userId, 5);
      
      if (reports.length === 0) {
        bot.sendMessage(chatId, 
          '📋 У вас пока нет отчетов.',
          { reply_markup: keyboards.mainMenu() }
        );
        return;
      }

      let historyText = '📋 *Ваши последние отчеты:*\n\n';
      
      reports.forEach((report, index) => {
        const date = moment(report.date).format('DD.MM.YYYY');
        const statusEmoji = report.status === 'Отправлен' ? '✅' : '❌';
        
        historyText += `${statusEmoji} *${date}*\n`;
        historyText += `├ Что сделал: ${report.whatDone.substring(0, 50)}${report.whatDone.length > 50 ? '...' : ''}\n`;
        historyText += `├ Проблемы: ${report.problems.substring(0, 50)}${report.problems.length > 50 ? '...' : ''}\n`;
        historyText += `└ Цели: ${report.goals.substring(0, 50)}${report.goals.length > 50 ? '...' : ''}\n\n`;
      });

      bot.sendMessage(chatId, historyText, {
        parse_mode: 'Markdown',
        reply_markup: keyboards.mainMenu()
      });
    } catch (error) {
      console.error('History command error:', error);
      bot.sendMessage(chatId, 'Произошла ошибка при получении истории.');
    }
  });

  // Временная команда для отладки задач
  bot.onText(/\/debug_tasks/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Проверяем, что это менеджер
    if (![385436658, 1734337242].includes(userId)) {
      bot.sendMessage(chatId, '❌ Доступно только для менеджеров');
      return;
    }
    
    try {
      const { getAllTasks } = require('../../services/notionService');
      
      // Получаем все задачи без фильтра
      const allTasks = await getAllTasks();
      
      // Группируем по статусам
      const tasksByStatus = {};
      allTasks.forEach(task => {
        const status = task.status || 'Без статуса';
        if (!tasksByStatus[status]) {
          tasksByStatus[status] = 0;
        }
        tasksByStatus[status]++;
      });
      
      let message = '📊 *Статистика задач по статусам:*\n\n';
      Object.entries(tasksByStatus).forEach(([status, count]) => {
        message += `${status}: ${count} задач\n`;
      });
      
      message += `\n*Всего задач:* ${allTasks.length}`;
      
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      
      // Также выводим в консоль
      console.log('\n=== TASKS BY STATUS ===');
      console.log(tasksByStatus);
      console.log('Total tasks:', allTasks.length);
      
      // Показываем первые 3 задачи для примера
      console.log('\nFirst 3 tasks:');
      allTasks.slice(0, 3).forEach(task => {
        console.log(`- "${task.title}" - Status: "${task.status}"`);
      });
      
    } catch (error) {
      console.error('Debug error:', error);
      bot.sendMessage(chatId, '❌ Ошибка при выполнении отладки');
    }
  });

  // Команда для проверки статусов задач
  bot.onText(/\/check_statuses/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Проверяем, что это менеджер
    if (![385436658, 1734337242].includes(userId)) {
      bot.sendMessage(chatId, '❌ Доступно только для менеджеров');
      return;
    }
    
    try {
      const { getAllTasks } = require('../../services/notionService');
      
      // Проверяем конкретные статусы
      console.log('\n=== CHECKING SPECIFIC STATUSES ===');
      
      const inProgressTasks = await getAllTasks('В работе');
      console.log(`Tasks with status "В работе": ${inProgressTasks.length}`);
      
      const completedTasks = await getAllTasks('Выполнена');
      console.log(`Tasks with status "Выполнена": ${completedTasks.length}`);
      
      const newTasks = await getAllTasks('Новая');
      console.log(`Tasks with status "Новая": ${newTasks.length}`);
      
      // Получаем все задачи для сравнения
      const allTasks = await getAllTasks();
      console.log(`All tasks total: ${allTasks.length}`);
      
      // Выводим уникальные статусы
      const uniqueStatuses = [...new Set(allTasks.map(t => t.status))];
      console.log('Unique statuses in database:', uniqueStatuses);
      console.log('=== END CHECK ===\n');
      
      let message = '🔍 *Проверка статусов:*\n\n';
      message += `В работе: ${inProgressTasks.length}\n`;
      message += `Выполнена: ${completedTasks.length}\n`;
      message += `Новая: ${newTasks.length}\n`;
      message += `Всего: ${allTasks.length}\n\n`;
      message += `*Уникальные статусы:*\n${uniqueStatuses.join(', ')}`;
      
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      
    } catch (error) {
      console.error('Check statuses error:', error);
      bot.sendMessage(chatId, '❌ Ошибка при проверке статусов');
    }
  });

  // Команда для тестирования обновления статуса
  bot.onText(/\/test_update (.+) (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const taskId = match[1];
    const newStatus = match[2];
    
    // Проверяем, что это менеджер
    if (![385436658, 1734337242].includes(userId)) {
      bot.sendMessage(chatId, '❌ Доступно только для менеджеров');
      return;
    }
    
    try {
      const { updateTaskStatus, debugGetTaskById } = require('../../services/notionService');
      
      console.log('\n=== TESTING STATUS UPDATE ===');
      console.log(`Attempting to update task ${taskId} to status "${newStatus}"`);
      
      // Показываем текущий статус
      await debugGetTaskById(taskId);
      
      // Обновляем статус
      await updateTaskStatus(taskId, newStatus);
      
      // Показываем обновленный статус
      await debugGetTaskById(taskId);
      
      await bot.sendMessage(chatId, `✅ Попытка обновления статуса выполнена. Проверьте консоль.`);
      
    } catch (error) {
      console.error('Test update error:', error);
      bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
  });

  // Команда для получения ID задач
  bot.onText(/\/get_task_ids/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Проверяем, что это менеджер
    if (![385436658, 1734337242].includes(userId)) {
      bot.sendMessage(chatId, '❌ Доступно только для менеджеров');
      return;
    }
    
    try {
      const { getAllTasks } = require('../../services/notionService');
      
      const tasks = await getAllTasks();
      let message = '📋 *ID задач:*\n\n';
      
      tasks.slice(0, 5).forEach((task, index) => {
        message += `${index + 1}. ${task.title}\n`;
        message += `   ID: \`${task.id}\`\n`;
        message += `   Статус: ${task.status}\n\n`;
      });
      
      message += '\nИспользуйте:\n`/test_update [ID] [Статус]`\n';
      message += 'Например:\n`/test_update ID "В работе"`';
      
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      
    } catch (error) {
      console.error('Get task IDs error:', error);
      bot.sendMessage(chatId, '❌ Ошибка при получении ID задач');
    }
  });

  // Команда профиля
  bot.onText(/\/profile/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
      const user = await userService.getUserByTelegramId(userId);
      if (!user) {
        bot.sendMessage(chatId, 'Пожалуйста, сначала зарегистрируйтесь с помощью команды /start');
        return;
      }

      const reports = await notionService.getUserReports(userId, 30);
      const totalReports = reports.length;
      const completedReports = reports.filter(r => r.status === 'Отправлен').length;
      const missedReports = reports.filter(r => r.status === 'Просрочен').length;
      
      const profileText = 
        '👤 *Ваш профиль*\n\n' +
        `*Имя:* ${user.name}\n` +
        `*Должность:* ${user.position}\n` +
        `*Статус:* ${user.isActive ? 'Активен ✅' : 'Неактивен ❌'}\n\n` +
        '*Статистика за последние 30 дней:*\n' +
        `├ Всего отчетов: ${totalReports}\n` +
        `├ Отправлено: ${completedReports}\n` +
        `└ Пропущено: ${missedReports}`;

      bot.sendMessage(chatId, profileText, {
        parse_mode: 'Markdown',
        reply_markup: keyboards.mainMenu()
      });
    } catch (error) {
      console.error('Profile command error:', error);
      bot.sendMessage(chatId, 'Произошла ошибка при получении профиля.');
    }
  });

  // Обработчик callback_query для основных кнопок
  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    switch (data) {
      case 'help':
        // Отправляем справку напрямую
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
        
        bot.sendMessage(chatId, helpText, {
          parse_mode: 'Markdown',
          reply_markup: keyboards.mainMenu()
        });
        break;
        
      case 'my_stats':
        try {
          const user = await userService.getUserByTelegramId(userId);
          if (user) {
            const reports = await notionService.getUserReports(userId, 7);
            const completedThisWeek = reports.filter(r => r.status === 'Отправлен').length;
            
            await bot.sendMessage(chatId,
              '📊 *Ваша статистика за неделю:*\n\n' +
              `Отправлено отчетов: ${completedThisWeek} из 7\n` +
              `Процент выполнения: ${Math.round(completedThisWeek / 7 * 100)}%`,
              {
                parse_mode: 'Markdown',
                reply_markup: keyboards.mainMenu()
              }
            );
          } else {
            bot.sendMessage(chatId, 'Пожалуйста, сначала зарегистрируйтесь с помощью /start');
          }
        } catch (error) {
          console.error('Stats error:', error);
          bot.sendMessage(chatId, 'Произошла ошибка при получении статистики.');
        }
        break;
        
      case 'report_history':
        try {
          const user = await userService.getUserByTelegramId(userId);
          if (!user) {
            bot.sendMessage(chatId, 'Пожалуйста, сначала зарегистрируйтесь с помощью команды /start');
            return;
          }

          const reports = await notionService.getUserReports(userId, 5);
          
          if (reports.length === 0) {
            bot.sendMessage(chatId, 
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

            bot.sendMessage(chatId, historyText, {
              parse_mode: 'Markdown',
              reply_markup: keyboards.mainMenu()
            });
          }
        } catch (error) {
          console.error('History error:', error);
          bot.sendMessage(chatId, 'Произошла ошибка при получении истории.');
        }
        break;
        
      case 'remind_later':
        await schedulerService.handleRemindLater(bot, chatId, userId);
        break;
        
      case 'tasks_menu':
        // Передаем управление в обработчик задач
        const { handleTasksCommand } = require('./tasks');
        await bot.answerCallbackQuery(callbackQuery.id);
        await handleTasksCommand(bot, callbackQuery);
        return; // Важно: выходим, чтобы не вызвать answerCallbackQuery дважды
        
      default:
        // Если это не наши callback'и, пропускаем обработку
        // чтобы их мог обработать callbackHandler
        console.log('Commands handler skipping callback:', data);
        return;
    }

    bot.answerCallbackQuery(callbackQuery.id);
  });
};