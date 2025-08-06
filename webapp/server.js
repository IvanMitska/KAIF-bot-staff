const express = require('express');
const path = require('path');
const crypto = require('crypto');
const notionService = require('../src/services/notionService');
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
  const initData = req.headers['x-telegram-init-data'];
  
  if (!initData) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // В продакшене обязательно включить проверку
  // if (!validateTelegramWebAppData(initData)) {
  //   return res.status(401).json({ error: 'Invalid data' });
  // }
  
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
    console.error('Create report error:', error);
    res.status(500).json({ error: 'Server error' });
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

// Создать задачу
app.post('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const MANAGER_IDS = [385436658, 1734337242];
    const userId = req.telegramUser.id;
    
    console.log('=== TASK CREATION DEBUG ===');
    console.log('Raw request body:', JSON.stringify(req.body));
    console.log('Raw userId from telegram:', userId, 'type:', typeof userId);
    console.log('assigneeId from body:', req.body.assigneeId, 'type:', typeof req.body.assigneeId);
    console.log('Is assigneeId undefined?', req.body.assigneeId === undefined);
    console.log('Is assigneeId null?', req.body.assigneeId === null);
    console.log('Is assigneeId empty string?', req.body.assigneeId === '');
    
    // Преобразуем в числа для корректного сравнения
    const userIdNum = parseInt(userId);
    
    // ВРЕМЕННОЕ РЕШЕНИЕ: Всегда разрешаем создавать задачи себе
    const hasAssigneeId = req.body.hasOwnProperty('assigneeId') && 
                          req.body.assigneeId !== undefined && 
                          req.body.assigneeId !== null && 
                          req.body.assigneeId !== '';
    
    console.log('Has assigneeId in request?', hasAssigneeId);
    console.log('User is creating task, userId:', userIdNum);
    
    let assigneeId;
    
    if (!hasAssigneeId) {
      // Нет assigneeId - пользователь создает задачу себе - ВСЕГДА РАЗРЕШАЕМ
      assigneeId = userIdNum;
      console.log('No assigneeId provided - creating task for self:', userIdNum);
    } else {
      // assigneeId передан
      assigneeId = parseInt(req.body.assigneeId);
      console.log('AssigneeId provided:', assigneeId, 'userIdNum:', userIdNum);
      
      // Проверяем: если это тот же пользователь - разрешаем
      if (assigneeId === userIdNum) {
        console.log('User creating task for themselves - ALLOWED');
      } else if (MANAGER_IDS.includes(userIdNum)) {
        console.log('Manager creating task for someone else - ALLOWED');
      } else {
        console.log('Access denied: non-manager tries to assign to someone else');
        return res.status(403).json({ error: 'Вы можете создавать задачи только для себя' });
      }
    }
    
    console.log('Final assigneeId:', assigneeId, 'userIdNum:', userIdNum);
    
    const user = await userService.getUserByTelegramId(userIdNum);
    console.log('Creator user found:', user ? 'YES' : 'NO', user?.name);
    
    const assignee = await userService.getUserByTelegramId(assigneeId);
    console.log('Assignee user found:', assignee ? 'YES' : 'NO', assignee?.name);
    
    if (!user) {
      console.error('Creator not found in database, userId:', userIdNum);
      return res.status(404).json({ error: 'Создатель задачи не найден в базе данных' });
    }
    
    if (!assignee) {
      console.error('Assignee not found in database, assigneeId:', assigneeId);
      return res.status(404).json({ error: 'Исполнитель не найден в базе данных' });
    }
    
    const taskData = {
      title: req.body.title,
      description: req.body.description || '',
      assigneeId: assigneeId,
      assigneeName: assignee.name,
      creatorId: userIdNum,
      creatorName: user.name,
      status: 'Новая',
      priority: req.body.priority || 'Средний',
      deadline: req.body.deadline || null
    };
    
    const taskId = await notionService.createTask(taskData);
    
    res.json({ success: true, taskId });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Server error' });
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
app.listen(PORT, () => {
  console.log(`Web App server running on port ${PORT}`);
  console.log(`Open: http://localhost:${PORT}`);
});