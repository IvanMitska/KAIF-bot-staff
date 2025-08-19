require('dotenv').config();
const express = require('express');
const bot = require('./bot/bot');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'Bot is running', timestamp: new Date() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('Telegram bot is active');
  
  // Keep alive для бесплатных хостингов
  if (process.env.RENDER_EXTERNAL_URL) {
    const keepAlive = require('./utils/keepAlive');
    keepAlive(process.env.RENDER_EXTERNAL_URL);
  }
  
  // Отладка: тестируем подключение к базе данных задач
  const { testTasksDatabase, debugGetAllTasks } = require('./services/optimizedNotionService');
  setTimeout(async () => {
    try {
      const dbOk = await testTasksDatabase();
      if (dbOk) {
        await debugGetAllTasks();
      }
    } catch (error) {
      console.error('Debug error:', error);
    }
  }, 3000);
});