require('dotenv').config();
const express = require('express');
const path = require('path');
const bot = require('./bot/bot');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Статические файлы для веб-приложения
app.use('/webapp/public', express.static(path.join(__dirname, '../webapp/public')));

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
  const railwayService = require('./services/railwayOptimizedService');
  setTimeout(async () => {
    try {
      await railwayService.initialize();
      const stats = await railwayService.getStats();
      console.log('📊 Database initialized with stats:', stats);
      
      const dbOk = await railwayService.testTasksDatabase();
      if (dbOk) {
        await railwayService.debugGetAllTasks();
      }
    } catch (error) {
      console.error('Debug error:', error);
    }
  }, 3000);
});