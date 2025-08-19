const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class CacheService {
  constructor() {
    this.dbPath = path.join(process.cwd(), 'cache.db');
    this.db = null;
    this.syncInterval = null;
    this.lastSync = {};
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, async (err) => {
        if (err) {
          console.error('Error opening cache database:', err);
          reject(err);
        } else {
          console.log('✅ Cache database connected');
          await this.createTables();
          resolve();
        }
      });
    });
  }

  async createTables() {
    const queries = [
      // Таблица пользователей
      `CREATE TABLE IF NOT EXISTS users (
        telegram_id TEXT PRIMARY KEY,
        notion_id TEXT,
        name TEXT,
        username TEXT,
        position TEXT,
        is_active INTEGER DEFAULT 1,
        registration_date TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Таблица отчетов
      `CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        telegram_id TEXT,
        employee_name TEXT,
        date TEXT,
        what_done TEXT,
        problems TEXT,
        goals TEXT,
        timestamp TEXT,
        status TEXT,
        synced INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
      )`,
      
      // Таблица задач
      `CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        task_id TEXT,
        title TEXT,
        description TEXT,
        assignee_id TEXT,
        assignee_name TEXT,
        creator_id TEXT,
        creator_name TEXT,
        status TEXT,
        priority TEXT,
        created_date TEXT,
        deadline TEXT,
        completed_date TEXT,
        synced INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Таблица учета времени
      `CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        employee_id TEXT,
        employee_name TEXT,
        date TEXT,
        check_in TEXT,
        check_out TEXT,
        work_hours REAL,
        status TEXT,
        location_in TEXT,
        location_out TEXT,
        synced INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(employee_id, date)
      )`,
      
      // Таблица для отслеживания синхронизации
      `CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT,
        last_sync DATETIME,
        records_synced INTEGER,
        status TEXT,
        error TEXT
      )`,

      // Индексы для быстрого поиска
      `CREATE INDEX IF NOT EXISTS idx_reports_telegram_id ON reports(telegram_id)`,
      `CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_creator ON tasks(creator_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`,
      `CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id)`,
      `CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)`
    ];

    for (const query of queries) {
      await this.runQuery(query);
    }
    console.log('✅ Cache tables created');
  }

  runQuery(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  getAll(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  getOne(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  // ========== USERS ==========
  async cacheUser(userData) {
    const query = `
      INSERT OR REPLACE INTO users 
      (telegram_id, notion_id, name, username, position, is_active, registration_date, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `;
    await this.runQuery(query, [
      userData.telegramId,
      userData.id,
      userData.name,
      userData.username || '',
      userData.position,
      userData.isActive ? 1 : 0,
      userData.registrationDate || new Date().toISOString()
    ]);
  }

  async getCachedUser(telegramId) {
    const query = `SELECT * FROM users WHERE telegram_id = ?`;
    const user = await this.getOne(query, [telegramId.toString()]);
    
    if (user) {
      return {
        id: user.notion_id,
        telegramId: user.telegram_id,
        name: user.name,
        username: user.username,
        position: user.position,
        isActive: user.is_active === 1,
        registrationDate: user.registration_date
      };
    }
    return null;
  }

  async getAllCachedUsers() {
    const query = `SELECT * FROM users WHERE is_active = 1`;
    const users = await this.getAll(query);
    
    return users.map(user => ({
      id: user.notion_id,
      telegramId: parseInt(user.telegram_id),
      name: user.name,
      position: user.position
    }));
  }

  // ========== REPORTS ==========
  async cacheReport(reportData) {
    const reportId = reportData.id || `report-${Date.now()}`;
    const query = `
      INSERT OR REPLACE INTO reports 
      (id, telegram_id, employee_name, date, what_done, problems, goals, timestamp, status, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.runQuery(query, [
      reportId,
      reportData.telegramId,
      reportData.employeeName,
      reportData.date,
      reportData.whatDone,
      reportData.problems || '',
      reportData.goals || '',
      reportData.timestamp || new Date().toISOString(),
      reportData.status || 'Отправлен',
      reportData.synced ? 1 : 0
    ]);
    return reportId;
  }

  async getCachedTodayReport(telegramId) {
    const today = new Date().toISOString().split('T')[0];
    const query = `SELECT * FROM reports WHERE telegram_id = ? AND date = ?`;
    return await this.getOne(query, [telegramId.toString(), today]);
  }

  async getCachedUserReports(telegramId, limit = 5) {
    const query = `
      SELECT * FROM reports 
      WHERE telegram_id = ? 
      ORDER BY date DESC, timestamp DESC 
      LIMIT ?
    `;
    const reports = await this.getAll(query, [telegramId.toString(), limit]);
    
    return reports.map(report => ({
      id: report.id,
      date: report.date,
      whatDone: report.what_done,
      problems: report.problems,
      goals: report.goals,
      status: report.status
    }));
  }

  async getUnsyncedReports() {
    const query = `SELECT * FROM reports WHERE synced = 0`;
    return await this.getAll(query);
  }

  async markReportSynced(reportId) {
    const query = `UPDATE reports SET synced = 1 WHERE id = ?`;
    await this.runQuery(query, [reportId]);
  }

  // ========== TASKS ==========
  async cacheTask(taskData) {
    const query = `
      INSERT OR REPLACE INTO tasks 
      (id, task_id, title, description, assignee_id, assignee_name, 
       creator_id, creator_name, status, priority, created_date, deadline, 
       completed_date, synced, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `;
    await this.runQuery(query, [
      taskData.id,
      taskData.taskId || `TASK-${Date.now()}`,
      taskData.title,
      taskData.description || '',
      taskData.assigneeId,
      taskData.assigneeName,
      taskData.creatorId,
      taskData.creatorName,
      taskData.status || 'Новая',
      taskData.priority || 'Средний',
      taskData.createdDate || new Date().toISOString(),
      taskData.deadline,
      taskData.completedDate,
      taskData.synced ? 1 : 0
    ]);
  }

  async getCachedTasksByAssignee(telegramId, status = null) {
    let query = `SELECT * FROM tasks WHERE assignee_id = ?`;
    const params = [telegramId.toString()];
    
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    
    query += ` ORDER BY priority ASC, created_date DESC`;
    const tasks = await this.getAll(query, params);
    
    return tasks.map(task => ({
      id: task.id,
      taskId: task.task_id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      createdDate: task.created_date,
      deadline: task.deadline,
      creatorName: task.creator_name,
      creatorId: task.creator_id,
      assigneeId: task.assignee_id,
      assigneeName: task.assignee_name
    }));
  }

  async getCachedTasksByCreator(creatorId, status = null) {
    let query = `SELECT * FROM tasks WHERE creator_id = ?`;
    const params = [creatorId.toString()];
    
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    
    query += ` ORDER BY created_date DESC`;
    const tasks = await this.getAll(query, params);
    
    return tasks.map(task => ({
      id: task.id,
      taskId: task.task_id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      createdDate: task.created_date,
      deadline: task.deadline,
      assigneeName: task.assignee_name,
      assigneeId: task.assignee_id
    }));
  }

  async updateTaskStatus(taskId, status, comment = null) {
    const query = `
      UPDATE tasks 
      SET status = ?, updated_at = datetime('now'), synced = 0
      ${status === 'Выполнена' ? ', completed_date = datetime("now")' : ''}
      WHERE id = ?
    `;
    await this.runQuery(query, [status, taskId]);
  }

  async getUnsyncedTasks() {
    const query = `SELECT * FROM tasks WHERE synced = 0`;
    return await this.getAll(query);
  }

  async markTaskSynced(taskId) {
    const query = `UPDATE tasks SET synced = 1 WHERE id = ?`;
    await this.runQuery(query, [taskId]);
  }

  // ========== ATTENDANCE ==========
  async cacheAttendance(attendanceData) {
    const query = `
      INSERT OR REPLACE INTO attendance 
      (id, employee_id, employee_name, date, check_in, check_out, 
       work_hours, status, location_in, location_out, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const attendanceId = attendanceData.id || `attendance-${attendanceData.employeeId}-${attendanceData.date}`;
    
    await this.runQuery(query, [
      attendanceId,
      attendanceData.employeeId,
      attendanceData.employeeName,
      attendanceData.date,
      attendanceData.checkIn,
      attendanceData.checkOut || null,
      attendanceData.workHours || null,
      attendanceData.status || 'На работе',
      attendanceData.locationIn ? JSON.stringify(attendanceData.locationIn) : null,
      attendanceData.locationOut ? JSON.stringify(attendanceData.locationOut) : null,
      attendanceData.synced ? 1 : 0
    ]);
    
    return attendanceId;
  }

  async getCachedTodayAttendance(employeeId) {
    const today = new Date().toISOString().split('T')[0];
    const query = `SELECT * FROM attendance WHERE employee_id = ? AND date = ?`;
    const attendance = await this.getOne(query, [employeeId.toString(), today]);
    
    if (attendance) {
      return {
        id: attendance.id,
        employeeId: attendance.employee_id,
        date: attendance.date,
        checkIn: attendance.check_in,
        checkOut: attendance.check_out,
        status: attendance.status,
        isPresent: !attendance.check_out && !!attendance.check_in,
        workHours: attendance.work_hours
      };
    }
    return null;
  }

  async updateAttendanceCheckOut(employeeId, date, checkOut, location = null) {
    const checkInQuery = `SELECT check_in FROM attendance WHERE employee_id = ? AND date = ?`;
    const record = await this.getOne(checkInQuery, [employeeId.toString(), date]);
    
    if (record && record.check_in) {
      const checkInTime = new Date(record.check_in);
      const checkOutTime = new Date(checkOut);
      const workHours = ((checkOutTime - checkInTime) / (1000 * 60 * 60)).toFixed(1);
      
      const query = `
        UPDATE attendance 
        SET check_out = ?, work_hours = ?, status = 'Ушел', 
            location_out = ?, synced = 0, updated_at = datetime('now')
        WHERE employee_id = ? AND date = ?
      `;
      
      await this.runQuery(query, [
        checkOut,
        workHours,
        location ? JSON.stringify(location) : null,
        employeeId.toString(),
        date
      ]);
      
      return workHours;
    }
    return '0';
  }

  async getUnsyncedAttendance() {
    const query = `SELECT * FROM attendance WHERE synced = 0`;
    return await this.getAll(query);
  }

  async markAttendanceSynced(attendanceId) {
    const query = `UPDATE attendance SET synced = 1 WHERE id = ?`;
    await this.runQuery(query, [attendanceId]);
  }

  // ========== SYNC MANAGEMENT ==========
  async logSync(tableName, recordsSynced, status, error = null) {
    const query = `
      INSERT INTO sync_log (table_name, last_sync, records_synced, status, error)
      VALUES (?, datetime('now'), ?, ?, ?)
    `;
    await this.runQuery(query, [tableName, recordsSynced, status, error]);
  }

  async getLastSyncTime(tableName) {
    const query = `
      SELECT last_sync FROM sync_log 
      WHERE table_name = ? AND status = 'success'
      ORDER BY last_sync DESC 
      LIMIT 1
    `;
    const result = await this.getOne(query, [tableName]);
    return result ? result.last_sync : null;
  }

  // ========== CLEANUP ==========
  async cleanupOldData(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffISO = cutoffDate.toISOString();
    
    // Удаляем старые отчеты
    await this.runQuery(
      `DELETE FROM reports WHERE date < ? AND synced = 1`,
      [cutoffISO]
    );
    
    // Удаляем старые записи синхронизации
    await this.runQuery(
      `DELETE FROM sync_log WHERE last_sync < ?`,
      [cutoffISO]
    );
    
    console.log(`✅ Cleaned up data older than ${daysToKeep} days`);
  }

  async close() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // ========== STATISTICS ==========
  async getCacheStats() {
    const stats = {};
    
    const tables = ['users', 'reports', 'tasks', 'attendance'];
    for (const table of tables) {
      const result = await this.getOne(`SELECT COUNT(*) as count FROM ${table}`);
      stats[table] = result.count;
    }
    
    // Размер базы данных
    const dbStats = await fs.stat(this.dbPath);
    stats.sizeBytes = dbStats.size;
    stats.sizeMB = (dbStats.size / (1024 * 1024)).toFixed(2);
    
    return stats;
  }
}

// Singleton
let cacheInstance = null;

module.exports = {
  getInstance: async () => {
    if (!cacheInstance) {
      cacheInstance = new CacheService();
      await cacheInstance.initialize();
    }
    return cacheInstance;
  },
  CacheService
};