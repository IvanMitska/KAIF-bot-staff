const { Pool } = require('pg');

class PostgresService {
  constructor() {
    this.pool = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return true;

    console.log('🔵 PostgreSQL Service initializing...');
    
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL not found!');
      throw new Error('DATABASE_URL is required');
    }

    try {
      // Railway internal URLs не используют SSL
      const isInternal = process.env.DATABASE_URL.includes('.railway.internal');
      
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: isInternal ? false : { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // Тест подключения
      const result = await this.pool.query('SELECT NOW()');
      console.log('✅ PostgreSQL connected:', result.rows[0].now);

      // Проверяем таблицы
      const tables = await this.pool.query(`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public'
      `);
      console.log('📋 Available tables:', tables.rows.map(r => r.tablename).join(', '));

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('❌ PostgreSQL connection failed:', error.message);
      throw error;
    }
  }

  // Получить задачи пользователя
  async getTasksByAssignee(telegramId, status = null) {
    await this.initialize();
    
    try {
      let query = 'SELECT * FROM tasks WHERE assignee_id = $1';
      const params = [String(telegramId)];
      
      if (status) {
        query += ' AND status = $2';
        params.push(status);
      }
      
      query += ' ORDER BY created_date DESC';
      
      console.log('🔍 Executing query:', query, 'with params:', params);
      const result = await this.pool.query(query, params);
      
      console.log(`✅ Found ${result.rows.length} tasks for user ${telegramId}`);
      
      return result.rows.map(row => ({
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
        assigneeName: row.assignee_name,
        completedDate: row.completed_date
      }));
    } catch (error) {
      console.error('❌ Error getting tasks:', error.message);
      return [];
    }
  }

  // Получить пользователя
  async getUserByTelegramId(telegramId) {
    await this.initialize();
    
    try {
      const query = 'SELECT * FROM users WHERE telegram_id = $1';
      const result = await this.pool.query(query, [String(telegramId)]);
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        return {
          id: user.notion_id || user.telegram_id,
          telegramId: user.telegram_id,
          name: user.name,
          username: user.username,
          position: user.position,
          isActive: user.is_active
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error getting user:', error.message);
      return null;
    }
  }

  // Создать пользователя
  async createUser(userData) {
    await this.initialize();
    
    try {
      const query = `
        INSERT INTO users (telegram_id, name, username, position, is_active, registration_date)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (telegram_id) DO UPDATE SET
          name = $2, username = $3, position = $4, is_active = $5
        RETURNING *
      `;
      
      const result = await this.pool.query(query, [
        String(userData.telegramId),
        userData.name,
        userData.username,
        userData.position || 'Сотрудник',
        true,
        new Date()
      ]);
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error creating user:', error.message);
      throw error;
    }
  }

  // Получить все задачи
  async getAllTasks() {
    await this.initialize();
    
    try {
      const query = 'SELECT * FROM tasks ORDER BY created_date DESC';
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting all tasks:', error.message);
      return [];
    }
  }

  // Получить статистику
  async getStats() {
    await this.initialize();
    
    try {
      const stats = {};
      const tables = ['users', 'tasks', 'reports', 'attendance'];
      
      for (const table of tables) {
        const result = await this.pool.query(`SELECT COUNT(*) FROM ${table}`);
        stats[table] = parseInt(result.rows[0].count);
      }
      
      return stats;
    } catch (error) {
      console.error('❌ Error getting stats:', error.message);
      return { users: 0, tasks: 0, reports: 0, attendance: 0 };
    }
  }

  // Тест подключения
  async testConnection() {
    try {
      await this.initialize();
      const result = await this.pool.query('SELECT 1');
      return !!result;
    } catch (error) {
      console.error('❌ Connection test failed:', error.message);
      return false;
    }
  }
}

// Singleton
const postgresService = new PostgresService();
module.exports = postgresService;