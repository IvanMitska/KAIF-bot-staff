const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SQLiteService {
  constructor() {
    const dbPath = path.join(__dirname, '../../bot.db');
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log(`✅ Connected to SQLite database at ${dbPath}`);
      }
    });
  }

  async initialize() {
    try {
      await this.createTables();
      console.log('✅ SQLite database initialized');
      return true;
    } catch (error) {
      console.error('SQLite init error:', error);
      return false;
    }
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Таблица пользователей
        this.db.run(`CREATE TABLE IF NOT EXISTS users (
          telegram_id TEXT PRIMARY KEY,
          notion_id TEXT,
          name TEXT,
          username TEXT,
          position TEXT,
          is_active INTEGER DEFAULT 1,
          registration_date TEXT,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Таблица отчетов
        this.db.run(`CREATE TABLE IF NOT EXISTS reports (
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
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Таблица задач
        this.db.run(`CREATE TABLE IF NOT EXISTS tasks (
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
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Таблица учета времени
        this.db.run(`CREATE TABLE IF NOT EXISTS attendance (
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
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(employee_id, date)
        )`);
        
        // Создаем индексы
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_reports_telegram ON reports(telegram_id)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  // ========== USERS ==========
  async saveUser(userData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR REPLACE INTO users 
        (telegram_id, notion_id, name, username, position, is_active, registration_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(query, [
        userData.telegramId,
        userData.id,
        userData.name,
        userData.username || '',
        userData.position,
        userData.isActive ? 1 : 0,
        userData.registrationDate || new Date().toISOString()
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  async getUser(telegramId) {
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM users WHERE telegram_id = ?`;
      this.db.get(query, [telegramId.toString()], (err, row) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else {
          resolve({
            id: row.notion_id,
            telegramId: row.telegram_id,
            name: row.name,
            username: row.username,
            position: row.position,
            isActive: row.is_active === 1,
            registrationDate: row.registration_date
          });
        }
      });
    });
  }

  async getAllUsers() {
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM users WHERE is_active = 1`;
      this.db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else {
          resolve(rows.map(row => ({
            id: row.notion_id,
            telegramId: row.telegram_id,
            name: row.name,
            position: row.position,
            isActive: row.is_active === 1
          })));
        }
      });
    });
  }

  // ========== TASKS ==========
  async saveTask(taskData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR REPLACE INTO tasks 
        (id, task_id, title, description, assignee_id, assignee_name, 
         creator_id, creator_name, status, priority, created_date, deadline, 
         completed_date, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(query, [
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
        1
      ], function(err) {
        if (err) reject(err);
        else resolve(taskData.id);
      });
    });
  }

  async getTasksByAssignee(telegramId, status = null) {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM tasks WHERE assignee_id = ?`;
      const params = [telegramId.toString()];
      
      if (status) {
        query += ` AND status = ?`;
        params.push(status);
      }
      
      query += ` ORDER BY priority, created_date DESC`;
      
      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else {
          resolve(rows.map(row => ({
            id: row.id,
            taskId: row.task_id,
            title: row.title,
            description: row.description,
            status: row.status,
            priority: row.priority,
            createdDate: row.created_date,
            deadline: row.deadline,
            creatorName: row.creator_name,
            creatorId: row.creator_id,
            assigneeId: row.assignee_id,
            assigneeName: row.assignee_name
          })));
        }
      });
    });
  }

  async getAllTasks(statusFilter = null) {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM tasks`;
      const params = [];
      
      if (statusFilter) {
        query += ` WHERE status = ?`;
        params.push(statusFilter);
      }
      
      query += ` ORDER BY created_date DESC`;
      
      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else {
          resolve(rows.map(row => ({
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
          })));
        }
      });
    });
  }

  async updateTaskStatus(taskId, status) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE tasks 
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        ${status === 'Выполнена' ? ', completed_date = CURRENT_TIMESTAMP' : ''}
        WHERE id = ?
      `;
      
      this.db.run(query, [status, taskId], function(err) {
        if (err) reject(err);
        else resolve({ success: true, changes: this.changes });
      });
    });
  }

  // ========== REPORTS ==========
  async saveReport(reportData) {
    return new Promise((resolve, reject) => {
      const reportId = reportData.id || `report-${Date.now()}`;
      const query = `
        INSERT OR REPLACE INTO reports 
        (id, telegram_id, employee_name, date, what_done, problems, goals, timestamp, status, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(query, [
        reportId,
        reportData.telegramId,
        reportData.employeeName,
        reportData.date,
        reportData.whatDone,
        reportData.problems || '',
        reportData.goals || '',
        reportData.timestamp || new Date().toISOString(),
        reportData.status || 'Отправлен',
        1
      ], function(err) {
        if (err) reject(err);
        else resolve(reportId);
      });
    });
  }

  async getTodayReport(telegramId) {
    return new Promise((resolve, reject) => {
      const today = new Date().toISOString().split('T')[0];
      const query = `SELECT * FROM reports WHERE telegram_id = ? AND date = ?`;
      
      this.db.get(query, [telegramId.toString(), today], (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }

  async getUserReports(telegramId, limit = 5) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM reports 
        WHERE telegram_id = ? 
        ORDER BY date DESC, timestamp DESC 
        LIMIT ?
      `;
      
      this.db.all(query, [telegramId.toString(), limit], (err, rows) => {
        if (err) reject(err);
        else {
          resolve(rows.map(row => ({
            id: row.id,
            date: row.date,
            whatDone: row.what_done,
            problems: row.problems,
            goals: row.goals,
            status: row.status
          })));
        }
      });
    });
  }

  // ========== ATTENDANCE ==========
  async saveAttendance(attendanceData) {
    return new Promise((resolve, reject) => {
      const attendanceId = attendanceData.id || `attendance-${attendanceData.employeeId}-${attendanceData.date}`;
      
      const query = `
        INSERT OR REPLACE INTO attendance 
        (id, employee_id, employee_name, date, check_in, check_out, 
         work_hours, status, location_in, location_out, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(query, [
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
        1
      ], function(err) {
        if (err) reject(err);
        else resolve(attendanceId);
      });
    });
  }

  async getTodayAttendance(employeeId) {
    return new Promise((resolve, reject) => {
      const today = new Date().toISOString().split('T')[0];
      const query = `SELECT * FROM attendance WHERE employee_id = ? AND date = ?`;
      
      this.db.get(query, [employeeId.toString(), today], (err, row) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else {
          resolve({
            id: row.id,
            employeeId: row.employee_id,
            date: row.date,
            checkIn: row.check_in,
            checkOut: row.check_out,
            status: row.status,
            isPresent: !row.check_out && !!row.check_in,
            workHours: row.work_hours
          });
        }
      });
    });
  }

  // ========== UTILITIES ==========
  async getStats() {
    return new Promise((resolve, reject) => {
      const stats = {};
      const tables = ['users', 'reports', 'tasks', 'attendance'];
      let completed = 0;
      
      tables.forEach(table => {
        this.db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
          if (!err) stats[table] = row.count;
          completed++;
          
          if (completed === tables.length) {
            resolve(stats);
          }
        });
      });
    });
  }

  close() {
    this.db.close();
  }
}

// Singleton
let dbInstance = null;

module.exports = {
  getInstance: async () => {
    if (!dbInstance) {
      dbInstance = new SQLiteService();
      await dbInstance.initialize();
    }
    return dbInstance;
  },
  SQLiteService
};