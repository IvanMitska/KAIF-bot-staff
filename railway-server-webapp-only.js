require('dotenv').config();
const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Проверяем переменные окружения
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'NOTION_API_KEY',
  'NOTION_DATABASE_REPORTS_ID',
  'NOTION_DATABASE_USERS_ID',
  'NOTION_DATABASE_TASKS_ID',
  'NOTION_DATABASE_ATTENDANCE_ID'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Отсутствуют переменные окружения:', missingVars.join(', '));
  console.error('Добавьте их в Railway dashboard → Variables');
}

// Функция для отправки запроса фото
async function sendPhotoRequest(bot, userId, taskTitle) {
  try {
    await bot.sendMessage(userId, 
      `✅ Задача "${taskTitle}" выполнена!\n\n` +
      `📸 Вы можете прикрепить фото результата работы.\n` +
      `Отправьте фото в этот чат или нажмите "Пропустить"`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            {
              text: '⏭ Пропустить',
              callback_data: 'skip_photo'
            }
          ]]
        }
      }
    );
    
    console.log('Photo request sent to user:', userId);
  } catch (error) {
    console.error('Error sending photo request:', error);
  }
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

// API endpoints
const notionService = require('./src/services/notionService');
const userService = require('./src/services/userService');

// Middleware для проверки авторизации
async function authMiddleware(req, res, next) {
  const initData = req.headers['x-telegram-init-data'];
  
  console.log('Auth middleware - initData present:', !!initData);
  console.log('Auth middleware - headers:', Object.keys(req.headers));
  
  if (!initData) {
    console.error('No initData in headers');
    return res.status(401).json({ error: 'Unauthorized - No initData' });
  }
  
  try {
    const parsedData = new URLSearchParams(initData);
    const userString = parsedData.get('user');
    
    console.log('Parsed user string:', userString ? 'Found' : 'Not found');
    
    if (!userString) {
      console.error('No user data in initData');
      return res.status(401).json({ error: 'User data not found in initData' });
    }
    
    req.telegramUser = JSON.parse(userString);
    console.log('User authenticated:', req.telegramUser.id, req.telegramUser.first_name);
    
    // Автоматическая регистрация при первом входе
    const existingUser = await userService.getUserByTelegramId(req.telegramUser.id);
    if (!existingUser && req.body.autoRegister) {
      await userService.createUser({
        telegramId: req.telegramUser.id,
        username: req.telegramUser.username || '',
        name: req.body.name || `${req.telegramUser.first_name} ${req.telegramUser.last_name || ''}`.trim(),
        position: req.body.position || 'Сотрудник'
      });
    }
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Invalid user data: ' + error.message });
  }
}

