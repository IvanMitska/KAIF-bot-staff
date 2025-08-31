const { getInstance: getDBInstance } = require('./sqliteService');

class OptimizedSQLiteService {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('🔗 Initializing SQLite optimized service...');
      this.db = await getDBInstance();
      this.initialized = true;
      console.log('✅ SQLite optimized service ready');
    } catch (error) {
      console.error('❌ Failed to initialize SQLite:', error.message);
      throw error;
    }
  }

  // ========== USER METHODS ==========
  async createUser(userData) {
    await this.initialize();
    await this.db.saveUser(userData);
    console.log(`✅ User saved: ${userData.telegramId}`);
    return userData;
  }

  async getUserByTelegramId(telegramId) {
    await this.initialize();
    const user = await this.db.getUser(telegramId);
    
    if (user) {
      console.log(`✅ User loaded from SQLite: ${telegramId}`);
    } else {
      console.log(`❌ User not found: ${telegramId}`);
    }
    
    return user;
  }

  async getAllActiveUsers() {
    await this.initialize();
    const users = await this.db.getAllUsers();
    console.log(`✅ Loaded ${users.length} users from SQLite`);
    return users;
  }

  // Алиасы для совместимости
  async getUser(telegramId) {
    return await this.getUserByTelegramId(telegramId);
  }

  async getUsers() {
    return await this.getAllActiveUsers();
  }

  // ========== REPORT METHODS ==========
  async createReport(reportData) {
    await this.initialize();
    const reportId = await this.db.saveReport(reportData);
    console.log(`✅ Report saved to SQLite: ${reportId}`);
    return { id: reportId, ...reportData };
  }

  async getTodayReport(telegramId) {
    await this.initialize();
    const report = await this.db.getTodayReport(telegramId);
    
    if (report) {
      console.log(`✅ Today report loaded from SQLite`);
    }
    
    return report;
  }

  async getUserReports(telegramId, limit = 5) {
    await this.initialize();
    const reports = await this.db.getUserReports(telegramId, limit);
    console.log(`✅ Loaded ${reports.length} reports from SQLite`);
    return reports;
  }

  async getReportsForPeriod(startDate, endDate, employeeId = null) {
    await this.initialize();
    
    // Для простоты пока возвращаем пустой массив
    // TODO: Implement period-based report retrieval
    console.log(`📥 Period reports not yet implemented in SQLite`);
    return [];
  }

  // ========== ATTENDANCE METHODS ==========
  async createAttendance(attendanceData) {
    await this.initialize();
    const attendanceId = await this.db.saveAttendance(attendanceData);
    console.log(`✅ Attendance saved to SQLite: ${attendanceId}`);
    return { id: attendanceId, ...attendanceData };
  }

  async getTodayAttendance(employeeId) {
    await this.initialize();
    const attendance = await this.db.getTodayAttendance(employeeId);
    
    if (attendance) {
      console.log(`✅ Today attendance loaded from SQLite`);
    }
    
    return attendance;
  }

  async updateAttendanceCheckOut(attendanceId, checkOut, location = null) {
    await this.initialize();
    
    const today = new Date().toISOString().split('T')[0];
    let employeeId = attendanceId;
    
    if (typeof attendanceId === 'string' && attendanceId.includes('attendance-')) {
      const parts = attendanceId.split('-');
      if (parts.length >= 3) {
        employeeId = parts[1];
      }
    }
    
    // Получаем текущую запись
    const current = await this.db.getTodayAttendance(employeeId);
    if (!current || !current.checkIn) {
      return '0';
    }
    
    const checkInTime = new Date(current.checkIn);
    const checkOutTime = new Date(checkOut);
    const workHours = ((checkOutTime - checkInTime) / (1000 * 60 * 60)).toFixed(1);
    
    // Обновляем запись
    await this.db.saveAttendance({
      ...current,
      checkOut,
      workHours,
      status: 'Ушел',
      locationOut: location
    });
    
    console.log(`✅ CheckOut updated in SQLite for employee ${employeeId}`);
    return workHours;
  }

  async getCurrentAttendanceStatus() {
    // TODO: Implement
    return [];
  }

  async getAttendanceForPeriod(startDate, endDate, employeeId = null) {
    // TODO: Implement
    return [];
  }

  // ========== TASK METHODS ==========
  async createTask(taskData) {
    await this.initialize();
    const taskId = await this.db.saveTask(taskData);
    console.log(`✅ Task saved to SQLite: ${taskId}`);
    return { id: taskId, ...taskData };
  }

  async getTasksByAssignee(telegramId, status = null) {
    await this.initialize();
    const tasks = await this.db.getTasksByAssignee(telegramId, status);
    console.log(`✅ Loaded ${tasks.length} tasks from SQLite for ${telegramId}`);
    return tasks;
  }

  async getTasksByCreator(telegramId) {
    await this.initialize();
    // TODO: Implement creator-based task retrieval
    return [];
  }

  async updateTaskStatus(taskId, status) {
    await this.initialize();
    const result = await this.db.updateTaskStatus(taskId, status);
    console.log(`✅ Task status updated in SQLite: ${taskId} -> ${status}`);
    return result;
  }

  async completeTask(taskId, completionNote) {
    await this.initialize();
    const result = await this.db.updateTaskStatus(taskId, 'Выполнена');
    console.log(`✅ Task completed in SQLite: ${taskId}`);
    return result;
  }

  async updateTask(taskId, updates) {
    // TODO: Implement full task update
    return { success: false, message: 'Not implemented' };
  }

  async addPhotoToTask(taskId, photoUrl, caption = '') {
    // TODO: Implement photo attachment
    return { success: false, message: 'Not implemented' };
  }

  // Методы для отладки
  async debugGetAllTasks() {
    await this.initialize();
    const tasks = await this.db.getAllTasks();
    console.log(`✅ Debug: Found ${tasks.length} tasks in SQLite`);
    return tasks;
  }

  async testTasksDatabase() {
    await this.initialize();
    const stats = await this.db.getStats();
    console.log('✅ SQLite database test:', stats);
    return true;
  }

  async getAllTasks(statusFilter = null) {
    await this.initialize();
    const tasks = await this.db.getAllTasks(statusFilter);
    console.log(`✅ Found ${tasks.length} tasks with status: ${statusFilter || 'all'}`);
    return tasks;
  }

  // ========== STATS ==========
  async getStats() {
    await this.initialize();
    return await this.db.getStats();
  }

  async forceSync() {
    console.log('🔄 SQLite is local - no sync needed');
    return { message: 'SQLite is local database' };
  }
}

// Создаем singleton
const sqliteService = new OptimizedSQLiteService();

module.exports = sqliteService;