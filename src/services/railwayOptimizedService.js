const notionService = require('./notionService');
const { getInstance: getCacheInstance } = require('./cacheServicePG');

class RailwayOptimizedService {
  constructor() {
    this.cache = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    console.log('🔍 Initializing Railway Service...');
    console.log('Environment check:', {
      HAS_DATABASE_URL: !!process.env.DATABASE_URL,
      NODE_ENV: process.env.NODE_ENV,
      RAILWAY_ENV: process.env.RAILWAY_ENVIRONMENT
    });
    
    try {
      // Проверяем наличие DATABASE_URL для Railway
      if (process.env.DATABASE_URL) {
        console.log('🔗 Connecting to Railway PostgreSQL...');
        console.log('📍 Database URL found:', process.env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'unknown');
        
        this.cache = await getCacheInstance();
        this.initialized = true;
        console.log('✅ Railway PostgreSQL connected successfully!');
        
        // Показываем статистику при подключении
        try {
          const stats = await this.cache.getCacheStats();
          console.log('📊 Database stats:', stats);
        } catch (statsError) {
          console.warn('⚠️ Could not get cache stats:', statsError.message);
        }
      } else {
        // Нет DATABASE_URL - используем прямые Notion вызовы
        console.log('⚠️ DATABASE_URL not configured');
        console.log('📝 To enable PostgreSQL caching on Railway:');
        console.log('   1. Go to telegram-report-bot service in Railway');
        console.log('   2. Click Variables tab');
        console.log('   3. Add Variable Reference -> Select Postgres -> DATABASE_URL');
        console.log('⚠️ Using direct Notion API calls (slower but working)');
        this.cache = null;
        this.initialized = true;
      }
    } catch (error) {
      console.error('❌ PostgreSQL connection failed:', error.message);
      console.error('Error details:', error);
      console.log('⚠️ Falling back to direct Notion API calls');
      this.cache = null;
      this.initialized = true;
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
    await this.initialize();
    
    if (this.cache) {
      // Для диапазона дат пытаемся найти кэшированные отчеты
      try {
        console.log(`🔍 Looking for cached reports ${startDate} to ${endDate}...`);
        
        // Строим SQL запрос для получения отчетов за период
        let query = 'SELECT * FROM reports WHERE date >= $1 AND date <= $2';
        let params = [startDate, endDate];
        
        if (employeeId) {
          query += ' AND telegram_id = $3';
          params.push(employeeId.toString());
        }
        
        query += ' ORDER BY date DESC';
        
        const result = await this.cache.runQuery(query, params);
        
        if (result.rows && result.rows.length > 0) {
          console.log(`✅ Found ${result.rows.length} cached reports for period`);
          return result.rows.map(row => ({
            id: row.id,
            employeeName: row.employee_name,
            telegramId: row.telegram_id,
            date: row.date,
            whatDone: row.what_done,
            problems: row.problems,
            goals: row.goals,
            status: row.status,
            timestamp: row.timestamp
          }));
        }
      } catch (error) {
        console.error('Cache query failed:', error);
      }
    }
    
    // Если нет в кэше, загружаем из Notion
    console.log(`📥 Loading reports from Notion for period ${startDate}-${endDate}...`);
    const reports = await notionService.getReportsForPeriod(startDate, endDate, employeeId);
    
    // Кэшируем найденные отчеты
    if (this.cache && reports.length > 0) {
      for (const report of reports) {
        await this.cache.cacheReport({
          ...report,
          synced: true
        });
      }
      console.log(`✅ Cached ${reports.length} reports from period query`);
    }
    
    return reports;
  }

  // Добавляем недостающие методы для совместимости
  async getUser(telegramId) {
    return await this.getUserByTelegramId(telegramId);
  }

  async getUsers() {
    return await this.getAllActiveUsers();
  }

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
    await this.initialize();
    
    if (this.cache) {
      try {
        console.log(`🔍 Looking for cached attendance ${startDate} to ${endDate}...`);
        
        let query = 'SELECT * FROM attendance WHERE date >= $1 AND date <= $2';
        let params = [startDate, endDate];
        
        if (employeeId) {
          query += ' AND employee_id = $3';
          params.push(employeeId.toString());
        }
        
        query += ' ORDER BY date DESC';
        
        const result = await this.cache.runQuery(query, params);
        
        if (result.rows && result.rows.length > 0) {
          console.log(`✅ Found ${result.rows.length} cached attendance records`);
          return result.rows.map(row => ({
            id: row.id,
            employeeName: row.employee_name,
            employeeId: row.employee_id,
            date: row.date,
            checkIn: row.check_in,
            checkOut: row.check_out,
            workHours: row.work_hours,
            status: row.status,
            isPresent: !row.check_out && !!row.check_in
          }));
        }
      } catch (error) {
        console.error('Attendance cache query failed:', error);
      }
    }
    
    // Загружаем из Notion
    const attendance = await notionService.getAttendanceForPeriod(startDate, endDate, employeeId);
    
    // Кэшируем записи
    if (this.cache && attendance.length > 0) {
      for (const record of attendance) {
        await this.cache.cacheAttendance({
          ...record,
          synced: true
        });
      }
      console.log(`✅ Cached ${attendance.length} attendance records`);
    }
    
    return attendance;
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
    
    console.log(`🔍 Getting tasks for assignee: ${telegramId}, status: ${status || 'all'}`);
    
    // Если кэш недоступен, сразу используем Notion
    if (!this.cache) {
      console.log('⚠️ Cache not available, using direct Notion API');
      try {
        const tasks = await notionService.getTasksByAssignee(telegramId, status);
        console.log(`📝 Notion returned ${tasks.length} tasks`);
        return tasks || [];
      } catch (notionError) {
        console.error('❌ Notion API error:', notionError.message);
        return [];
      }
    }
    
    // Пробуем использовать кэш
    try {
      const cached = await this.cache.getCachedTasksByAssignee(telegramId, status);
      console.log(`📊 Found ${cached.length} tasks in PostgreSQL cache for ${telegramId}`);
      
      if (cached.length > 0) {
        console.log(`✅ Returning ${cached.length} cached tasks`);
        return cached;
      }
      
      // Если нет в кэше, загружаем из Notion и кэшируем
      console.log(`📥 No cached tasks found, loading from Notion for ${telegramId}...`);
      const tasks = await notionService.getTasksByAssignee(telegramId, status);
      console.log(`📝 Notion returned ${tasks.length} tasks`);
      
      // Пробуем кэшировать (но не падаем если не получится)
      if (tasks.length > 0) {
        try {
          for (const task of tasks) {
            await this.cache.cacheTask({
              ...task,
              assigneeId: telegramId,
              synced: true
            });
          }
          console.log(`✅ Cached ${tasks.length} tasks from Notion`);
        } catch (cacheError) {
          console.warn('⚠️ Could not cache tasks:', cacheError.message);
        }
      }
      
      return tasks || [];
    } catch (error) {
      console.error('❌ Cache error:', error.message);
      
      // При ошибке кэша всегда пытаемся загрузить из Notion
      console.log('⚠️ Falling back to direct Notion API...');
      try {
        const tasks = await notionService.getTasksByAssignee(telegramId, status);
        console.log(`📝 Notion fallback returned ${tasks?.length || 0} tasks`);
        return tasks || [];
      } catch (notionError) {
        console.error('❌ Notion fallback also failed:', notionError.message);
        return [];
      }
    }
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


  async addPhotoToTask(taskId, photoUrl, caption = '') {
    return await notionService.addPhotoToTask(taskId, photoUrl, caption);
  }

  // Методы для отладки
  async debugGetAllTasks() {
    await this.initialize();
    
    console.log('🔍 Debug: Getting all tasks...');
    
    if (this.cache) {
      try {
        // Получаем все задачи из кэша
        const query = 'SELECT * FROM tasks ORDER BY created_date DESC LIMIT 10';
        const result = await this.cache.pool.query(query);
        
        console.log(`📊 Total tasks in cache: ${result.rows.length}`);
        
        if (result.rows.length > 0) {
          console.log('📝 Sample tasks from cache:');
          result.rows.slice(0, 3).forEach(task => {
            console.log(`  - ${task.title} (${task.status}) - Assignee: ${task.assignee_id}`);
          });
          
          return result.rows.map(task => ({
            id: task.id,
            title: task.title,
            status: task.status,
            assigneeId: task.assignee_id,
            assigneeName: task.assignee_name,
            creatorId: task.creator_id
          }));
        }
      } catch (error) {
        console.error('❌ Cache debug failed:', error.message);
      }
    }
    
    // Fallback to Notion
    return await notionService.debugGetAllTasks();
  }

  async testTasksDatabase() {
    await this.initialize();
    
    console.log('🧪 Testing tasks database...');
    
    if (this.cache) {
      try {
        // Test database connection
        const testQuery = await this.cache.pool.query('SELECT COUNT(*) as count FROM tasks');
        console.log(`✅ Database connected. Total tasks: ${testQuery.rows[0].count}`);
        
        // Get unique assignees
        const assigneesQuery = await this.cache.pool.query(
          'SELECT DISTINCT assignee_id, assignee_name FROM tasks WHERE assignee_id IS NOT NULL'
        );
        console.log(`👥 Unique assignees: ${assigneesQuery.rows.length}`);
        assigneesQuery.rows.slice(0, 3).forEach(a => {
          console.log(`  - ${a.assignee_name} (${a.assignee_id})`);
        });
        
        return true;
      } catch (error) {
        console.error('❌ Database test failed:', error.message);
        return false;
      }
    }
    
    return await notionService.testTasksDatabase();
  }

  // ========== ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ ==========
  async getAllTasks(statusFilter = null) {
    await this.initialize();
    
    if (this.cache) {
      try {
        let query = 'SELECT * FROM tasks';
        let params = [];
        
        if (statusFilter) {
          query += ' WHERE status = $1';
          params.push(statusFilter);
        }
        
        query += ' ORDER BY created_date DESC';
        
        const result = await this.cache.runQuery(query, params);
        
        if (result.rows && result.rows.length > 0) {
          console.log(`✅ Found ${result.rows.length} cached tasks with status: ${statusFilter || 'all'}`);
          return result.rows.map(row => ({
            id: row.id,
            taskId: row.task_id,
            title: row.title,
            description: row.description,
            assigneeId: row.assignee_id,
            assigneeName: row.assignee_name,
            creatorId: row.creator_id,
            creatorName: row.creator_name,
            status: row.status,
            priority: row.priority,
            createdDate: row.created_date,
            deadline: row.deadline,
            completedDate: row.completed_date
          }));
        }
      } catch (error) {
        console.error('Failed to load tasks from cache:', error);
      }
    }
    
    // Fallback на Notion
    console.log(`📥 Loading tasks from Notion with status: ${statusFilter || 'all'}...`);
    const tasks = await notionService.getAllTasks(statusFilter);
    
    // Кэшируем задачи
    if (this.cache && tasks.length > 0) {
      for (const task of tasks) {
        await this.cache.cacheTask({
          ...task,
          synced: true
        });
      }
      console.log(`✅ Cached ${tasks.length} tasks`);
    }
    
    return tasks;
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

  // ========== МЕТОДЫ ДЛЯ АДМИН-ПАНЕЛИ ==========
  
  async getAllActiveUsers() {
    await this.initialize();
    
    if (this.cache) {
      try {
        const users = await this.cache.getAllUsers();
        return users.filter(u => u.isActive !== false);
      } catch (error) {
        console.error('Cache error, falling back to Notion:', error);
      }
    }
    
    // Fallback к Notion
    return await notionService.getAllActiveUsers();
  }

  async getReportsForPeriod(startDate, endDate, employeeId = null) {
    await this.initialize();
    
    if (this.cache) {
      try {
        let query = 'SELECT * FROM reports WHERE date >= $1 AND date <= $2';
        let params = [startDate, endDate];
        
        if (employeeId) {
          query += ' AND telegram_id = $3';
          params.push(employeeId);
        }
        
        query += ' ORDER BY date DESC, timestamp DESC';
        
        const result = await this.cache.pool.query(query, params);
        return result.rows.map(row => ({
          id: row.id,
          date: row.date,
          employeeName: row.employee_name,
          telegramId: row.telegram_id,
          whatDone: row.what_done,
          problems: row.problems,
          goals: row.goals,
          timestamp: row.timestamp,
          status: row.status
        }));
      } catch (error) {
        console.error('Cache error, falling back to Notion:', error);
      }
    }
    
    // Fallback к Notion
    return await notionService.getReportsForPeriod(startDate, endDate, employeeId);
  }

  async getAttendanceForPeriod(startDate, endDate, employeeId = null) {
    await this.initialize();
    
    if (this.cache) {
      try {
        let query = 'SELECT * FROM attendance WHERE date >= $1 AND date <= $2';
        let params = [startDate, endDate];
        
        if (employeeId) {
          query += ' AND employee_id = $3';
          params.push(employeeId);
        }
        
        query += ' ORDER BY date DESC, check_in DESC';
        
        const result = await this.cache.pool.query(query, params);
        return result.rows.map(row => ({
          id: row.id,
          employeeId: row.employee_id,
          employeeName: row.employee_name,
          date: row.date,
          checkIn: row.check_in,
          checkOut: row.check_out,
          workHours: row.work_hours,
          location: row.location,
          status: row.status
        }));
      } catch (error) {
        console.error('Cache error, falling back to Notion:', error);
      }
    }
    
    // Fallback к Notion
    return await notionService.getAttendanceForPeriod(startDate, endDate, employeeId);
  }

  async getCurrentAttendanceStatus() {
    await this.initialize();
    
    const today = new Date().toISOString().split('T')[0];
    
    if (this.cache) {
      try {
        const query = `
          SELECT * FROM attendance 
          WHERE date = $1 
          ORDER BY check_in DESC
        `;
        
        const result = await this.cache.pool.query(query, [today]);
        return result.rows.map(row => ({
          id: row.id,
          employeeId: row.employee_id,
          employeeName: row.employee_name,
          checkIn: row.check_in,
          checkOut: row.check_out,
          workHours: row.work_hours,
          isPresent: !row.check_out,
          status: row.status
        }));
      } catch (error) {
        console.error('Cache error, falling back to Notion:', error);
      }
    }
    
    // Fallback к Notion
    return await notionService.getCurrentAttendanceStatus();
  }

  async updateAttendanceCheckOut(attendanceId, checkOut, location = null) {
    await this.initialize();
    
    if (this.cache) {
      try {
        // Получаем запись
        const getQuery = 'SELECT * FROM attendance WHERE id = $1';
        const getResult = await this.cache.pool.query(getQuery, [attendanceId]);
        
        if (getResult.rows.length === 0) {
          throw new Error('Attendance record not found');
        }
        
        const attendance = getResult.rows[0];
        const checkInTime = new Date(attendance.check_in);
        const checkOutTime = new Date(checkOut);
        
        // Вычисляем рабочие часы
        const workHours = ((checkOutTime - checkInTime) / (1000 * 60 * 60)).toFixed(2);
        
        // Обновляем запись
        const updateQuery = `
          UPDATE attendance 
          SET check_out = $1, work_hours = $2, status = $3
          WHERE id = $4
          RETURNING *
        `;
        
        await this.cache.pool.query(updateQuery, [
          checkOut,
          workHours,
          'Завершен',
          attendanceId
        ]);
        
        // Обновляем в Notion в фоне
        notionService.updateAttendanceCheckOut(attendanceId, checkOut, location).catch(error => {
          console.error('Notion update failed:', error);
        });
        
        return workHours;
      } catch (error) {
        console.error('Cache error, falling back to Notion:', error);
      }
    }
    
    // Fallback к Notion
    return await notionService.updateAttendanceCheckOut(attendanceId, checkOut, location);
  }
}

// Создаем singleton
const railwayService = new RailwayOptimizedService();

module.exports = railwayService;