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

// Логирование запросов к статическим файлам для отладки
app.use((req, res, next) => {
  if (req.path.endsWith('.css') || req.path.endsWith('.js') || req.path.endsWith('.json')) {
    console.log(`📁 Static file request: ${req.path}`);
  }
  next();
});

// Статические файлы для веб-приложения (основной путь и альтернативный)
app.use(express.static(path.join(__dirname, 'webapp', 'public')));
app.use('/webapp/public', express.static(path.join(__dirname, 'webapp', 'public')));

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
    
    // Добавляем информацию о менеджерском доступе
    const MANAGER_IDS = [385436658, 1734337242]; // Борис, Иван
    const isManager = MANAGER_IDS.includes(parseInt(req.telegramUser.id));
    
    res.json({
      ...user,
      isManager: isManager
    });
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

// Создать задачу
app.post('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const MANAGER_IDS = [385436658, 1734337242];
    const currentUserId = parseInt(req.telegramUser.id);
    
    // Проверяем права
    let targetUserId = currentUserId;
    if (req.body.assigneeId && req.body.assigneeId !== '') {
      targetUserId = parseInt(req.body.assigneeId);
      
      if (targetUserId !== currentUserId && !MANAGER_IDS.includes(currentUserId)) {
        return res.status(403).json({ 
          error: 'Вы можете создавать задачи только для себя' 
        });
      }
    }
    
    // Получаем данные пользователей
    const creator = await userService.getUserByTelegramId(currentUserId);
    const assignee = await userService.getUserByTelegramId(targetUserId);
    
    if (!creator || !assignee) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    const taskData = {
      title: req.body.title,
      description: req.body.description || '',
      assigneeId: targetUserId,
      assigneeName: assignee.name,
      creatorId: currentUserId,
      creatorName: creator.name,
      priority: req.body.priority || 'Средний',
      deadline: req.body.deadline,
      status: 'Новая'
    };
    
    console.log('📝 Creating task:', taskData);
    const result = await railwayService.createTask(taskData);
    
    res.json({ success: true, task: result });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Ошибка при создании задачи' });
  }
});

// Обновить статус задачи
app.put('/api/tasks/:taskId/status', authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;
    
    await railwayService.updateTaskStatus(taskId, status);
    res.json({ success: true });
  } catch (error) {
    console.error('Update task status error:', error);
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

// ========== ATTENDANCE ENDPOINTS ==========

// Получить статус attendance за сегодня
app.get('/api/attendance/today', authMiddleware, async (req, res) => {
  try {
    const attendance = await railwayService.getTodayAttendance(req.telegramUser.id);
    res.json(attendance || { isPresent: false });
  } catch (error) {
    console.error('Today attendance error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Отметить приход
app.post('/api/attendance/check-in', authMiddleware, async (req, res) => {
  try {
    const user = await userService.getUserByTelegramId(req.telegramUser.id);
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    const attendanceData = {
      employeeId: req.telegramUser.id,
      employeeName: user.name,
      date: new Date().toISOString().split('T')[0],
      checkIn: new Date().toISOString(),
      location: req.body.location || null,
      status: 'На работе'
    };
    
    console.log('📍 Check-in for user:', user.name);
    const result = await railwayService.createAttendance(attendanceData);
    
    res.json({ 
      success: true, 
      attendance: result,
      message: 'Вы отметились на работе'
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Ошибка при отметке прихода' });
  }
});

// Отметить уход
app.post('/api/attendance/check-out', authMiddleware, async (req, res) => {
  try {
    const attendance = await railwayService.getTodayAttendance(req.telegramUser.id);
    
    if (!attendance) {
      return res.status(400).json({ error: 'Сначала нужно отметить приход' });
    }
    
    const checkOut = new Date().toISOString();
    const workHours = await railwayService.updateAttendanceCheckOut(
      attendance.id,
      checkOut,
      req.body.location || null
    );
    
    console.log('🚪 Check-out for user:', req.telegramUser.id, 'Work hours:', workHours);
    
    res.json({ 
      success: true,
      workHours: workHours,
      message: `Вы отработали ${workHours || 0} часов`
    });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ error: 'Ошибка при отметке ухода' });
  }
});

// Получить статистику attendance
app.get('/api/attendance/stats', authMiddleware, async (req, res) => {
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const attendance = await railwayService.getAttendanceForPeriod(
      startDate, 
      endDate, 
      req.telegramUser.id
    );
    
    const totalDays = attendance.length;
    const totalHours = attendance.reduce((sum, a) => sum + (a.workHours || 0), 0);
    const avgHours = totalDays > 0 ? (totalHours / totalDays).toFixed(1) : 0;
    
    res.json({
      totalDays,
      totalHours: totalHours.toFixed(1),
      avgHours,
      records: attendance
    });
  } catch (error) {
    console.error('Attendance stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// Получить общую статистику (только для менеджеров)
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const MANAGER_IDS = [385436658, 1734337242];
    const userId = parseInt(req.telegramUser.id);
    
    if (!MANAGER_IDS.includes(userId)) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }
    
    // Получаем статистику
    const users = await railwayService.getAllActiveUsers();
    const today = new Date().toISOString().split('T')[0];
    const reports = await railwayService.getReportsForPeriod(today, today);
    const currentAttendance = await railwayService.getCurrentAttendanceStatus();
    
    res.json({
      totalUsers: users.length,
      todayReports: reports.length,
      presentEmployees: currentAttendance?.filter(a => a.isPresent).length || 0,
      users: users,
      todayReportsList: reports,
      attendance: currentAttendance
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Health check endpoint для Railway
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    service: 'unified-server',
    timestamp: new Date() 
  });
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({ 
    status: 'Bot and WebApp are running',
    timestamp: new Date() 
  });
});

// Главная страница - отдаем веб-приложение
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'webapp', 'public', 'index.html'));
});

// Различные варианты путей для веб-приложения
app.get('/webapp', (req, res) => {
  res.sendFile(path.join(__dirname, 'webapp', 'public', 'index.html'));
});

app.get('/webapp/public', (req, res) => {
  res.sendFile(path.join(__dirname, 'webapp', 'public', 'index.html'));
});


// Catch all для любых других путей - возвращаем веб-приложение
app.get('*', (req, res) => {
  // Логируем неизвестные пути для отладки
  if (!req.path.startsWith('/api/')) {
    console.log(`📍 Route request: ${req.path}`);
  }
  res.sendFile(path.join(__dirname, 'webapp', 'public', 'index.html'));
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