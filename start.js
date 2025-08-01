// Скрипт для одновременного запуска бота и Web App
const { spawn } = require('child_process');

console.log('🚀 Starting KAIF Bot and Web App...');

// Запускаем Web App
const webapp = spawn('node', ['webapp/server.js'], {
  stdio: 'inherit',
  env: { ...process.env }
});

// Запускаем бота
const bot = spawn('node', ['src/app.js'], {
  stdio: 'inherit',
  env: { ...process.env }
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