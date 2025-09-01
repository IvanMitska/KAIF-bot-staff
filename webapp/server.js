const express = require('express');
const path = require('path');
const crypto = require('crypto');
const notionService = require('../src/services/railwayOptimizedService');
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
async function authMiddleware(req, res, next) {
  console.log('Auth middleware called for:', req.method, req.path);
  const initData = req.headers['x-telegram-init-data'];
  
  if (!initData) {
    console.log('Auth failed: No initData');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // В продакшене обязательно включить проверку
  // if (!validateTelegramWebAppData(initData)) {
  //   return res.status(401).json({ error: 'Invalid data' });
  // }
  
  const parsedData = new URLSearchParams(initData);
  const userString = parsedData.get('user');
  
  if (!userString) {
    console.log('Auth failed: No user string');
    return res.status(401).json({ error: 'User data not found' });
  }
  
  try {
    req.telegramUser = JSON.parse(userString);
    console.log('Auth success: User authenticated -', req.telegramUser.id, req.telegramUser.first_name);
    next();
  } catch (error) {
    console.log('Auth failed: Invalid user data -', error.message);
    return res.status(401).json({ error: 'Invalid user data' });
  }
}

// API маршруты

// Получить профиль пользователя
app.get('/api/profile', authMiddleware, async (req, res) => {
  try {
    const user = await userService.getUserByTelegramId(req.telegramUser.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить статус отчета за сегодня
app.get('/api/reports/today-status', authMiddleware, async (req, res) => {
  try {
    const todayReport = await notionService.getTodayReport(req.telegramUser.id);
    
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
    
    await notionService.createReport(reportData);
    console.log('✅ Report created successfully');
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Create report error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
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
    const reports = await notionService.getUserReports(req.telegramUser.id, 10);
    res.json(reports);
  } catch (error) {
    console.error('Reports history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить мои задачи
app.get('/api/tasks/my', authMiddleware, async (req, res) => {
  try {
    const tasks = await notionService.getTasksByAssignee(req.telegramUser.id);
    res.json(tasks);
  } catch (error) {
    console.error('My tasks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Создать задачу - РАДИКАЛЬНО УПРОЩЕННАЯ ВЕРСИЯ
app.post('/api/tasks', authMiddleware, async (req, res) => {
  console.log('=== СОЗДАНИЕ ЗАДАЧИ ===');
  
  try {
    const MANAGER_IDS = [385436658, 1734337242];
    const currentUserId = parseInt(req.telegramUser.id);
    
    // ПРОСТАЯ ЛОГИКА:
    // 1. Если assigneeId не передан или пустой - создаем задачу себе
    // 2. Если assigneeId = currentUserId - создаем задачу себе  
    // 3. Если assigneeId != currentUserId - проверяем, менеджер ли это
    
    let targetUserId = currentUserId; // По умолчанию - себе
    
    // Если передан assigneeId и он не пустой
    if (req.body.assigneeId && req.body.assigneeId !== '') {
      targetUserId = parseInt(req.body.assigneeId);
      
      // Если пытается назначить на другого и НЕ менеджер - блокируем
      if (targetUserId !== currentUserId && !MANAGER_IDS.includes(currentUserId)) {
        console.log(`❌ Пользователь ${currentUserId} пытается назначить на ${targetUserId} - ЗАПРЕЩЕНО`);
        return res.status(403).json({ 
          error: 'Вы можете создавать задачи только для себя' 
        });
      }
    }
    
    console.log(`✅ Пользователь ${currentUserId} создает задачу для ${targetUserId}`);
    
    // Получаем данные пользователей
    const creator = await userService.getUserByTelegramId(currentUserId);
    const assignee = await userService.getUserByTelegramId(targetUserId);
    
    if (!creator || !assignee) {
      return res.status(404).json({ 
        error: 'Пользователь не найден в базе данных' 
      });
    }
    
    // Создаем задачу
    const taskData = {
      title: req.body.title,
      description: req.body.description || '',
      assigneeId: targetUserId,
      assigneeName: assignee.name,
      creatorId: currentUserId,
      creatorName: creator.name,
      status: 'Новая',
      priority: req.body.priority || 'Средний',
      deadline: req.body.deadline || null
    };
    
    const taskId = await notionService.createTask(taskData);
    console.log('✅ Задача создана с ID:', taskId);
    
    res.json({ success: true, taskId });
    
  } catch (error) {
    console.error('❌ Ошибка создания задачи:', error);
    res.status(500).json({ 
      error: 'Ошибка при создании задачи' 
    });
  }
});

// Обновить статус задачи
app.put('/api/tasks/:taskId/status', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;
    
    await notionService.updateTaskStatus(taskId, status);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить статистику
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.telegramUser.id;
    
    // Получаем отчеты за последние 30 дней
    const reports = await notionService.getUserReports(userId, 30);
    const totalReports = reports.length;
    const completedReports = reports.filter(r => r.status === 'Отправлен').length;
    
    // Получаем задачи
    const tasks = await notionService.getTasksByAssignee(userId);
    const completedTasks = tasks.filter(t => t.status === 'Выполнена').length;
    
    // Считаем текущую серию
    let currentStreak = 0;
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      const hasReport = reports.some(r => 
        r.date === dateStr && r.status === 'Отправлен'
      );
      
      if (hasReport) {
        currentStreak++;
      } else if (i > 0) {
        break;
      }
    }
    
    const completionRate = totalReports > 0 
      ? Math.round((completedReports / totalReports) * 100)
      : 0;
    
    res.json({
      totalReports,
      completedTasks,
      currentStreak,
      completionRate
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить список пользователей (только для менеджеров)
app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    const MANAGER_IDS = [385436658, 1734337242];
    
    if (!MANAGER_IDS.includes(req.telegramUser.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const users = await notionService.getAllActiveUsers();
    res.json(users);
  } catch (error) {
    console.error('Users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить список сотрудников для выбора (доступно всем)
app.get('/api/employees', authMiddleware, async (req, res) => {
  try {
    const MANAGER_IDS = [385436658, 1734337242];
    const userId = req.telegramUser.id;
    
    // Если не менеджер, возвращаем только себя
    if (!MANAGER_IDS.includes(userId)) {
      const user = await userService.getUserByTelegramId(userId);
      if (user) {
        res.json([user]);
      } else {
        res.json([]);
      }
    } else {
      // Менеджер видит всех
      const users = await notionService.getUsers();
      res.json(users);
    }
  } catch (error) {
    console.error('Employees error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Обработка всех остальных маршрутов - возвращаем index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
app.listen(PORT, async () => {
  console.log(`Web App server running on port ${PORT}`);
  console.log(`Open: http://localhost:${PORT}`);
  
  // Инициализируем подключение к базе данных
  try {
    await notionService.initialize();
    console.log('✅ Database service initialized');
  } catch (error) {
    console.error('⚠️ Database initialization failed:', error.message);
    console.log('Will use direct Notion API calls');
  }
});