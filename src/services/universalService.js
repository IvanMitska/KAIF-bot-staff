const notionService = require('./notionService');
const { getInstance: getSQLiteInstance } = require('./sqliteService');

class UniversalService {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('🔄 Initializing Universal Service with SQLite...');
      this.db = await getSQLiteInstance();
      this.initialized = true;
      console.log('✅ SQLite database connected successfully!');
      
      const stats = await this.db.getStats();
      console.log('📊 Database stats:', stats);
    } catch (error) {
      console.error('❌ SQLite initialization failed:', error.message);
      this.initialized = true;
    }
  }

  // ========== USER METHODS ==========
  async createUser(userData) {
    await this.initialize();
    
    if (this.db) {
      await this.db.saveUser(userData);
      console.log(`✅ User saved to SQLite: ${userData.telegramId}`);
    }
    
    try {
      const notionUser = await notionService.createUser(userData);
      
      if (this.db && notionUser.id) {
        await this.db.saveUser({
          ...userData,
          id: notionUser.id
        });
      }
      
      return notionUser;
    } catch (error) {
      console.error('Notion user creation failed:', error);
      return { ...userData, id: `local-${userData.telegramId}` };
    }
  }

  async getUserByTelegramId(telegramId) {
    await this.initialize();
    
    if (this.db) {
      const cached = await this.db.getUser(telegramId);
      if (cached) {
        console.log(`✅ User loaded from SQLite: ${telegramId}`);
        return cached;
      }
    }
    
    try {
      console.log(`📥 Loading user from Notion: ${telegramId}`);
      const user = await notionService.getUserByTelegramId(telegramId);
      
      if (this.db && user) {
        await this.db.saveUser({
          ...user,
          telegramId
        });
      }
      
      return user;
    } catch (error) {
      console.error('Failed to load user from Notion:', error);
      return null;
    }
  }

  async getAllActiveUsers() {
    await this.initialize();
    
    if (this.db) {
      const cached = await this.db.getAllUsers();
      if (cached.length > 0) {
        console.log(`✅ Loaded ${cached.length} users from SQLite`);
        return cached;
      }
    }
    
    try {
      console.log(`📥 Loading users from Notion...`);
      const users = await notionService.getAllActiveUsers();
      
      if (this.db) {
        for (const user of users) {
          await this.db.saveUser(user);
        }
      }
      
      return users;
    } catch (error) {
      console.error('Failed to load users from Notion:', error);
      return [];
    }
  }

  // ========== REPORT METHODS ==========
  async createReport(reportData) {
    await this.initialize();
    
    const tempId = `report-${Date.now()}`;
    const reportWithId = { ...reportData, id: tempId };
    
    if (this.db) {
      await this.db.saveReport(reportWithId);
      console.log(`✅ Report saved to SQLite: ${tempId}`);
    }
    
    try {
      const notionReport = await notionService.createReport(reportData);
      
      if (this.db && notionReport.id) {
        await this.db.saveReport({
          ...reportData,
          id: notionReport.id
        });
      }
      
      return { id: notionReport.id, ...reportData };
    } catch (error) {
      console.error('Notion report creation failed:', error);
      return reportWithId;
    }
  }

  async getTodayReport(telegramId) {
    await this.initialize();
    
    if (this.db) {
      const cached = await this.db.getTodayReport(telegramId);
      if (cached) {
        console.log(`✅ Today report loaded from SQLite`);
        return cached;
      }
    }
    
    try {
      const report = await notionService.getTodayReport(telegramId);
      
      if (this.db && report) {
        await this.db.saveReport({
          ...report,
          telegramId
        });
      }
      
      return report;
    } catch (error) {
      console.error('Failed to load today report from Notion:', error);
      return null;
    }
  }

  async getUserReports(telegramId, limit = 5) {
    await this.initialize();
    
    if (this.db) {
      const cached = await this.db.getUserReports(telegramId, limit);
      if (cached.length > 0) {
        console.log(`✅ Loaded ${cached.length} reports from SQLite`);
        return cached;
      }
    }
    
    try {
      console.log(`📥 Loading reports from Notion for ${telegramId}...`);
      const reports = await notionService.getUserReports(telegramId, limit);
      
      if (this.db) {
        for (const report of reports) {
          await this.db.saveReport({
            ...report,
            telegramId
          });
        }
      }
      
      return reports;
    } catch (error) {
      console.error('Failed to load user reports from Notion:', error);
      return [];
    }
  }

  async getReportsForPeriod(startDate, endDate, employeeId = null) {
    await this.initialize();
    
    try {
      console.log(`📥 Loading reports from Notion for period ${startDate}-${endDate}...`);
      const reports = await notionService.getReportsForPeriod(startDate, endDate, employeeId);
      
      if (this.db && reports.length > 0) {
        for (const report of reports) {
          await this.db.saveReport(report);
        }
      }
      
      return reports;
    } catch (error) {
      console.error('Failed to load reports for period:', error);
      return [];
    }
  }

  // ========== ATTENDANCE METHODS ==========
  async createAttendance(attendanceData) {
    await this.initialize();
    
    const tempId = `attendance-${attendanceData.employeeId}-${attendanceData.date}`;
    const attendanceWithId = { ...attendanceData, id: tempId };
    
    if (this.db) {
      await this.db.saveAttendance(attendanceWithId);
      console.log(`✅ Attendance saved to SQLite: ${tempId}`);
    }
    
    try {
      const notionAttendance = await notionService.createAttendance(attendanceData);
      
      if (this.db && notionAttendance.id) {
        await this.db.saveAttendance({
          ...attendanceData,
          id: notionAttendance.id
        });
      }
      
      return { id: notionAttendance.id, ...attendanceData };
    } catch (error) {
      console.error('Notion attendance creation failed:', error);
      return attendanceWithId;
    }
  }

  async getTodayAttendance(employeeId) {
    await this.initialize();
    
    if (this.db) {
      const cached = await this.db.getTodayAttendance(employeeId);
      if (cached) {
        console.log(`✅ Today attendance loaded from SQLite`);
        return cached;
      }
    }
    
    try {
      console.log(`📥 Loading attendance from Notion for ${employeeId}...`);
      const attendance = await notionService.getTodayAttendance(employeeId);
      
      if (attendance && this.db) {
        await this.db.saveAttendance({
          ...attendance,
          employeeId,
          date: new Date().toISOString().split('T')[0]
        });
      }
      
      return attendance;
    } catch (error) {
      console.error('Failed to load attendance from Notion:', error);
      return null;
    }
  }

  async updateAttendanceCheckOut(attendanceId, checkOut, location = null) {
    await this.initialize();
    
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const workHours = await notionService.updateAttendanceCheckOut(attendanceId, checkOut, location);
      console.log(`✅ CheckOut updated for ${attendanceId}`);
      return workHours;
    } catch (error) {
      console.error('Failed to update checkout:', error);
      return null;
    }
  }

  async getCurrentAttendanceStatus() {
    try {
      return await notionService.getCurrentAttendanceStatus();
    } catch (error) {
      console.error('Failed to get attendance status:', error);
      return [];
    }
  }

  async getAttendanceForPeriod(startDate, endDate, employeeId = null) {
    try {
      const attendance = await notionService.getAttendanceForPeriod(startDate, endDate, employeeId);
      
      if (this.db && attendance.length > 0) {
        for (const record of attendance) {
          await this.db.saveAttendance(record);
        }
      }
      
      return attendance;
    } catch (error) {
      console.error('Failed to get attendance for period:', error);
      return [];
    }
  }

  // ========== TASK METHODS ==========
  async createTask(taskData) {
    await this.initialize();
    
    const tempId = `task-${Date.now()}`;
    const taskWithId = { ...taskData, id: tempId };
    
    if (this.db) {
      await this.db.saveTask(taskWithId);
      console.log(`✅ Task saved to SQLite: ${tempId}`);
    }
    
    try {
      const notionTask = await notionService.createTask(taskData);
      
      if (this.db && notionTask.id) {
        await this.db.saveTask({
          ...taskData,
          id: notionTask.id
        });
      }
      
      return { id: notionTask.id, ...taskData };
    } catch (error) {
      console.error('Notion task creation failed:', error);
      return taskWithId;
    }
  }

  async getTasksByAssignee(telegramId, status = null) {
    await this.initialize();
    
    if (this.db) {
      const cached = await this.db.getTasksByAssignee(telegramId, status);
      if (cached.length > 0) {
        console.log(`✅ Loaded ${cached.length} tasks from SQLite for ${telegramId}`);
        return cached;
      }
    }
    
    try {
      console.log(`📥 Loading tasks from Notion for ${telegramId}...`);
      const tasks = await notionService.getTasksByAssignee(telegramId, status);
      
      if (this.db) {
        for (const task of tasks) {
          await this.db.saveTask(task);
        }
      }
      
      return tasks;
    } catch (error) {
      console.error('Failed to load tasks from Notion:', error);
      return [];
    }
  }

  async getTasksByCreator(telegramId) {
    try {
      return await notionService.getTasksByCreator(telegramId);
    } catch (error) {
      console.error('Failed to get tasks by creator:', error);
      return [];
    }
  }

  async updateTaskStatus(taskId, status) {
    await this.initialize();
    
    if (this.db) {
      await this.db.updateTaskStatus(taskId, status);
      console.log(`✅ Task status updated in SQLite: ${taskId} -> ${status}`);
    }
    
    try {
      await notionService.updateTaskStatus(taskId, status);
      return { success: true };
    } catch (error) {
      console.error('Notion task status update failed:', error);
      return { success: true };
    }
  }

  async completeTask(taskId, completionNote) {
    await this.initialize();
    
    if (this.db) {
      await this.db.updateTaskStatus(taskId, 'Выполнена');
      console.log(`✅ Task completed in SQLite: ${taskId}`);
    }
    
    try {
      await notionService.completeTask(taskId, completionNote);
      return { success: true };
    } catch (error) {
      console.error('Notion task completion failed:', error);
      return { success: true };
    }
  }

  async updateTask(taskId, updates) {
    try {
      return await notionService.updateTask(taskId, updates);
    } catch (error) {
      console.error('Failed to update task:', error);
      return { success: false };
    }
  }

  async addPhotoToTask(taskId, photoUrl, caption = '') {
    try {
      return await notionService.addPhotoToTask(taskId, photoUrl, caption);
    } catch (error) {
      console.error('Failed to add photo to task:', error);
      return { success: false };
    }
  }

  async debugGetAllTasks() {
    try {
      return await notionService.debugGetAllTasks();
    } catch (error) {
      console.error('Debug get all tasks failed:', error);
      return [];
    }
  }

  async testTasksDatabase() {
    try {
      return await notionService.testTasksDatabase();
    } catch (error) {
      console.error('Test tasks database failed:', error);
      return false;
    }
  }

  async getAllTasks(statusFilter = null) {
    await this.initialize();
    
    if (this.db) {
      const cached = await this.db.getAllTasks(statusFilter);
      if (cached.length > 0) {
        console.log(`✅ Found ${cached.length} cached tasks with status: ${statusFilter || 'all'}`);
        return cached;
      }
    }
    
    try {
      console.log(`📥 Loading tasks from Notion with status: ${statusFilter || 'all'}...`);
      const tasks = await notionService.getAllTasks(statusFilter);
      
      if (this.db && tasks.length > 0) {
        for (const task of tasks) {
          await this.db.saveTask(task);
        }
      }
      
      return tasks;
    } catch (error) {
      console.error('Failed to load all tasks:', error);
      return [];
    }
  }

  // ========== ALIASES FOR COMPATIBILITY ==========
  async getUser(telegramId) {
    return await this.getUserByTelegramId(telegramId);
  }

  async getUsers() {
    return await this.getAllActiveUsers();
  }

  // ========== STATS ==========
  async getStats() {
    await this.initialize();
    
    if (this.db) {
      return await this.db.getStats();
    }
    
    return {
      users: 0,
      reports: 0,
      tasks: 0,
      attendance: 0
    };
  }

  async forceSync() {
    console.log('🔄 Force sync with Notion...');
    
    try {
      const users = await notionService.getAllActiveUsers();
      if (this.db) {
        for (const user of users) {
          await this.db.saveUser(user);
        }
      }
      console.log(`✅ Synced ${users.length} users`);
      
      return { message: 'Sync completed', users: users.length };
    } catch (error) {
      console.error('Force sync failed:', error);
      return { message: 'Sync failed', error: error.message };
    }
  }
}

const universalService = new UniversalService();

module.exports = universalService;