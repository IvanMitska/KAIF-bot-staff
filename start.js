// Скрипт для одновременного запуска бота и Web App
const { spawn } = require('child_process');
const express = require('express');
const path = require('path');

console.log('🚀 Starting KAIF Bot and Web App...');

// Определяем порты
const BOT_PORT = process.env.PORT || 3000;
const WEBAPP_PORT = parseInt(BOT_PORT) + 1;

// Обновляем переменные окружения
process.env.WEBAPP_PORT = WEBAPP_PORT;

// Запускаем Web App
const webapp = spawn('node', ['webapp/server.js'], {
  stdio: 'inherit',
  env: { 
    ...process.env,
    WEBAPP_PORT: WEBAPP_PORT 
  }
});

// Создаем прокси сервер на основном порту
const app = express();

// Прокси для Web App
app.use('/webapp', (req, res) => {
  res.redirect(`http://localhost:${WEBAPP_PORT}${req.url}`);
});

// Статические файлы Web App
app.use(express.static(path.join(__dirname, 'webapp/public')));

// Запускаем прокси
app.listen(BOT_PORT, () => {
  console.log(`Proxy server running on port ${BOT_PORT}`);
  console.log(`Web App available at /webapp`);
});

// Запускаем бота
const bot = spawn('node', ['src/app.js'], {
  stdio: 'inherit',
  env: { 
    ...process.env,
    PORT: BOT_PORT + 10 // Бот на другом порту
  }
});

// Обработка завершения процессов
webapp.on('exit', (code) => {
  console.log(`Web App exited with code ${code}`);
  bot.kill();
  process.exit(code);
});

bot.on('exit', (code) => {
  console.log(`Bot exited with code ${code}`);
  webapp.kill();
  process.exit(code);
});

// Обработка сигналов завершения
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping services...');
  webapp.kill();
  bot.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Stopping services...');
  webapp.kill();
  bot.kill();
  process.exit(0);
});