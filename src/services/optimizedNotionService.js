const notionService = require('./notionService');
const { getInstance: getCacheInstance } = require('./cacheService');
const { getInstance: getSyncInstance } = require('./syncService');

class OptimizedNotionService {
  constructor() {
    this.cache = null;
    this.sync = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    this.cache = await getCacheInstance();
    this.sync = await getSyncInstance();
    this.initialized = true;
    
    console.log('✅ Optimized Notion service initialized');
  }

  // ========== USER METHODS ==========
  async createUser(userData) {
    await this.initialize();
    
    // Сохраняем в кэш сразу
    await this.cache.cacheUser(userData);
    
    // Добавляем в очередь синхронизации
    this.sync.addToQueue(async () => {
      await notionService.createUser(userData);
    });
    
    return userData;
  }

  async getUserByTelegramId(telegramId) {
    await this.initialize();
    
    // Сначала проверяем кэш
    const cachedUser = await this.cache.getCachedUser(telegramId);
    if (cachedUser) {
      console.log(`✅ User ${telegramId} loaded from cache`);
      return cachedUser;
    }
    
    // Если нет в кэше, загружаем из Notion
    console.log(`📥 Loading user ${telegramId} from Notion...`);
    const user = await notionService.getUserByTelegramId(telegramId);
    
    if (user) {
      // Сохраняем в кэш
      await this.cache.cacheUser(user);
    }
    
    return user;
  }

  async getAllActiveUsers() {
    await this.initialize();
    
    // Возвращаем из кэша
    const cachedUsers = await this.cache.getAllCachedUsers();
    
    if (cachedUsers.length > 0) {
      console.log(`✅ Loaded ${cachedUsers.length} users from cache`);
      return cachedUsers;
    }
    
    // Если кэш пустой, загружаем из Notion
    console.log('📥 Loading users from Notion...');
    const users = await notionService.getAllActiveUsers();
    
    // Кэшируем всех пользователей
    for (const user of users) {
      await this.cache.cacheUser(user);
    }
    
    return users;
  }

  async updateUser(telegramId, updates) {
    await this.initialize();
    
    // Обновляем в кэше
    const user = await this.cache.getCachedUser(telegramId);
    if (user) {
      const updatedUser = { ...user, ...updates };
      await this.cache.cacheUser(updatedUser);
    }
    
    // Добавляем в очередь синхронизации
    this.sync.addToQueue(async () => {
      await notionService.updateUser(telegramId, updates);
    });
    
    return true;
  }

  // ========== REPORT METHODS ==========
  async createReport(reportData) {
    await this.initialize();
    
    // Генерируем ID для отчета
    const reportId = `report-${reportData.telegramId}-${Date.now()}`;
    const reportWithId = { ...reportData, id: reportId, synced: false };
    
    // Сохраняем в кэш
    await this.cache.cacheReport(reportWithId);
    console.log(`✅ Report saved to cache: ${reportId}`);
    
    // Добавляем в очередь синхронизации с высоким приоритетом
    this.sync.addToQueue(async () => {
      try {
        const notionResponse = await notionService.createReport(reportData);
        // Обновляем ID и статус синхронизации
        await this.cache.markReportSynced(reportId);
        console.log(`✅ Report synced to Notion: ${reportId}`);
      } catch (error) {
        console.error(`Failed to sync report ${reportId} to Notion:`, error);
      }
    });
    
    return reportWithId;
  }

  async getTodayReport(telegramId) {
    await this.initialize();
    
    // Проверяем кэш
    const cachedReport = await this.cache.getCachedTodayReport(telegramId);
    if (cachedReport) {
      console.log(`✅ Today's report loaded from cache for ${telegramId}`);
      return cachedReport;
    }
    
    // Загружаем из Notion если нет в кэше
    console.log(`📥 Loading today's report from Notion for ${telegramId}...`);
    const report = await notionService.getTodayReport(telegramId);
    
    if (report) {
      await this.cache.cacheReport({
        ...report,
        telegramId,
        synced: true
      });
    }
    
    return report;
  }

  async getUserReports(telegramId, limit = 5) {
    await this.initialize();
    
    // Загружаем из кэша
    const cachedReports = await this.cache.getCachedUserReports(telegramId, limit);
    
    if (cachedReports.length > 0) {
      console.log(`✅ Loaded ${cachedReports.length} reports from cache`);
      return cachedReports;
    }
    
    // Если нет в кэше, загружаем из Notion
    console.log(`📥 Loading reports from Notion for ${telegramId}...`);
    const reports = await notionService.getUserReports(telegramId, limit);
    
    // Кэшируем отчеты
    for (const report of reports) {
      await this.cache.cacheReport({
        ...report,
        telegramId,
        synced: true
      });
    }
    
    return reports;
  }

