const notionService = require('./notionService');
const { getInstance: getCacheInstance } = require('./cacheServicePG');

class RailwayOptimizedService {
  constructor() {
    this.cache = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('🔗 Initializing Railway optimized service with PostgreSQL...');
      this.cache = await getCacheInstance();
      this.initialized = true;
      console.log('✅ Railway optimized service with PostgreSQL ready');
    } catch (error) {
      console.error('❌ Failed to initialize PostgreSQL cache:', error.message);
      console.log('⚠️ Falling back to direct Notion API calls');
      // Fallback на прямой Notion если PostgreSQL не доступен
    }
  }

  // ========== USER METHODS ==========
  async createUser(userData) {
    await this.initialize();
    
    if (this.cache) {
      // Сначала кэшируем
      await this.cache.cacheUser(userData);
      console.log(`✅ User cached: ${userData.telegramId}`);
    }
    
    // Затем создаем в Notion
    const notionUser = await notionService.createUser(userData);
    
    // Обновляем кэш с Notion ID
    if (this.cache && notionUser.id) {
      await this.cache.cacheUser({
        ...userData,
        id: notionUser.id,
        synced: true
      });
    }
    
    return notionUser;
  }

  async getUserByTelegramId(telegramId) {
    await this.initialize();
    
    if (this.cache) {
      // Проверяем кэш
      const cached = await this.cache.getCachedUser(telegramId);
      if (cached) {
        console.log(`✅ User loaded from PostgreSQL cache: ${telegramId}`);
        return cached;
      }
    }
    
    // Если нет в кэше, загружаем из Notion
    console.log(`📥 Loading user from Notion: ${telegramId}`);
    const user = await notionService.getUserByTelegramId(telegramId);
    
    // Кэшируем пользователя
    if (this.cache && user) {
      await this.cache.cacheUser({
        ...user,
        telegramId,
        synced: true
      });
    }
    
    return user;
  }

  async getAllActiveUsers() {
    await this.initialize();
    
    if (this.cache) {
      const cached = await this.cache.getAllCachedUsers();
      if (cached.length > 0) {
        console.log(`✅ Loaded ${cached.length} users from PostgreSQL cache`);
        return cached;
      }
    }
    
    // Загружаем из Notion
    console.log(`📥 Loading users from Notion...`);
    const users = await notionService.getAllActiveUsers();
    
    // Кэшируем всех пользователей
    if (this.cache) {
      for (const user of users) {
        await this.cache.cacheUser({
          ...user,
          synced: true
        });
      }
    }
    
    return users;
  }

  // ========== REPORT METHODS ==========
  async createReport(reportData) {
    await this.initialize();
    
    const tempId = `report-${Date.now()}`;
    const reportWithId = { ...reportData, id: tempId, synced: false };
    
    if (this.cache) {
      // Мгновенно сохраняем в кэш
      await this.cache.cacheReport(reportWithId);
      console.log(`✅ Report saved to PostgreSQL cache: ${tempId}`);
    }
    
    // Создаем в Notion в фоне
    try {
      const notionReport = await notionService.createReport(reportData);
      
      if (this.cache && notionReport.id) {
        // Обновляем кэш с реальным ID
        await this.cache.cacheReport({
          ...reportData,
          id: notionReport.id,
          synced: true
        });
        // Удаляем временную запись если нужно
        await this.cache.markReportSynced(tempId);
      }
      
      return { id: notionReport.id, ...reportData };
    } catch (error) {
      console.error('Notion report creation failed, keeping in cache:', error);
      return reportWithId;
    }
  }

  async getTodayReport(telegramId) {
    await this.initialize();
    
    if (this.cache) {
      const cached = await this.cache.getCachedTodayReport(telegramId);
      if (cached) {
        console.log(`✅ Today report loaded from PostgreSQL cache`);
        return cached;
      }
    }
    
    // Загружаем из Notion
    const report = await notionService.getTodayReport(telegramId);
    
    // Кэшируем отчет
    if (this.cache && report) {
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
    
    if (this.cache) {
      const cached = await this.cache.getCachedUserReports(telegramId, limit);
      if (cached.length > 0) {
        console.log(`✅ Loaded ${cached.length} reports from PostgreSQL cache`);
        return cached;
      }
    }
    
    // Загружаем из Notion
    console.log(`📥 Loading reports from Notion for ${telegramId}...`);
    const reports = await notionService.getUserReports(telegramId, limit);
    
    // Кэшируем отчеты
    if (this.cache) {
      for (const report of reports) {
        await this.cache.cacheReport({
          ...report,
          telegramId,
          synced: true
        });
      }
    }
    
    return reports;
  }

  async getReportsForPeriod(startDate, endDate, employeeId = null) {
    // Для периодических отчетов используем прямой Notion 
    // (редкая операция, не критично для скорости)
    return await notionService.getReportsForPeriod(startDate, endDate, employeeId);
  }

  // Метод уже реализован в базовом классе, но добавляем для ясности
  // async getAllActiveUsers() - уже есть выше

  // ========== ATTENDANCE METHODS ==========
  async createAttendance(attendanceData) {
    await this.initialize();
    
    const tempId = `attendance-${attendanceData.employeeId}-${attendanceData.date}`;
    const attendanceWithId = { ...attendanceData, id: tempId, synced: false };
    
    if (this.cache) {
      // Мгновенно сохраняем в кэш
      await this.cache.cacheAttendance(attendanceWithId);
      console.log(`✅ Attendance saved to PostgreSQL cache: ${tempId}`);
    }
    
    // Создаем в Notion в фоне
    try {
      const notionAttendance = await notionService.createAttendance(attendanceData);
      
      if (this.cache && notionAttendance.id) {
        await this.cache.cacheAttendance({
          ...attendanceData,
          id: notionAttendance.id,
          synced: true
        });
      }
      
      return { id: notionAttendance.id, ...attendanceData };
    } catch (error) {
      console.error('Notion attendance creation failed, keeping in cache:', error);
      return attendanceWithId;
    }
  }

  async getTodayAttendance(employeeId) {
    await this.initialize();
    
    if (this.cache) {
      const cached = await this.cache.getCachedTodayAttendance(employeeId);
      if (cached) {
        console.log(`✅ Today attendance loaded from PostgreSQL cache`);
        return cached;
      }
      
      // Если нет в кэше, загружаем из Notion и кэшируем
      try {
        console.log(`📥 Loading attendance from Notion for ${employeeId}...`);
        const attendance = await notionService.getTodayAttendance(employeeId);
        
        if (attendance) {
          // Кэшируем найденную запись
          await this.cache.cacheAttendance({
            ...attendance,
            employeeId,
            date: new Date().toISOString().split('T')[0],
            synced: true
          });
          console.log(`✅ Attendance cached from Notion`);
        }
        
        return attendance;
      } catch (error) {
        console.error('Failed to load attendance from Notion:', error);
        return null;
      }
    }
    
    // Fallback на прямой Notion если нет кэша
    return await notionService.getTodayAttendance(employeeId);
  }

  async updateAttendanceCheckOut(attendanceId, checkOut, location = null) {
    await this.initialize();
    
    const today = new Date().toISOString().split('T')[0];
    
    if (this.cache) {
      // Извлекаем employeeId из attendanceId, если это наш временный ID
      let employeeId = attendanceId;
      if (typeof attendanceId === 'string' && attendanceId.includes('attendance-')) {
        // Формат: attendance-{employeeId}-{date}
        const parts = attendanceId.split('-');
        if (parts.length >= 3) {
          employeeId = parts[1];
        }
      }
      
      // Мгновенно обновляем в кэш
      const workHours = await this.cache.updateAttendanceCheckOut(
        employeeId, today, checkOut, location
      );
      console.log(`✅ CheckOut updated in PostgreSQL cache for employee ${employeeId}`);
      
      // Обновляем в Notion в фоне
      try {
        await notionService.updateAttendanceCheckOut(attendanceId, checkOut, location);
      } catch (error) {
        console.error('Notion checkout update failed, keeping in cache:', error);
      }
      
      return workHours;
    }
    
    // Прямое обновление в Notion
    return await notionService.updateAttendanceCheckOut(attendanceId, checkOut, location);
  }

  // Для совместимости с существующим API
  async getCurrentAttendanceStatus() {
    return await notionService.getCurrentAttendanceStatus();
  }

  async getAttendanceForPeriod(startDate, endDate, employeeId = null) {
    return await notionService.getAttendanceForPeriod(startDate, endDate, employeeId);
  }

  // ========== TASK METHODS ==========
  async createTask(taskData) {
    await this.initialize();
    
    const tempId = `task-${Date.now()}`;
    const taskWithId = { ...taskData, id: tempId, synced: false };
    
    if (this.cache) {
      // Мгновенно сохраняем в кэш
      await this.cache.cacheTask(taskWithId);
      console.log(`✅ Task saved to PostgreSQL cache: ${tempId}`);
    }
    
    // Создаем в Notion в фоне
    try {
      const notionTask = await notionService.createTask(taskData);
      
      if (this.cache && notionTask.id) {
        await this.cache.cacheTask({
          ...taskData,
          id: notionTask.id,
          synced: true
        });
      }
      
      return { id: notionTask.id, ...taskData };
    } catch (error) {
      console.error('Notion task creation failed, keeping in cache:', error);
      return taskWithId;
    }
  }

  async getTasksByAssignee(telegramId, status = null) {
    await this.initialize();
    
    if (this.cache) {
      const cached = await this.cache.getCachedTasksByAssignee(telegramId, status);
      if (cached.length > 0) {
        console.log(`✅ Loaded ${cached.length} tasks from PostgreSQL cache for ${telegramId}`);
        return cached;
      }
      
      // Если нет в кэше, загружаем из Notion и кэшируем
      try {
        console.log(`📥 Loading tasks from Notion for ${telegramId}...`);
        const tasks = await notionService.getTasksByAssignee(telegramId, status);
        
        // Кэшируем все задачи
        for (const task of tasks) {
          await this.cache.cacheTask({
            ...task,
            synced: true
          });
        }
        
        if (tasks.length > 0) {
          console.log(`✅ Cached ${tasks.length} tasks from Notion`);
        }
        
        return tasks;
      } catch (error) {
        console.error('Failed to load tasks from Notion:', error);
        return [];
      }
    }
    
    // Fallback на прямой Notion
    return await notionService.getTasksByAssignee(telegramId, status);
  }

  async getTasksByCreator(telegramId) {
    await this.initialize();
    
    // Для созданных задач пока используем прямой Notion 
    // (менее критично по скорости)
    return await notionService.getTasksByCreator(telegramId);
  }

  async updateTaskStatus(taskId, status) {
    await this.initialize();
    
    if (this.cache) {
      // Мгновенно обновляем в кэш
      await this.cache.updateTaskStatus(taskId, status);
      console.log(`✅ Task status updated in PostgreSQL cache: ${taskId} -> ${status}`);
      
      // Обновляем в Notion в фоне
      try {
        await notionService.updateTaskStatus(taskId, status);
      } catch (error) {
        console.error('Notion task status update failed, keeping in cache:', error);
      }
      
      return { success: true };
    }
    
    // Прямое обновление в Notion
    return await notionService.updateTaskStatus(taskId, status);
  }

  async completeTask(taskId, completionNote) {
    await this.initialize();
    
    if (this.cache) {
      // Мгновенно помечаем как выполненную в кэше
      await this.cache.updateTaskStatus(taskId, 'Выполнена');
      console.log(`✅ Task completed in PostgreSQL cache: ${taskId}`);
      
      // Обновляем в Notion в фоне
      try {
        await notionService.completeTask(taskId, completionNote);
      } catch (error) {
        console.error('Notion task completion failed, keeping in cache:', error);
      }
      
      return { success: true };
    }
    
    return await notionService.completeTask(taskId, completionNote);
  }

  async updateTask(taskId, updates) {
    // Пока прокси к Notion (редкая операция)
    return await notionService.updateTask(taskId, updates);
  }

  async getAllTasks() {
    // Пока прокси к Notion (админская операция)
    return await notionService.getAllTasks();
  }

  async addPhotoToTask(taskId, photoUrl, caption = '') {
    return await notionService.addPhotoToTask(taskId, photoUrl, caption);
  }

  // Методы для отладки
  async debugGetAllTasks() {
    return await notionService.debugGetAllTasks();
  }

  async testTasksDatabase() {
    return await notionService.testTasksDatabase();
  }

  // ========== STATS ==========
  async getStats() {
    await this.initialize();
    
    if (this.cache) {
      return await this.cache.getCacheStats();
    }
    
    return {
      users: 0,
      reports: 0,
      tasks: 0,
      attendance: 0,
      sizeBytes: 0,
      sizeMB: '0.00'
    };
  }

  // Метод для принудительной синхронизации
  async forceSync() {
    console.log('🔄 Force sync not implemented for Railway service');
    return { message: 'Force sync not available' };
  }
}

// Создаем singleton
const railwayService = new RailwayOptimizedService();

module.exports = railwayService;