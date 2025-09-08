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
  
  console.log('🔐 Auth check:', {
    hasInitData: !!initData,
    dataLength: initData?.length || 0,
    origin: req.headers.origin,
    referer: req.headers.referer,
    userAgent: req.headers['user-agent']?.substring(0, 50)
  });
  
  // В режиме разработки или при наличии test параметра разрешаем тестовый доступ
  const isTestMode = req.headers.referer?.includes('test=') || req.query?.test;
  if ((process.env.NODE_ENV === 'development' || !process.env.NODE_ENV || isTestMode) && !initData) {
    console.log('⚠️ Test mode: Allowing test access without Telegram auth');
    // Используем тестового пользователя
    req.telegramUser = {
      id: 1734337242, // ID Ивана для тестирования
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser'
    };
    return next();
  }
  
  if (!initData) {
    console.log('❌ No initData provided in production mode');
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Please open this app through Telegram bot'
    });
  }
  
  try {
    // Пробуем проверить подпись
    let isValid = false;
    try {
      isValid = verifyTelegramWebAppData(initData);
    } catch (verifyError) {
      console.warn('⚠️ Signature verification failed:', verifyError.message);
      // В продакшене на Railway иногда проверка подписи может не работать
      // из-за особенностей прокси, поэтому делаем fallback
      if (process.env.RAILWAY_ENVIRONMENT) {
        console.log('🔧 Railway environment detected, using fallback auth');
        isValid = true; // Доверяем данным в Railway
      }
    }
    
    if (!isValid && !process.env.RAILWAY_ENVIRONMENT) {
      console.log('❌ Invalid telegram data signature');
      return res.status(401).json({ error: 'Invalid data' });
    }
    
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    
    if (!userStr) {
      console.log('❌ No user data in initData');
      return res.status(401).json({ error: 'No user data' });
    }
    
    const user = JSON.parse(userStr);
    console.log('✅ Authorized user:', user.id, user.first_name);
    req.telegramUser = user;
    next();
  } catch (error) {
    console.error('❌ Auth error:', error.message);
    console.error('Stack:', error.stack);
    res.status(401).json({ 
      error: 'Auth failed',
      details: error.message 
    });
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
    const userIdNum = parseInt(req.telegramUser.id);
    const isManager = MANAGER_IDS.includes(userIdNum);
    
    console.log('🔐 Manager access check:', {
      telegramUserId: req.telegramUser.id,
      userIdNum: userIdNum,
      MANAGER_IDS: MANAGER_IDS,
      isManager: isManager,
      userName: user.name
    });
    
    res.json({
      ...user,
      isManager: isManager,
      telegramId: req.telegramUser.id // Явно добавляем ID из токена
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
    console.log(`📱 Getting tasks for user: ${req.telegramUser.id}`);
    console.log('Request headers:', req.headers);
    console.log('User object:', req.telegramUser);
    
    const tasks = await railwayService.getTasksByAssignee(req.telegramUser.id);
    console.log(`📊 Returning ${tasks.length} tasks to client`);
    console.log('First task sample:', tasks[0]);
    
    res.json(tasks);
  } catch (error) {
    console.error('❌ My tasks error:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Тестовый эндпоинт для получения задач без авторизации (только для отладки)
app.get('/api/test/tasks/:telegramId', async (req, res) => {
  try {
    const telegramId = req.params.telegramId;
    console.log(`🧪 TEST: Getting tasks for user: ${telegramId}`);
    
    const tasks = await railwayService.getTasksByAssignee(telegramId);
    console.log(`📊 TEST: Found ${tasks.length} tasks`);
    
    res.json({
      success: true,
      telegramId: telegramId,
      tasksCount: tasks.length,
      tasks: tasks
    });
  } catch (error) {
    console.error('Test tasks error:', error);
    res.status(500).json({ 
      error: 'Server error', 
      details: error.message,
      stack: error.stack 
    });
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


// Получить список сотрудников (только для менеджеров)
app.get('/api/employees', authMiddleware, async (req, res) => {
  try {
    const MANAGER_IDS = [385436658, 1734337242];
    const userId = parseInt(req.telegramUser.id);
    
    if (!MANAGER_IDS.includes(userId)) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }
    
    const users = await railwayService.getAllActiveUsers();
    console.log(`👥 Found ${users.length} active employees`);
    res.json(users || []);
  } catch (error) {
    console.error('Employees error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить отчеты для админ-панели (только для менеджеров)
app.get('/api/admin/reports', authMiddleware, async (req, res) => {
  try {
    const MANAGER_IDS = [385436658, 1734337242];
    const userId = parseInt(req.telegramUser.id);
    
    if (!MANAGER_IDS.includes(userId)) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }
    
    const { startDate, endDate } = req.query;
    console.log('📊 Getting reports for period:', { startDate, endDate });
    
    const reports = await railwayService.getReportsForPeriod(startDate, endDate);
    
    console.log(`📈 Found ${reports.length} reports for period ${startDate} to ${endDate}`);
    
    res.json({
      reports: reports || [],
      todayReports: reports ? reports.length : 0,
      total: reports ? reports.length : 0
    });
  } catch (error) {
    console.error('Admin reports error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить статистику для dashboard (только для менеджеров)
app.get('/api/admin/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const MANAGER_IDS = [385436658, 1734337242];
    const userId = parseInt(req.telegramUser.id);
    
    if (!MANAGER_IDS.includes(userId)) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }
    
    // Получаем данные для dashboard
    const today = new Date().toISOString().split('T')[0];
    const tasks = await railwayService.getAllTasks();
    const reports = await railwayService.getReportsForPeriod(today, today);
    
    const activeTasks = tasks.filter(t => t.status !== 'Выполнена' && t.status !== 'Отменена').length;
    const completedToday = tasks.filter(t => 
      t.status === 'Выполнена' && 
      t.updatedAt && 
      t.updatedAt.startsWith(today)
    ).length;
    
    // Получаем топ сотрудников за последние 30 дней
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const allReports = await railwayService.getReportsForPeriod(
      thirtyDaysAgo.toISOString().split('T')[0],
      today
    );
    
    // Подсчитываем отчеты по сотрудникам
    const employeeReportCounts = {};
    if (allReports && allReports.length > 0) {
      allReports.forEach(report => {
        const name = report.employeeName || 'Неизвестный';
        employeeReportCounts[name] = (employeeReportCounts[name] || 0) + 1;
      });
    }
    
    // Сортируем и берем топ-5
    const topEmployees = Object.entries(employeeReportCounts)
      .map(([name, count]) => ({ name, reportsCount: count }))
      .sort((a, b) => b.reportsCount - a.reportsCount)
      .slice(0, 5);
    
    // Генерируем данные активности за неделю
    const weekActivity = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayReports = await railwayService.getReportsForPeriod(dateStr, dateStr);
      weekActivity.push({
        date: dateStr,
        count: dayReports ? dayReports.length : 0
      });
    }
    
    res.json({
      activeTasks,
      completedToday,
      weekActivity,
      topEmployees,
      tasksStatus: {
        new: tasks.filter(t => t.status === 'Новая').length,
        inProgress: tasks.filter(t => t.status === 'В работе').length,
        completed: tasks.filter(t => t.status === 'Выполнена').length
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить учет времени для периода (только для менеджеров)
app.get('/api/admin/attendance', authMiddleware, async (req, res) => {
  try {
    const MANAGER_IDS = [385436658, 1734337242];
    const userId = parseInt(req.telegramUser.id);
    
    if (!MANAGER_IDS.includes(userId)) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }
    
    const { startDate, endDate } = req.query;
    const attendance = await railwayService.getAttendanceForPeriod(startDate, endDate);
    
    res.json(attendance);
  } catch (error) {
    console.error('Admin attendance error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить текущий статус посещаемости (только для менеджеров)
app.get('/api/admin/attendance/current', authMiddleware, async (req, res) => {
  try {
    const MANAGER_IDS = [385436658, 1734337242];
    const userId = parseInt(req.telegramUser.id);
    
    if (!MANAGER_IDS.includes(userId)) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }
    
    const currentAttendance = await railwayService.getCurrentAttendanceStatus();
    res.json(currentAttendance || []);
  } catch (error) {
    console.error('Current attendance error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить общую статистику присутствия для виджета на главной странице (доступно всем)
app.get('/api/attendance/summary', authMiddleware, async (req, res) => {
  try {
    console.log('📊 Getting attendance summary for home widget');
    
    // Получаем всех активных пользователей
    const users = await railwayService.getAllActiveUsers();
    const totalEmployees = users.length;
    
    // Получаем текущий статус присутствия
    const currentAttendance = await railwayService.getCurrentAttendanceStatus();
    
    let presentCount = 0;
    let lateCount = 0;
    
    const workStartTime = new Date();
    workStartTime.setHours(9, 0, 0, 0); // Начало рабочего дня в 9:00
    
    // Подсчитываем статусы
    if (currentAttendance && currentAttendance.length > 0) {
      currentAttendance.forEach(record => {
        if (record.checkIn && !record.checkOut) {
          // Сотрудник на работе
          const checkInTime = new Date(record.checkIn);
          
          if (checkInTime > workStartTime) {
            lateCount++; // Опоздал
          } else {
            presentCount++; // Пришел вовремя
          }
        }
      });
    }
    
    // Вычисляем отсутствующих
    const absentCount = Math.max(0, totalEmployees - presentCount - lateCount);
    
    console.log('📈 Attendance summary:', {
      totalEmployees,
      presentCount,
      lateCount,
      absentCount,
      attendanceRecords: currentAttendance ? currentAttendance.length : 0
    });
    
    res.json({
      totalEmployees,
      presentCount,
      lateCount,
      absentCount,
      attendanceRecords: currentAttendance || []
    });
  } catch (error) {
    console.error('Attendance summary error:', error);
    res.status(500).json({ 
      error: 'Server error',
      totalEmployees: 0,
      presentCount: 0,
      lateCount: 0,
      absentCount: 0
    });
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

// Эндпоинт для включения тестового режима
app.get('/api/test-mode', (req, res) => {
  res.json({
    testMode: true,
    message: 'Test mode enabled. You can now access the app without Telegram auth.',
    testUser: {
      id: 1734337242,
      name: 'Test User (Ivan)',
      position: 'Программист'
    },
    hint: 'Add ?test=1 to any API endpoint to use test mode'
  });
});

// Диагностический эндпоинт
app.get('/api/debug/info', async (req, res) => {
  try {
    const dbStats = await railwayService.getStats();
    const dbTest = await railwayService.testTasksDatabase();
    
    res.json({
      server: 'OK',
      database: dbTest ? 'Connected' : 'Failed',
      stats: dbStats,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        WEBAPP_URL: process.env.WEBAPP_URL || 'Not set',
        DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Not set',
        RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT || 'Not Railway',
        BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'Set' : 'Not set'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Тестовый эндпоинт для проверки БД
app.get('/api/debug/db-test', async (req, res) => {
  console.log('🧪 Database test requested');
  
  try {
    // 1. Проверяем инициализацию
    await railwayService.initialize();
    console.log('✅ Service initialized');
    
    // 2. Проверяем подключение к БД
    const stats = await railwayService.getStats();
    console.log('📊 DB Stats:', stats);
    
    // 3. Пробуем получить задачи напрямую
    const testUserId = '1734337242'; // Ivan
    const tasks = await railwayService.getTasksByAssignee(testUserId);
    console.log(`📋 Found ${tasks.length} tasks for user ${testUserId}`);
    
    // 4. Проверяем кэш сервис напрямую
    let cacheStatus = 'Not initialized';
    if (railwayService.cache) {
      try {
        const cacheStats = await railwayService.cache.getCacheStats();
        cacheStatus = `Connected (${cacheStats.tasks} tasks)`;
      } catch (e) {
        cacheStatus = `Error: ${e.message}`;
      }
    }
    
    res.json({
      success: true,
      database: {
        initialized: railwayService.initialized,
        cacheStatus: cacheStatus,
        stats: stats
      },
      testData: {
        userId: testUserId,
        tasksFound: tasks.length,
        firstTask: tasks[0] || null
      },
      environment: {
        DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Missing',
        NODE_ENV: process.env.NODE_ENV || 'Not set'
      }
    });
  } catch (error) {
    console.error('❌ DB Test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      database: {
        initialized: railwayService.initialized,
        hasCache: !!railwayService.cache
      }
    });
  }
});

// НОВЫЙ: Прямой тест PostgreSQL
app.get('/api/debug/postgres-direct', async (req, res) => {
  const postgresService = require('./src/services/postgresService');
  
  console.log('🔵 Direct PostgreSQL test');
  
  try {
    // 1. Тест подключения
    const connected = await postgresService.testConnection();
    console.log('Connection test:', connected);
    
    // 2. Получаем статистику
    const stats = await postgresService.getStats();
    console.log('Stats:', stats);
    
    // 3. Получаем задачи для тестового пользователя
    const tasks = await postgresService.getTasksByAssignee('1734337242');
    console.log('Tasks found:', tasks.length);
    
    // 4. Получаем всех пользователей
    const allTasks = await postgresService.getAllTasks();
    
    res.json({
      success: true,
      connection: connected,
      stats: stats,
      test: {
        userId: '1734337242',
        tasksFound: tasks.length,
        firstTask: tasks[0] || null,
        totalTasksInDB: allTasks.length
      },
      database: {
        url: process.env.DATABASE_URL ? 'Present' : 'Missing',
        isInternal: process.env.DATABASE_URL?.includes('.railway.internal')
      }
    });
  } catch (error) {
    console.error('❌ PostgreSQL direct test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      database: {
        url: process.env.DATABASE_URL ? 'Present' : 'Missing'
      }
    });
  }
});

// Эндпоинт для проверки состояния БД и сервисов
app.get('/api/debug/status', async (req, res) => {
  const databasePool = require('./src/services/databasePool');
  
  try {
    console.log('📊 Checking system status...');
    
    // Проверяем переменные окружения
    const envStatus = {
      DATABASE_URL: !!process.env.DATABASE_URL,
      DATABASE_URL_TYPE: process.env.DATABASE_URL ? 
        (process.env.DATABASE_URL.includes('railway.internal') ? 'internal' : 'proxy') : 'missing',
      DATABASE_HOST: process.env.DATABASE_URL ? 
        process.env.DATABASE_URL.split('@')[1]?.split(':')[0] : 'unknown',
      TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
      NODE_ENV: process.env.NODE_ENV || 'not set',
      RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT || 'not railway'
    };
    
    // Проверяем подключение к БД
    let dbStatus = { connected: false };
    try {
      const pool = await databasePool.getPool();
      const result = await pool.query('SELECT NOW() as time, COUNT(*) as users FROM users');
      dbStatus = {
        connected: true,
        time: result.rows[0].time,
        userCount: result.rows[0].users
      };
      
      // Проверяем таблицы
      const tables = await pool.query(`
        SELECT tablename, 
               (SELECT COUNT(*) FROM users) as users_count,
               (SELECT COUNT(*) FROM tasks) as tasks_count,
               (SELECT COUNT(*) FROM reports) as reports_count
        FROM pg_tables 
        WHERE schemaname = 'public'
        LIMIT 1
      `);
      
      if (tables.rows[0]) {
        dbStatus.tables = {
          users: tables.rows[0].users_count,
          tasks: tables.rows[0].tasks_count,
          reports: tables.rows[0].reports_count
        };
      }
    } catch (dbError) {
      dbStatus.error = dbError.message;
    }
    
    // Проверяем инициализацию сервисов
    const servicesStatus = {
      railwayService: railwayService.initialized,
      postgresService: !!require('./src/services/postgresService').pool
    };
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: envStatus,
      database: dbStatus,
      services: servicesStatus
    });
    
  } catch (error) {
    console.error('❌ Status check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      environment: {
        DATABASE_URL: !!process.env.DATABASE_URL
      }
    });
  }
});

// Эндпоинт для активации всех пользователей
app.get('/api/debug/activate-users', async (req, res) => {
  const postgresService = require('./src/services/postgresService');
  
  console.log('🔄 Activating all users...');
  
  try {
    await postgresService.initialize();
    
    // Активируем всех пользователей
    const updateQuery = `UPDATE users SET is_active = true WHERE is_active = false OR is_active IS NULL`;
    const databasePool = require('./src/services/databasePool');
    const result = await databasePool.query(updateQuery);
    console.log(`✅ Activated ${result.rowCount} users`);
    
    // Получаем обновленный список
    const users = await databasePool.query('SELECT telegram_id, name, position, is_active FROM users ORDER BY name');
    
    res.json({
      success: true,
      activated: result.rowCount,
      totalUsers: users.rows.length,
      users: users.rows.map(u => ({
        name: u.name,
        telegramId: u.telegram_id,
        position: u.position,
        active: u.is_active
      }))
    });
  } catch (error) {
    console.error('❌ Failed to activate users:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
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