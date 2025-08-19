const express = require('express');
const path = require('path');
const crypto = require('crypto');

// Используем оптимизированные сервисы
const optimizedNotionService = require('../src/services/optimizedNotionService');
const userService = require('../src/services/userService');

const app = express();
const PORT = process.env.WEBAPP_PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// Проверка данных от Telegram
function validateTelegramWebAppData(initData) {
  const parsedData = new URLSearchParams(initData);
  const hash = parsedData.get('hash');
  parsedData.delete('hash');
  
  const dataCheckString = Array.from(parsedData.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  const secret = crypto
    .createHmac('sha256', 'WebAppData')
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();
    
  const calculatedHash = crypto
    .createHmac('sha256', secret)
    .update(dataCheckString)
    .digest('hex');
  
  return calculatedHash === hash;
}

// Middleware для проверки авторизации
const authMiddleware = (req, res, next) => {
  const initData = req.headers['x-telegram-init-data'];
  
  if (!initData) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // В режиме разработки пропускаем проверку
  if (process.env.NODE_ENV === 'development') {
    const parsedData = new URLSearchParams(initData);
    const user = parsedData.get('user');
    if (user) {
      req.telegramUser = JSON.parse(decodeURIComponent(user));
    }
    return next();
  }
  
  // В продакшене проверяем подпись
  if (!validateTelegramWebAppData(initData)) {
    return res.status(401).json({ error: 'Invalid init data' });
  }
  
  const parsedData = new URLSearchParams(initData);
  const user = parsedData.get('user');
  if (user) {
    req.telegramUser = JSON.parse(decodeURIComponent(user));
  }
  
  next();
};

// ===== ПОДКЛЮЧАЕМ ОПТИМИЗИРОВАННЫЕ API РОУТЫ =====

// Учет времени (Пришел/Ушел)
const attendanceRouter = require('./api/attendance-optimized');
app.use('/api/attendance', attendanceRouter);

// Отчеты
const reportsRouter = require('./api/reports-optimized');
app.use('/api/reports', reportsRouter);

// ===== ОСТАЛЬНЫЕ ЭНДПОИНТЫ =====

// Получить информацию о пользователе
app.get('/api/user/:telegramId', authMiddleware, async (req, res) => {
  try {
    const { telegramId } = req.params;
    
    // Используем оптимизированный сервис - мгновенный ответ из кэша
    const user = await optimizedNotionService.getUserByTelegramId(telegramId);
    
    if (user) {
      res.json({
        success: true,
        user: {
          name: user.name,
          position: user.position,
          isActive: user.isActive
        }
      });
    } else {
      res.json({
        success: false,
        error: 'Пользователь не найден'
      });
    }
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получить задачи пользователя
app.get('/api/tasks/:telegramId', authMiddleware, async (req, res) => {
  try {
    const { telegramId } = req.params;
    const { status } = req.query;
    
    // Получаем задачи из кэша - мгновенно
    const tasks = await optimizedNotionService.getTasksByAssignee(telegramId, status);
    
    res.json({
      success: true,
      tasks: tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        deadline: task.deadline,
        creatorName: task.creatorName
      }))
    });
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Обновить статус задачи
app.post('/api/tasks/:taskId/status', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, comment } = req.body;
    
    // Обновляем статус - мгновенно в кэше, потом синхронизируется
    await optimizedNotionService.updateTaskStatus(taskId, status, comment);
    
    res.json({
      success: true,
      message: 'Статус задачи обновлен'
    });
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Создать задачу
app.post('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const taskData = req.body;
    
    // Создаем задачу - мгновенно в кэше
    const task = await optimizedNotionService.createTask(taskData);
    
    res.json({
      success: true,
      taskId: task.id,
      message: 'Задача создана успешно'
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== АДМИНИСТРАТИВНЫЕ ЭНДПОИНТЫ =====

// Получить статистику системы
app.get('/api/admin/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await optimizedNotionService.getStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Форсировать синхронизацию
app.post('/api/admin/sync', authMiddleware, async (req, res) => {
  try {
    await optimizedNotionService.forceSync();
    
    res.json({
      success: true,
      message: 'Синхронизация запущена'
    });
  } catch (error) {
    console.error('Error forcing sync:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    cache: 'enabled',
    optimization: 'active'
  });
});

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`✅ Optimized Web App server running on port ${PORT}`);
  console.log(`🚀 Cache enabled for instant responses`);
  console.log(`🔄 Background sync with Notion every 5 minutes`);
  console.log(`📊 Access http://localhost:${PORT} to open the app`);
});