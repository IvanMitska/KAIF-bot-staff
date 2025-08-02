require('dotenv').config();
const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Проверяем критичные переменные окружения
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'NOTION_API_KEY',
  'NOTION_DATABASE_REPORTS_ID',
  'NOTION_DATABASE_USERS_ID',
  'NOTION_DATABASE_TASKS_ID'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Please set them in Railway dashboard');
  
  // Продолжаем работу сервера для отображения страницы с инструкциями
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS для Web App
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Init-Data');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Статические файлы для Web App
app.use('/webapp/public', express.static(path.join(__dirname, 'webapp/public')));
app.use('/webapp/static', express.static(path.join(__dirname, 'webapp/static')));

// API endpoints из webapp/server.js
const notionService = require('./src/services/notionService');
const userService = require('./src/services/userService');

// Простая проверка авторизации
async function authMiddleware(req, res, next) {
  const initData = req.headers['x-telegram-init-data'];
  
  if (!initData) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const parsedData = new URLSearchParams(initData);
  const userString = parsedData.get('user');
  
  if (!userString) {
    return res.status(401).json({ error: 'User data not found' });
  }
  
  try {
    req.telegramUser = JSON.parse(userString);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid user data' });
  }
}

// API маршруты
app.get('/api/profile', authMiddleware, async (req, res) => {
  try {
    const user = await userService.getUserByTelegramId(req.telegramUser.id);
    res.json(user || { error: 'User not found' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/reports/today-status', authMiddleware, async (req, res) => {
  try {
    const todayReport = await notionService.getTodayReport(req.telegramUser.id);
    res.json({ reportSent: !!todayReport });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/reports', authMiddleware, async (req, res) => {
  try {
    const user = await userService.getUserByTelegramId(req.telegramUser.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const reportData = {
      date: new Date().toISOString().split('T')[0],
      employeeName: user.name,
      telegramId: req.telegramUser.id,
      whatDone: req.body.whatDone,
      problems: req.body.problems || 'Нет',
      goals: 'Не указано',
      timestamp: new Date().toISOString(),
      status: 'Отправлен'
    };
    
    await notionService.createReport(reportData);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/tasks/my', authMiddleware, async (req, res) => {
  try {
    const tasks = await notionService.getTasksByAssignee(req.telegramUser.id);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const reports = await notionService.getUserReports(req.telegramUser.id, 30);
    const tasks = await notionService.getTasksByAssignee(req.telegramUser.id);
    
    res.json({
      totalReports: reports.length,
      completedTasks: tasks.filter(t => t.status === 'Выполнена').length,
      currentStreak: 0,
      completionRate: reports.length > 0 ? Math.round((reports.filter(r => r.status === 'Отправлен').length / reports.length) * 100) : 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Главная страница
app.get('/', (req, res) => {
  const publicUrl = process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost';
  const webappUrl = `https://${publicUrl}/webapp/public`;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>KAIF Bot Server</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
        h1 { color: #333; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        a { color: #007bff; text-decoration: none; }
        code { background: #f0f0f0; padding: 2px 5px; border-radius: 3px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🤖 KAIF Bot Server</h1>
        
        ${missingVars.length > 0 ? `
          <div class="status error">
            <h3>⚠️ Configuration Required</h3>
            <p>Missing environment variables in Railway:</p>
            <ul>${missingVars.map(v => `<li><code>${v}</code></li>`).join('')}</ul>
            <p>Please add them in Railway dashboard → Variables</p>
          </div>
        ` : `
          <div class="status success">
            <h3>✅ Bot is running!</h3>
          </div>
        `}
        
        <h2>Web App</h2>
        <p>URL for Telegram: <code>${webappUrl}</code></p>
        <p><a href="/webapp/public">Open Web App →</a></p>
        
        <h2>Environment</h2>
        <ul>
          <li>Node.js: ${process.version}</li>
          <li>PORT: ${PORT}</li>
          <li>Railway: ${process.env.RAILWAY_ENVIRONMENT || 'not detected'}</li>
        </ul>
      </div>
    </body>
    </html>
  `);
});

// Запускаем бота только если все переменные установлены
if (missingVars.length === 0) {
  // Запускаем бота в отдельном процессе
  const bot = spawn('node', ['src/app.js'], {
    stdio: 'inherit',
    env: process.env
  });
  
  bot.on('error', (err) => {
    console.error('Failed to start bot:', err);
  });
  
  bot.on('exit', (code) => {
    console.log(`Bot process exited with code ${code}`);
  });
}

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Web App will be available at: https://[your-railway-domain]/webapp/public`);
});