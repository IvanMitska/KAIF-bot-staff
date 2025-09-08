const databasePool = require('./databasePool');

class CacheServicePG {
  constructor() {
    console.log('🔧 CacheServicePG using shared database pool');
    // Используем единый пул соединений
  }

  async initialize() {
    try {
      // Тестируем подключение
      const testQuery = await databasePool.query('SELECT NOW()');
      console.log('✅ PostgreSQL connection test passed:', testQuery.rows[0].now);
      
      // Создаем таблицы
      await this.createTables();
      console.log('✅ PostgreSQL cache connected on Railway');
      
      // Проверяем количество записей
      try {
        const countQuery = await databasePool.query('SELECT COUNT(*) FROM tasks');
        console.log('📊 Tasks in database:', countQuery.rows[0].count);
      } catch (e) {
        console.log('📋 Tables created, no tasks yet');
      }
      
      return true;
    } catch (error) {
      console.error('❌ PostgreSQL init error:', error.message);
      console.error('Connection string:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@') || 'NOT SET');
      throw error; // Пробрасываем ошибку дальше
    }
  }

  async createTables() {
    const queries = [
      // Таблица пользователей
      `CREATE TABLE IF NOT EXISTS users (
        telegram_id VARCHAR(50) PRIMARY KEY,
        notion_id VARCHAR(100),
        name VARCHAR(200),
        username VARCHAR(100),
        position VARCHAR(200),
        is_active BOOLEAN DEFAULT true,
        registration_date TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Таблица отчетов с индексами для быстрого поиска
      `CREATE TABLE IF NOT EXISTS reports (
        id VARCHAR(100) PRIMARY KEY,
        telegram_id VARCHAR(50),
        employee_name VARCHAR(200),
        date DATE,
        what_done TEXT,
        problems TEXT,
        goals TEXT,
        timestamp TIMESTAMP,
        status VARCHAR(50),
        synced BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Таблица задач
      `CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(100) PRIMARY KEY,
        task_id VARCHAR(100),
        title VARCHAR(500),
        description TEXT,
        assignee_id VARCHAR(50),
        assignee_name VARCHAR(200),
        creator_id VARCHAR(50),
        creator_name VARCHAR(200),
        status VARCHAR(50),
        priority VARCHAR(50),
        created_date TIMESTAMP,
        deadline TIMESTAMP,
        completed_date TIMESTAMP,
        synced BOOLEAN DEFAULT false,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Таблица учета времени
      `CREATE TABLE IF NOT EXISTS attendance (
        id VARCHAR(100) PRIMARY KEY,
        employee_id VARCHAR(50),
        employee_name VARCHAR(200),
        date DATE,
        check_in TIMESTAMP,
        check_out TIMESTAMP,
        work_hours DECIMAL(4,2),
        status VARCHAR(50),
        location_in TEXT,
        location_out TEXT,
        synced BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(employee_id, date)
      )`,
      
      // Индексы для производительности
      `CREATE INDEX IF NOT EXISTS idx_reports_telegram ON reports(telegram_id)`,
      `CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`,
      `CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id)`,
      `CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)`
    ];

    for (const query of queries) {
      await databasePool.query(query);
    }
  }

  // ========== USERS ==========
  async cacheUser(userData) {
    const query = `
      INSERT INTO users 
      (telegram_id, notion_id, name, username, position, is_active, registration_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (telegram_id) 
      DO UPDATE SET 
        notion_id = $2, name = $3, username = $4, 
        position = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP
    `;
    
    await databasePool.query(query, [
      userData.telegramId,
      userData.id,
      userData.name,
      userData.username || '',
      userData.position,
      userData.isActive,
      userData.registrationDate || new Date()
    ]);
  }

  async getCachedUser(telegramId) {
    const query = `SELECT * FROM users WHERE telegram_id = $1`;
    const result = await databasePool.query(query, [telegramId.toString()]);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      return {
        id: user.notion_id,
        telegramId: user.telegram_id,
        name: user.name,
        username: user.username,
        position: user.position,
        isActive: user.is_active,
        registrationDate: user.registration_date
      };
    }
    return null;
  }

  async getAllCachedUsers() {
    const query = `SELECT * FROM users WHERE is_active = true`;
    const result = await databasePool.query(query);
    
    return result.rows.map(user => ({
      id: user.notion_id,
      telegramId: user.telegram_id,
      name: user.name,
      position: user.position
    }));
  }

  // Метод getAllUsers для совместимости с railwayOptimizedService
  async getAllUsers() {
    const query = `SELECT * FROM users ORDER BY name`;
    const result = await databasePool.query(query);
    
    return result.rows.map(user => ({
      id: user.notion_id,
      telegramId: user.telegram_id,
      name: user.name,
      username: user.username,
      position: user.position,
      isActive: user.is_active,
      registrationDate: user.registration_date
    }));
  }

  // ========== REPORTS ==========
  async cacheReport(reportData) {
    const reportId = reportData.id || `report-${Date.now()}`;
    const query = `
      INSERT INTO reports 
      (id, telegram_id, employee_name, date, what_done, problems, goals, timestamp, status, synced)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        what_done = $5, problems = $6, goals = $7, status = $9, synced = $10
    `;
    
    await databasePool.query(query, [
      reportId,
      reportData.telegramId,
      reportData.employeeName,
      reportData.date,
      reportData.whatDone,
      reportData.problems || '',
      reportData.goals || '',
      reportData.timestamp || new Date(),
      reportData.status || 'Отправлен',
      reportData.synced || false
    ]);
    
    return reportId;
  }

  async getCachedTodayReport(telegramId) {
    const today = new Date().toISOString().split('T')[0];
    const query = `SELECT * FROM reports WHERE telegram_id = $1 AND date = $2`;
    const result = await databasePool.query(query, [telegramId.toString(), today]);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async getCachedUserReports(telegramId, limit = 5) {
    const query = `
      SELECT * FROM reports 
      WHERE telegram_id = $1 
      ORDER BY date DESC, timestamp DESC 
      LIMIT $2
    `;
    const result = await databasePool.query(query, [telegramId.toString(), limit]);
    
    return result.rows.map(report => ({
      id: report.id,
      date: report.date,
      whatDone: report.what_done,
      problems: report.problems,
      goals: report.goals,
      status: report.status
    }));
  }

  async getUnsyncedReports() {
    const query = `SELECT * FROM reports WHERE synced = false`;
    const result = await databasePool.query(query);
    return result.rows;
  }

  async markReportSynced(reportId) {
    const query = `UPDATE reports SET synced = true WHERE id = $1`;
    await databasePool.query(query, [reportId]);
  }

  // ========== TASKS ==========
  async cacheTask(taskData) {
    const query = `
      INSERT INTO tasks 
      (id, task_id, title, description, assignee_id, assignee_name, 
       creator_id, creator_name, status, priority, created_date, deadline, 
       completed_date, synced)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        status = $9, completed_date = $13, synced = $14, updated_at = CURRENT_TIMESTAMP
    `;
    
    await databasePool.query(query, [
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
      taskData.createdDate || new Date(),
      taskData.deadline,
      taskData.completedDate,
      taskData.synced || false
    ]);
  }

  async getCachedTasksByAssignee(telegramId, status = null) {
    let query = `SELECT * FROM tasks WHERE assignee_id = $1`;
    const params = [telegramId.toString()];
    
    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }
    
    query += ` ORDER BY priority, created_date DESC`;
    const result = await databasePool.query(query, params);
    
    return result.rows.map(task => ({
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

  async updateTaskStatus(taskId, status) {
    const query = `
      UPDATE tasks 
      SET status = $1, synced = false, updated_at = CURRENT_TIMESTAMP
      ${status === 'Выполнена' ? ', completed_date = CURRENT_TIMESTAMP' : ''}
      WHERE id = $2
    `;
    await databasePool.query(query, [status, taskId]);
  }

  async getUnsyncedTasks() {
    const query = `SELECT * FROM tasks WHERE synced = false`;
    const result = await databasePool.query(query);
    return result.rows;
  }

  async markTaskSynced(taskId) {
    const query = `UPDATE tasks SET synced = true WHERE id = $1`;
    await databasePool.query(query, [taskId]);
  }

  // ========== ATTENDANCE ==========
  async cacheAttendance(attendanceData) {
    const attendanceId = attendanceData.id || `attendance-${attendanceData.employeeId}-${attendanceData.date}`;
    
    const query = `
      INSERT INTO attendance 
      (id, employee_id, employee_name, date, check_in, check_out, 
       work_hours, status, location_in, location_out, synced)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (employee_id, date) DO UPDATE SET
        check_out = $6, work_hours = $7, status = $8, 
        location_out = $10, synced = $11
    `;
    
    await databasePool.query(query, [
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
      attendanceData.synced || false
    ]);
    
    return attendanceId;
  }

  async getCachedTodayAttendance(employeeId) {
    const today = new Date().toISOString().split('T')[0];
    const query = `SELECT * FROM attendance WHERE employee_id = $1 AND date = $2`;
    const result = await databasePool.query(query, [employeeId.toString(), today]);
    
    if (result.rows.length > 0) {
      const attendance = result.rows[0];
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
    // Получаем время прихода
    const getQuery = `SELECT check_in FROM attendance WHERE employee_id = $1 AND date = $2`;
    const result = await databasePool.query(getQuery, [employeeId.toString(), date]);
    
    if (result.rows.length > 0 && result.rows[0].check_in) {
      const checkInTime = new Date(result.rows[0].check_in);
      const checkOutTime = new Date(checkOut);
      const workHours = ((checkOutTime - checkInTime) / (1000 * 60 * 60)).toFixed(1);
      
      const updateQuery = `
        UPDATE attendance 
        SET check_out = $1, work_hours = $2, status = 'Ушел', 
            location_out = $3, synced = false
        WHERE employee_id = $4 AND date = $5
      `;
      
      await databasePool.query(updateQuery, [
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

  // ========== UTILITIES ==========
  async getCacheStats() {
    const stats = {};
    
    const tables = ['users', 'reports', 'tasks', 'attendance'];
    for (const table of tables) {
      const result = await databasePool.query(`SELECT COUNT(*) as count FROM ${table}`);
      stats[table] = parseInt(result.rows[0].count);
    }
    
    // Размер базы (для PostgreSQL это приблизительный размер)
    const sizeQuery = `
      SELECT pg_database_size(current_database()) as size
    `;
    const sizeResult = await databasePool.query(sizeQuery);
    stats.sizeBytes = parseInt(sizeResult.rows[0].size);
    stats.sizeMB = (stats.sizeBytes / (1024 * 1024)).toFixed(2);
    
    return stats;
  }

  async close() {
    await this.pool.end();
  }

  // Для совместимости с SQLite версией
  async runQuery(query, params = []) {
    const result = await databasePool.query(query, params);
    return result;
  }

  async getAll(query, params = []) {
    const result = await databasePool.query(query, params);
    return result.rows;
  }

  async getOne(query, params = []) {
    const result = await databasePool.query(query, params);
    return result.rows[0] || null;
  }

  // Обеспечиваем обратную совместимость
  get pool() {
    console.warn('⚠️ Direct pool access is deprecated. Use databasePool instead.');
    return databasePool;
  }

  // Метод для совместимости с getInstance
  async initialize() {
    return this.init();
  }
}

// Singleton
let cacheInstance = null;

module.exports = {
  getInstance: async () => {
    if (!cacheInstance) {
      cacheInstance = new CacheServicePG();
      await cacheInstance.initialize();
    }
    return cacheInstance;
  },
  CacheServicePG
};