// API маршруты
app.get('/api/profile', authMiddleware, async (req, res) => {
  try {
    const user = await userService.getUserByTelegramId(req.telegramUser.id);
    res.json(user || { needsRegistration: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/register', authMiddleware, async (req, res) => {
  try {
    const userData = {
      telegramId: req.telegramUser.id,
      username: req.telegramUser.username || '',
      name: req.body.name,
      position: req.body.position
    };
    
    const user = await userService.createUser(userData);
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
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
    let user = await userService.getUserByTelegramId(req.telegramUser.id);
    
    // Если пользователь не найден, создаем его автоматически
    if (!user) {
      console.log(`User ${req.telegramUser.id} not found, creating automatically`);
      
      const newUserData = {
        telegramId: req.telegramUser.id,
        username: req.telegramUser.username || '',
        name: `${req.telegramUser.first_name} ${req.telegramUser.last_name || ''}`.trim(),
        position: 'Сотрудник'
      };
      
      try {
        user = await userService.createUser(newUserData);
        console.log(`User ${req.telegramUser.id} created successfully`);
      } catch (createError) {
        console.error('Error creating user:', createError);
        return res.status(500).json({ error: 'Failed to create user profile' });
      }
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
    
    console.log('Creating report:', {
      userId: req.telegramUser.id,
      userName: user.name,
      date: reportData.date
    });
    
    await notionService.createReport(reportData);
    console.log('Report created successfully for user:', user.name);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/tasks/my', authMiddleware, async (req, res) => {
  try {
    console.log('Getting tasks for user:', req.telegramUser.id, 'type:', typeof req.telegramUser.id);
    console.log('User details:', {
      id: req.telegramUser.id,
      first_name: req.telegramUser.first_name,
      username: req.telegramUser.username
    });
    
    const tasks = await notionService.getTasksByAssignee(req.telegramUser.id);
    console.log('Found tasks:', tasks.length);
    
    if (tasks.length > 0) {
      console.log('First task:', {
        title: tasks[0].title,
        status: tasks[0].status,
        assigneeId: tasks[0].assigneeId
      });
    }
    
    res.json(tasks);
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Получить задачи, поставленные мной (для менеджеров)
app.get('/api/tasks/created', authMiddleware, async (req, res) => {
  try {
    const MANAGER_IDS = [385436658, 1734337242];
    
    if (!MANAGER_IDS.includes(req.telegramUser.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    console.log('Getting created tasks for manager:', req.telegramUser.id);
    
    const tasks = await notionService.getTasksByCreator(req.telegramUser.id);
    console.log('Found created tasks:', tasks.length);
    
    res.json(tasks);
  } catch (error) {
    console.error('Error getting created tasks:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.post('/api/tasks/:taskId/complete', authMiddleware, async (req, res) => {
  try {
    await notionService.completeTask(req.params.taskId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Обновить задачу (для менеджеров)
app.put('/api/tasks/:taskId', authMiddleware, async (req, res) => {
  try {
    const MANAGER_IDS = [385436658, 1734337242];
    
    if (!MANAGER_IDS.includes(req.telegramUser.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const { title, description, deadline, priority, assigneeId } = req.body;
    
    // Получаем информацию о новом исполнителе
    const assignee = await userService.getUserByTelegramId(assigneeId);
    if (!assignee) {
      return res.status(404).json({ error: 'Assignee not found' });
    }
    
    // Обновляем задачу
    await notionService.updateTask(req.params.taskId, {
      title,
      description,
      deadline,
      priority,
      assigneeId,
      assigneeName: assignee.name
    });
    
    console.log(`Task ${req.params.taskId} updated by manager ${req.telegramUser.id}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Обновить статус задачи
app.put('/api/tasks/:taskId/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Новая', 'В работе', 'Выполнена'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    // Получаем задачу для проверки прав
    const tasks = await notionService.getTasksByAssignee(req.telegramUser.id);
    const task = tasks.find(t => t.id === req.params.taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }
    
    console.log('Task details for notification:', {
      taskId: task.id,
      title: task.title,
      creatorId: task.creatorId,
      creatorName: task.creatorName,
      currentUserId: req.telegramUser.id,
      willSendNotification: task.creatorId && task.creatorId !== req.telegramUser.id
    });
    
    // Обновляем статус
    await notionService.updateTaskStatus(req.params.taskId, status);
    
    console.log(`Task ${req.params.taskId} status updated to ${status} by user ${req.telegramUser.id}`);
    
    // Если задача выполнена, сохраняем информацию для запроса фото
    if (status === 'Выполнена') {
      try {
        // Сохраняем информацию о задаче для последующей обработки фото
        const pendingPhotos = global.pendingTaskPhotos || new Map();
        pendingPhotos.set(req.telegramUser.id, {
          taskId: req.params.taskId,
          taskTitle: task.title,
          timestamp: Date.now(),
          needsPhotoRequest: true
        });
        global.pendingTaskPhotos = pendingPhotos;
        
        console.log('Task marked for photo request:', req.telegramUser.id);
        
        // Отправляем флаг в ответе, что нужно запросить фото
        res.json({ 
          success: true, 
          requestPhoto: true,
          taskTitle: task.title 
        });
        
        // Запускаем отложенную отправку через глобальный бот
        setTimeout(() => {
          if (global.botInstance) {
            sendPhotoRequest(global.botInstance, req.telegramUser.id, task.title);
          }
        }, 1000);
        
        return; // Важно: выходим здесь, чтобы не отправить res.json дважды
      } catch (photoError) {
        console.error('Failed to setup photo request:', photoError);
      }
    }
    
    // Отправляем уведомления создателю задачи
    if (task.creatorId && task.creatorId !== req.telegramUser.id) {
      try {
        const executor = await userService.getUserByTelegramId(req.telegramUser.id);
        const TelegramBot = require('node-telegram-bot-api');
        const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
        
        let message = '';
        
        if (status === 'Выполнена') {
          message = `✅ *Задача выполнена!*\n\n` +
                   `📋 *Задача:* ${task.title}\n` +
                   `👤 *Исполнитель:* ${executor?.name || 'Неизвестный'}\n` +
                   `📅 *Дата выполнения:* ${new Date().toLocaleDateString('ru-RU')}\n\n` +
                   `Отличная работа команды! 🎉`;
        } else if (status === 'В работе') {
          message = `🚀 *Задача взята в работу!*\n\n` +
                   `📋 *Задача:* ${task.title}\n` +
                   `👤 *Исполнитель:* ${executor?.name || 'Неизвестный'}\n` +
                   `📅 *Дата:* ${new Date().toLocaleDateString('ru-RU')}\n\n` +
                   `Работа началась! 💪`;
        }
        
        if (message) {
          await bot.sendMessage(task.creatorId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                {
                  text: '📱 Открыть KAIF App',
                  web_app: { 
                    url: `https://${process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN}/webapp/public` 
                  }
                }
              ]]
            }
          });
          
          console.log('Status notification sent to task creator');
        }
      } catch (notificationError) {
        console.error('Failed to send status notification:', notificationError);
        // Не прерываем обновление статуса из-за ошибки уведомления
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating task status:', error);
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
      activeTasks: tasks.filter(t => t.status === 'В работе').length,
      currentStreak: 0,
      completionRate: reports.length > 0 ? Math.round((reports.filter(r => r.status === 'Отправлен').length / reports.length) * 100) : 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить список сотрудников (для менеджеров)
app.get('/api/employees', authMiddleware, async (req, res) => {
  try {
    const MANAGER_IDS = [385436658, 1734337242];
    
    if (!MANAGER_IDS.includes(req.telegramUser.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const employees = await notionService.getAllActiveUsers();
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Создать задачу
app.post('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const MANAGER_IDS = [385436658, 1734337242];
    const isManager = MANAGER_IDS.includes(req.telegramUser.id);
    
    // Проверяем права: обычные пользователи могут создавать задачи только себе
    if (!isManager && req.body.assigneeId !== req.telegramUser.id) {
      return res.status(403).json({ error: 'Вы можете создавать задачи только для себя' });
    }
    
    const creator = await userService.getUserByTelegramId(req.telegramUser.id);
    const assignee = await userService.getUserByTelegramId(req.body.assigneeId);
    
    console.log('Creating task:', {
      creatorId: req.telegramUser.id,
      assigneeId: req.body.assigneeId,
      isManager: isManager,
      isSelfTask: req.telegramUser.id === req.body.assigneeId,
      assignee: assignee ? { name: assignee.name, telegramId: assignee.telegramId } : null
    });
    
    if (!creator || !assignee) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const taskData = {
      title: req.body.title,
      description: req.body.description || '',
      assigneeId: assignee.telegramId, // Используем telegramId из найденного пользователя
      assigneeName: assignee.name,
      creatorId: req.telegramUser.id,
      creatorName: creator.name,
      status: 'Новая',
      priority: req.body.priority || 'medium',
      deadline: req.body.deadline || null,
      createdAt: new Date().toISOString()
    };
    
    const taskId = await notionService.createTask(taskData);
    
    // Отправляем уведомление в Telegram только если задача НЕ для себя
    const isSelfTask = req.telegramUser.id === req.body.assigneeId;
    
    if (!isSelfTask) {
      try {
        const TelegramBot = require('node-telegram-bot-api');
        const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
        
        const message = `🆕 *Новая задача от ${creator.name}*\n\n` +
                       `📋 *Задача:* ${taskData.title}\n` +
                       (taskData.description ? `📝 *Описание:* ${taskData.description}\n` : '') +
                       `📅 *Срок:* ${taskData.deadline ? new Date(taskData.deadline).toLocaleDateString('ru-RU') : 'Без срока'}\n` +
                       `🔥 *Приоритет:* ${taskData.priority === 'high' ? '🔴 Высокий' : taskData.priority === 'medium' ? '🟡 Средний' : '🟢 Низкий'}\n\n` +
                       `Откройте KAIF App для просмотра деталей`;
        
        console.log('Sending notification to assignee:', {
          assigneeId: assignee.telegramId,
          assigneeName: assignee.name,
          taskTitle: taskData.title
        });
        
        await bot.sendMessage(assignee.telegramId, message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              {
                text: '📱 Открыть KAIF App',
                web_app: { 
                  url: `https://${process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN}/webapp/public` 
                }
              }
            ]]
          }
        });
        
        console.log('Notification sent successfully to assignee:', assignee.name);
      } catch (notificationError) {
        console.error('Failed to send notification:', notificationError);
        // Не прерываем создание задачи из-за ошибки уведомления
      }
    } else {
      console.log('Self-task created, no notification sent');
    }
    
    res.json({ success: true, taskId });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Dashboard статистика (только для менеджеров)
app.get('/api/admin/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const MANAGER_IDS = [385436658, 1734337242];
    
    if (!MANAGER_IDS.includes(req.telegramUser.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // Получаем все задачи
    const allTasks = await notionService.getAllTasks();
    const activeTasks = allTasks.filter(t => t.status !== 'Выполнена').length;
    const completedToday = allTasks.filter(t => 
      t.status === 'Выполнена' && 
      t.completedDate && 
      t.completedDate.split('T')[0] === today
    ).length;
    
    // Статус задач
    const tasksStatus = {
      new: allTasks.filter(t => t.status === 'Новая').length,
      inProgress: allTasks.filter(t => t.status === 'В работе').length,
      completed: allTasks.filter(t => t.status === 'Выполнена').length
    };
    
    // Активность за неделю
    const weekActivity = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const reports = await notionService.getReportsForPeriod(dateStr, dateStr);
      weekActivity.push({
        date: dateStr,
        count: reports.length
      });
    }
    
    // Топ сотрудников за месяц
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthReports = await notionService.getReportsForPeriod(
      monthStart.toISOString().split('T')[0],
      today
    );
    
    // Группируем по сотрудникам
    const employeeReports = {};
    monthReports.forEach(report => {
      if (!employeeReports[report.employeeName]) {
        employeeReports[report.employeeName] = 0;
      }
      employeeReports[report.employeeName]++;
    });
    
    // Сортируем и берем топ-5
    const topEmployees = Object.entries(employeeReports)
      .map(([name, count]) => ({ name, reportsCount: count }))
      .sort((a, b) => b.reportsCount - a.reportsCount)
      .slice(0, 5);
    
    res.json({
      activeTasks,
      completedToday,
      tasksStatus,
      weekActivity,
      topEmployees
    });
    
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Отправить напоминание сотруднику (только для менеджеров)
app.post('/api/admin/send-reminder', authMiddleware, async (req, res) => {
  try {
    const MANAGER_IDS = [385436658, 1734337242];
    
    if (!MANAGER_IDS.includes(req.telegramUser.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const { employeeId } = req.body;
    
    const TelegramBot = require('node-telegram-bot-api');
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
    
    const message = `⚠️ *Напоминание от руководства*\n\n` +
                   `Пожалуйста, не забудьте отправить отчет за сегодня.\n\n` +
                   `Откройте KAIF App для отправки отчета.`;
    
    await bot.sendMessage(employeeId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          {
            text: '📱 Открыть KAIF App',
            web_app: { 
              url: `https://${process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN}/webapp/public` 
            }
          }
        ]]
      }
    });
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error sending reminder:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить отчеты для админ-панели (только для менеджеров)
app.get('/api/admin/reports', authMiddleware, async (req, res) => {
  try {
    const MANAGER_IDS = [385436658, 1734337242];
    
    if (!MANAGER_IDS.includes(req.telegramUser.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const { startDate, endDate, employeeId } = req.query;
    
    console.log('Admin reports request:', { startDate, endDate, employeeId });
    
    // Получаем отчеты за период
    const reports = await notionService.getReportsForPeriod(startDate, endDate, employeeId);
    
    // Считаем статистику
    const today = new Date().toISOString().split('T')[0];
    const todayReports = reports.filter(r => r.date === today).length;
    
    // Получаем задачи для подсчета выполненных
    const completedTasks = await notionService.getAllTasks('Выполнена');
    const tasksInPeriod = completedTasks.filter(task => {
      if (!task.completedDate) return false;
      const taskDate = task.completedDate.split('T')[0];
      return taskDate >= startDate && taskDate <= endDate;
    });
    
    res.json({
      reports,
      totalReports: reports.length,
      todayReports,
      completedTasks: tasksInPeriod.length
    });
    
  } catch (error) {
    console.error('Error getting admin reports:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить статус учета времени за сегодня
app.get('/api/attendance/today', authMiddleware, async (req, res) => {
  try {
    const attendance = await notionService.getTodayAttendance(req.telegramUser.id);
    res.json(attendance);
  } catch (error) {
    console.error('Error getting today attendance:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Отметить приход
app.post('/api/attendance/check-in', authMiddleware, async (req, res) => {
  try {
    const user = await userService.getUserByTelegramId(req.telegramUser.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Проверяем, не отмечен ли уже приход сегодня
    const existingAttendance = await notionService.getTodayAttendance(req.telegramUser.id);
    if (existingAttendance && existingAttendance.checkIn) {
      return res.status(400).json({ error: 'Already checked in today' });
    }
    
    const attendanceData = {
      employeeName: user.name,
      employeeId: req.telegramUser.id,
      date: new Date().toISOString().split('T')[0],
      checkIn: new Date().toISOString(),
      status: 'На работе',
      late: new Date().getHours() >= 9 // Опоздание, если после 9:00
    };
    
    await notionService.createAttendance(attendanceData);
    
    // Отправляем уведомление менеджерам
    const MANAGER_IDS = [385436658, 1734337242];
    const TelegramBot = require('node-telegram-bot-api');
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
    
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const message = `🟢 *${user.name}* пришел на работу\n⏰ Время: ${time}${attendanceData.late ? '\n⚠️ Опоздание!' : ''}`;
    
    for (const managerId of MANAGER_IDS) {
      try {
        await bot.sendMessage(managerId, message, { parse_mode: 'Markdown' });
      } catch (notifError) {
        console.error('Failed to notify manager:', managerId, notifError);
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error checking in:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Отметить уход
app.post('/api/attendance/check-out', authMiddleware, async (req, res) => {
  try {
    const attendance = await notionService.getTodayAttendance(req.telegramUser.id);
    if (!attendance) {
      return res.status(400).json({ error: 'Not checked in today' });
    }
    
    if (attendance.checkOut) {
      return res.status(400).json({ error: 'Already checked out today' });
    }
    
    const checkOut = new Date().toISOString();
    const workHours = await notionService.updateAttendanceCheckOut(attendance.id, checkOut);
    
    // Отправляем уведомление менеджерам
    const user = await userService.getUserByTelegramId(req.telegramUser.id);
    const MANAGER_IDS = [385436658, 1734337242];
    const TelegramBot = require('node-telegram-bot-api');
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
    
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const message = `🔴 *${user.name}* ушел с работы\n⏰ Время: ${time}\n⏱ Отработано: ${workHours} часов`;
    
    for (const managerId of MANAGER_IDS) {
      try {
        await bot.sendMessage(managerId, message, { parse_mode: 'Markdown' });
      } catch (notifError) {
        console.error('Failed to notify manager:', managerId, notifError);
      }
    }
    
    res.json({ success: true, workHours });
  } catch (error) {
    console.error('Error checking out:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить текущий статус присутствия (только для менеджеров)
app.get('/api/admin/attendance/current', authMiddleware, async (req, res) => {
  try {
    // Проверяем права менеджера
    const MANAGER_IDS = [385436658, 1734337242];
    if (!MANAGER_IDS.includes(req.telegramUser.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const currentStatus = await notionService.getCurrentAttendanceStatus();
    res.json(currentStatus);
  } catch (error) {
    console.error('Error getting attendance status:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить историю учета времени (только для менеджеров)
app.get('/api/admin/attendance/history', authMiddleware, async (req, res) => {
  try {
    // Проверяем права менеджера
    const MANAGER_IDS = [385436658, 1734337242];
    if (!MANAGER_IDS.includes(req.telegramUser.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { startDate, endDate, employeeId } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    
    const attendanceHistory = await notionService.getAttendanceForPeriod(
      startDate, 
      endDate, 
      employeeId || null
    );
    
    res.json(attendanceHistory);
  } catch (error) {
    console.error('Error getting attendance history:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Временный endpoint для отладки задач
app.get('/api/debug/tasks', authMiddleware, async (req, res) => {
  try {
    const allTasks = await notionService.debugGetAllTasks();
    const userTasks = await notionService.getTasksByAssignee(req.telegramUser.id);
    
    res.json({
      currentUserId: req.telegramUser.id,
      totalTasksInDB: allTasks.length,
      userTasksFound: userTasks.length,
      debug: 'Check server logs for detailed output'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      <title>KAIF Bot - Web App Only</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
        h1 { color: #333; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .success { background: #d4edda; color: #155724; }
        .info { background: #d1ecf1; color: #0c5460; }
        a { color: #007bff; text-decoration: none; }
        code { background: #f0f0f0; padding: 2px 5px; border-radius: 3px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 KAIF Bot - Web App Only Mode</h1>
        
        ${missingVars.length > 0 ? `
          <div class="status info">
            <h3>⚠️ Настройка требуется</h3>
            <p>Добавьте переменные в Railway → Variables:</p>
            <ul>${missingVars.map(v => `<li><code>${v}</code></li>`).join('')}</ul>
          </div>
        ` : `
          <div class="status success">
            <h3>✅ Сервер работает!</h3>
          </div>
        `}
        
        <div class="status info">
          <h3>📱 Web App Mode</h3>
          <p>Бот работает только через Web App</p>
          <p>URL: <code>${webappUrl}</code></p>
        </div>
        
        <h2>Как использовать:</h2>
        <ol>
          <li>Откройте Telegram</li>
          <li>Найдите бота @Report_KAIF_bot</li>
          <li>Отправьте команду /start</li>
          <li>Нажмите кнопку "Открыть KAIF App"</li>
        </ol>
      </div>
    </body>
    </html>
  `);
});

// Запускаем бота если все переменные есть
if (missingVars.length === 0) {
  // Запускаем минимальный бот
  const { spawn } = require('child_process');
  const botProcess = spawn('node', ['src/bot-minimal.js'], {
    stdio: 'inherit',
    env: process.env
  });
  
  botProcess.on('error', (err) => {
    console.error('Failed to start bot:', err);
  });
  
  botProcess.on('exit', (code) => {
    console.log(`Bot process exited with code ${code}`);
    if (code !== 0) {
      // Перезапуск через 5 секунд при ошибке
      setTimeout(() => {
        console.log('Restarting bot...');
        spawn('node', ['src/bot-minimal.js'], {
          stdio: 'inherit',
          env: process.env
        });
      }, 5000);
    }
  });
}

// Запуск сервера
app.listen(PORT, () => {
  const publicUrl = process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'your-railway-domain';
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Web App Only Mode активен`);
  console.log(`🌐 Web App URL: https://${publicUrl}/webapp/public`);
  console.log(`🔗 Railway Domain: ${publicUrl}`);
});