  async getReportsForPeriod(startDate, endDate, employeeId = null) {
    await this.initialize();
    
    // Для периодических отчетов всегда обращаемся к Notion
    // так как они используются для аналитики
    console.log(`📥 Loading period reports from Notion...`);
    return await notionService.getReportsForPeriod(startDate, endDate, employeeId);
  }

  // ========== TASK METHODS ==========
  async createTask(taskData) {
    await this.initialize();
    
    // Генерируем временный ID
    const tempId = `task-${Date.now()}`;
    const taskWithId = { ...taskData, id: tempId, synced: false };
    
    // Сохраняем в кэш
    await this.cache.cacheTask(taskWithId);
    console.log(`✅ Task saved to cache: ${tempId}`);
    
    // Синхронизируем с Notion
    this.sync.addToQueue(async () => {
      try {
        const notionTask = await notionService.createTask(taskData);
        // Обновляем ID в кэше
        await this.cache.runQuery(
          `UPDATE tasks SET id = ?, synced = 1 WHERE id = ?`,
          [notionTask.id, tempId]
        );
        console.log(`✅ Task synced to Notion: ${notionTask.id}`);
      } catch (error) {
        console.error(`Failed to sync task ${tempId} to Notion:`, error);
      }
    });
    
    return taskWithId;
  }

  async getTasksByAssignee(telegramId, status = null) {
    await this.initialize();
    
    // Загружаем из кэша
    const cachedTasks = await this.cache.getCachedTasksByAssignee(telegramId, status);
    
    if (cachedTasks.length > 0 || status) {
      console.log(`✅ Loaded ${cachedTasks.length} tasks from cache for assignee ${telegramId}`);
      return cachedTasks;
    }
    
    // Если кэш пустой и нет фильтра по статусу, загружаем из Notion
    console.log(`📥 Loading tasks from Notion for assignee ${telegramId}...`);
    const tasks = await notionService.getTasksByAssignee(telegramId, status);
    
    // Кэшируем задачи
    for (const task of tasks) {
      await this.cache.cacheTask({ ...task, synced: true });
    }
    
    return tasks;
  }

  async getTasksByCreator(creatorId, status = null) {
    await this.initialize();
    
    // Загружаем из кэша
    const cachedTasks = await this.cache.getCachedTasksByCreator(creatorId, status);
    
    if (cachedTasks.length > 0 || status) {
      console.log(`✅ Loaded ${cachedTasks.length} tasks from cache for creator ${creatorId}`);
      return cachedTasks;
    }
    
    // Загружаем из Notion если нет в кэше
    console.log(`📥 Loading tasks from Notion for creator ${creatorId}...`);
    const tasks = await notionService.getTasksByCreator(creatorId, status);
    
    // Кэшируем
    for (const task of tasks) {
      await this.cache.cacheTask({ ...task, synced: true });
    }
    
    return tasks;
  }

  async updateTaskStatus(taskId, status, comment = null) {
    await this.initialize();
    
    // Обновляем в кэше
    await this.cache.updateTaskStatus(taskId, status, comment);
    console.log(`✅ Task ${taskId} status updated in cache to: ${status}`);
    
    // Синхронизируем с Notion
    this.sync.addToQueue(async () => {
      try {
        await notionService.updateTaskStatus(taskId, status, comment);
        await this.cache.markTaskSynced(taskId);
        console.log(`✅ Task ${taskId} status synced to Notion`);
      } catch (error) {
        console.error(`Failed to sync task status ${taskId} to Notion:`, error);
      }
    });
    
    return true;
  }

  async completeTask(taskId) {
    return await this.updateTaskStatus(taskId, 'Выполнена');
  }

  async updateTask(taskId, updates) {
    await this.initialize();
    
    // Обновляем в кэше
    const updateQuery = `
      UPDATE tasks 
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          deadline = COALESCE(?, deadline),
          priority = COALESCE(?, priority),
          synced = 0,
          updated_at = datetime('now')
      WHERE id = ?
    `;
    
    await this.cache.runQuery(updateQuery, [
      updates.title || null,
      updates.description || null,
      updates.deadline || null,
      updates.priority || null,
      taskId
    ]);
    
    // Синхронизируем с Notion
    this.sync.addToQueue(async () => {
      await notionService.updateTask(taskId, updates);
      await this.cache.markTaskSynced(taskId);
    });
    
    return true;
  }

  // ========== ATTENDANCE METHODS ==========
  async getTodayAttendance(employeeId) {
    await this.initialize();
    
    // Проверяем кэш
    const cachedAttendance = await this.cache.getCachedTodayAttendance(employeeId);
    if (cachedAttendance) {
      console.log(`✅ Today's attendance loaded from cache for ${employeeId}`);
      return cachedAttendance;
    }
    
    // Загружаем из Notion
    console.log(`📥 Loading attendance from Notion for ${employeeId}...`);
    const attendance = await notionService.getTodayAttendance(employeeId);
    
    if (attendance) {
      await this.cache.cacheAttendance({
        ...attendance,
        employeeId,
        synced: true
      });
    }
    
    return attendance;
  }

