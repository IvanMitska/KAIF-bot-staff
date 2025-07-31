const SimpleBot = require('./simple-bot');
const startHandler = require('./handlers/start');
const reportHandler = require('./handlers/report');
const commandsHandler = require('./handlers/commands');
const tasksHandler = require('./handlers/tasks');
const { handleCallbackQuery } = require('./handlers/callbackHandler');
const { handleTaskCreationFlow } = require('./handlers/taskCreation');
const { handleTaskCompletion } = require('./handlers/taskList');
const { handleQuickTask } = require('./handlers/quickTask');
const { handleQuickTaskInput } = require('./handlers/quickTaskMenu');
const schedulerService = require('../services/schedulerService');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not provided!');
  process.exit(1);
}

const bot = new SimpleBot(token);

console.log('Bot initialized with token:', token.substring(0, 10) + '...');

// Удаляем webhook и запускаем polling
bot.deleteWebHook().then(() => {
  console.log('Webhook deleted');
  
  // Проверяем бота
  bot.getMe().then(info => {
    console.log('Bot info:', info);
    console.log(`Bot username: @${info.username}`);
    
    // ВАЖНО: порядок регистрации имеет значение!
    // Сначала регистрируем start handler для обработки регистрации
    startHandler(bot);
    // Потом остальные обработчики
    commandsHandler(bot);
    reportHandler(bot);
    
    // Обработчик команды /tasks
    bot.onText(/^\/tasks$/, (msg) => tasksHandler.handleTasksCommand(bot, msg));
    
    // Быстрое создание задач
    bot.onText(/^\/task(\s+.+)?$/, (msg) => handleQuickTask(bot, msg));
    
    // Обработчик callback queries для задач (кроме tasks_menu, который в commands.js)
    bot.on('callback_query', async (callbackQuery) => {
      await handleCallbackQuery(bot, callbackQuery);
    });
    
    // Обработчик текстовых сообщений для создания задач
    bot.on('message', async (msg) => {
      if (msg.text && !msg.text.startsWith('/')) {
        // Сначала проверяем быстрые задачи
        const quickTaskHandled = await handleQuickTaskInput(bot, msg);
        if (quickTaskHandled) return;
        
        const taskFlowHandled = await handleTaskCreationFlow(bot, msg);
        if (taskFlowHandled) return;
        
        // Временно отключено для деплоя
        // const taskCompletionHandled = await handleTaskCompletion(bot, msg);
        // if (taskCompletionHandled) return;
      }
    });
    
    schedulerService.initScheduler(bot);
    
    // Запускаем polling
    bot.startPolling();
    
    console.log('Bot is ready!');
  }).catch(err => {
    console.error('Failed to get bot info:', err);
  });
}).catch(err => {
  console.error('Failed to delete webhook:', err);
});

module.exports = bot;