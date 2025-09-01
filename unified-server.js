require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');

// Запускаем бота
require('./src/bot/bot');

// Инициализируем сервисы
const railwayService = require('./src/services/railwayOptimizedService');
const userService = require('./src/services/userService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'webapp/public')));

// CORS для Telegram Web App
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Init-Data');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Проверка Telegram Web App Data
function verifyTelegramWebAppData(telegramInitData) {
  const urlParams = new URLSearchParams(telegramInitData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');
  
  const checkString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();
  
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex');
  
  return calculatedHash === hash;
}

// Middleware для проверки авторизации
const authMiddleware = (req, res, next) => {
  const initData = req.headers['x-telegram-init-data'];
  
  if (!initData) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const isValid = verifyTelegramWebAppData(initData);
    
    if (!isValid) {
      console.log('Invalid telegram data');
      return res.status(401).json({ error: 'Invalid data' });
    }
    
    const urlParams = new URLSearchParams(initData);
    const user = JSON.parse(urlParams.get('user'));
    req.telegramUser = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Auth failed' });
  }
};

// API Routes
app.get('/api/profile', authMiddleware, async (req, res) => {
  try {
    console.log('📱 Getting profile for user:', req.telegramUser.id);
    const user = await userService.getUserByTelegramId(req.telegramUser.id);
    
    if (!user) {
      console.log('❌ User not found, creating new user...');
      // Если пользователя нет, создаем его
      const newUser = await userService.createUser({
        telegramId: req.telegramUser.id,
        username: req.telegramUser.username,
        name: req.telegramUser.first_name + (req.telegramUser.last_name ? ' ' + req.telegramUser.last_name : ''),
        position: 'Сотрудник'
      });
      return res.json(newUser);
    }
    
    res.json(user);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Ошибка загрузки профиля' });
  }
});

// Получить статус отчета за сегодня
app.get('/api/reports/today-status', authMiddleware, async (req, res) => {
  try {
    const todayReport = await railwayService.getTodayReport(req.telegramUser.id);
    
    res.json({
      reportSent: !!todayReport,
      report: todayReport
    });
  } catch (error) {
    console.error('Today status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Создать отчет
app.post('/api/reports', authMiddleware, async (req, res) => {
  try {
    console.log('📝 Creating report for user:', req.telegramUser.id);
    
    const user = await userService.getUserByTelegramId(req.telegramUser.id);
    
    if (!user) {
      console.error('User not found:', req.telegramUser.id);
      return res.status(404).json({ error: 'Пользователь не найден. Пожалуйста, зарегистрируйтесь через бота командой /start' });
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
    
    console.log('Report data:', reportData);
    
    await railwayService.createReport(reportData);
    console.log('✅ Report created successfully');
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Create report error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
    
    let errorMessage = 'Ошибка при создании отчета';
    
    if (error.message?.includes('NOTION') || error.code === 'ENOTFOUND') {
      errorMessage = 'Ошибка подключения к Notion API';
    } else if (error.message?.includes('required')) {
      errorMessage = 'Не заполнены обязательные поля';
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// Получить историю отчетов
app.get('/api/reports/history', authMiddleware, async (req, res) => {
  try {
    const reports = await railwayService.getUserReports(req.telegramUser.id, 10);
    res.json(reports);
  } catch (error) {
    console.error('Reports history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить мои задачи
app.get('/api/tasks/my', authMiddleware, async (req, res) => {
  try {
    const tasks = await railwayService.getTasksByAssignee(req.telegramUser.id);
    res.json(tasks);
  } catch (error) {
    console.error('My tasks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить количество задач
app.get('/api/tasks/count', authMiddleware, async (req, res) => {
  try {
    const tasks = await railwayService.getTasksByAssignee(req.telegramUser.id);
    const activeTasks = tasks.filter(t => t.status !== 'Выполнена' && t.status !== 'Отменена');
    
    res.json({ 
      total: tasks.length,
      active: activeTasks.length,
      completed: tasks.filter(t => t.status === 'Выполнена').length
    });
  } catch (error) {
    console.error('Tasks count error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    service: 'unified-server',
    timestamp: new Date() 
  });
});

// Главная страница
app.get('/', (req, res) => {
  res.json({ 
    status: 'Bot and WebApp are running',
    timestamp: new Date() 
  });
});

// Serve webapp
app.get('/webapp', (req, res) => {
  res.sendFile(path.join(__dirname, 'webapp/public/index.html'));
});

// Все остальные маршруты возвращают webapp
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'webapp/public/index.html'));
});

// Запуск сервера
app.listen(PORT, async () => {
  console.log(`✅ Unified server running on port ${PORT}`);
  console.log('📱 Telegram bot is active');
  console.log('🌐 WebApp is available at /webapp');
  
  // Инициализируем подключение к базе данных
  try {
    await railwayService.initialize();
    const stats = await railwayService.getStats();
    console.log('✅ Database service initialized');
    console.log('📊 Database stats:', stats);
  } catch (error) {
    console.error('⚠️ Database initialization failed:', error.message);
    console.log('Will use direct Notion API calls');
  }
});