  async createAttendance(attendanceData) {
    await this.initialize();
    
    // Сохраняем в кэш
    const attendanceId = await this.cache.cacheAttendance({
      ...attendanceData,
      synced: false
    });
    
    console.log(`✅ Attendance saved to cache: ${attendanceId}`);
    
    // Синхронизируем с Notion
    this.sync.addToQueue(async () => {
      try {
        const notionAttendance = await notionService.createAttendance(attendanceData);
        // Обновляем ID
        await this.cache.runQuery(
          `UPDATE attendance SET id = ?, synced = 1 WHERE id = ?`,
          [`notion-${notionAttendance.id}`, attendanceId]
        );
        console.log(`✅ Attendance synced to Notion`);
      } catch (error) {
        console.error('Failed to sync attendance to Notion:', error);
      }
    });
    
    return { id: attendanceId };
  }

  async updateAttendanceCheckOut(attendanceId, checkOut, location = null) {
    await this.initialize();
    
    // Определяем, это локальный ID или Notion ID
    let employeeId, date;
    
    if (attendanceId.startsWith('attendance-')) {
      // Локальный ID формата: attendance-{employeeId}-{date}
      const parts = attendanceId.split('-');
      employeeId = parts[1];
      date = parts.slice(2).join('-');
    } else if (attendanceId.startsWith('notion-')) {
      // Notion ID - нужно получить данные из кэша
      const attendance = await this.cache.getOne(
        `SELECT employee_id, date FROM attendance WHERE id = ?`,
        [attendanceId]
      );
      if (attendance) {
        employeeId = attendance.employee_id;
        date = attendance.date;
      }
    }
    
    // Обновляем в кэше
    const workHours = await this.cache.updateAttendanceCheckOut(employeeId, date, checkOut, location);
    console.log(`✅ Attendance checkout updated in cache, worked: ${workHours} hours`);
    
    // Синхронизируем с Notion
    this.sync.addToQueue(async () => {
      try {
        if (attendanceId.startsWith('notion-')) {
          const notionId = attendanceId.replace('notion-', '');
          await notionService.updateAttendanceCheckOut(notionId, checkOut, location);
          await this.cache.markAttendanceSynced(attendanceId);
          console.log('✅ Attendance checkout synced to Notion');
        }
      } catch (error) {
        console.error('Failed to sync attendance checkout to Notion:', error);
      }
    });
    
    return workHours;
  }

  // ========== UTILITY METHODS ==========
  async forceSync() {
    await this.initialize();
    await this.sync.forceSync();
  }

  async getStats() {
    await this.initialize();
    return await this.sync.getStats();
  }

  // Проксируем остальные методы к оригинальному сервису
  async getAllTasks(status = null) {
    return await notionService.getAllTasks(status);
  }

  async addPhotoToTask(taskId, photoUrl, caption = '') {
    return await notionService.addPhotoToTask(taskId, photoUrl, caption);
  }

  async getAttendanceForPeriod(startDate, endDate, employeeId = null) {
    return await notionService.getAttendanceForPeriod(startDate, endDate, employeeId);
  }

  async getCurrentAttendanceStatus() {
    return await notionService.getCurrentAttendanceStatus();
  }

  // Методы для отладки
  async debugGetAllTasks() {
    return await notionService.debugGetAllTasks();
  }

  async testTasksDatabase() {
    return await notionService.testTasksDatabase();
  }
}

// Singleton
let instance = null;

module.exports = {
  getInstance: async () => {
    if (!instance) {
      instance = new OptimizedNotionService();
      await instance.initialize();
    }
    return instance;
  },
  
  // Экспортируем как обычный объект для обратной совместимости
  ...(() => {
    const service = new OptimizedNotionService();
    
    // Создаем объект с методами, которые автоматически инициализируют сервис
    const methods = [
      'createUser', 'getUserByTelegramId', 'getAllActiveUsers', 'updateUser',
      'createReport', 'getTodayReport', 'getUserReports', 'getReportsForPeriod',
      'createTask', 'getTasksByAssignee', 'getTasksByCreator', 'updateTaskStatus',
      'completeTask', 'updateTask', 'getAllTasks', 'addPhotoToTask',
      'getTodayAttendance', 'createAttendance', 'updateAttendanceCheckOut',
      'getAttendanceForPeriod', 'getCurrentAttendanceStatus',
      'debugGetAllTasks', 'testTasksDatabase', 'forceSync', 'getStats'
    ];
    
    const exportObj = {};
    
    for (const method of methods) {
      exportObj[method] = async (...args) => {
        await service.initialize();
        return service[method](...args);
      };
    }
    
    // Добавляем алиасы для совместимости
    exportObj.getUsers = exportObj.getAllActiveUsers;
    exportObj.getUser = exportObj.getUserByTelegramId;
    
    return exportObj;
  })()
};