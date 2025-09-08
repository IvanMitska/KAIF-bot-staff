const databasePool = require('./databasePool');

class PostgresService {
  constructor() {
    // Используем единый пул из databasePool
  }

  async initialize() {
    // Просто проверяем что пул готов
    await databasePool.getPool();
    return true;
  }

  // Получить задачи пользователя
  async getTasksByAssignee(telegramId, status = null) {
    try {
      let query = 'SELECT * FROM tasks WHERE assignee_id = $1';
      const params = [String(telegramId)];
      
      if (status) {
        query += ' AND status = $2';
        params.push(status);
      }
      
      query += ' ORDER BY created_date DESC';
      
      console.log('🔍 Executing query:', query, 'with params:', params);
      const result = await databasePool.query(query, params);
      
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
    try {
      const query = 'SELECT * FROM users WHERE telegram_id = $1';
      const result = await databasePool.query(query, [String(telegramId)]);
      
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
    } catch (error) {
      console.error('❌ Error getting user:', error.message);
      return null;
    }
  }

  // Создать или обновить пользователя
  async createOrUpdateUser(userData) {
    try {
      const query = `
        INSERT INTO users (telegram_id, name, username, position, notion_id, is_active, registration_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (telegram_id) DO UPDATE SET
          name = EXCLUDED.name,
          username = EXCLUDED.username,
          position = EXCLUDED.position,
          is_active = EXCLUDED.is_active
        RETURNING *
      `;
      
      const result = await databasePool.query(query, [
        String(userData.telegramId),
        userData.name,
        userData.username,
        userData.position || 'Сотрудник',
        userData.id || userData.notionId,
        true,
        new Date()
      ]);
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error creating/updating user:', error.message);
      throw error;
    }
  }

  // Получить все задачи
  async getAllTasks() {
    try {
      const query = 'SELECT * FROM tasks ORDER BY created_date DESC';
      const result = await databasePool.query(query);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting all tasks:', error.message);
      return [];
    }
  }

  // Получить статистику
  async getStats() {
    try {
      const tables = ['users', 'tasks', 'reports', 'attendance'];
      const stats = {};
      
      for (const table of tables) {
        const result = await databasePool.query(`SELECT COUNT(*) FROM ${table}`);
        stats[table] = parseInt(result.rows[0].count);
      }
      
      return stats;
    } catch (error) {
      console.error('❌ Error getting stats:', error.message);
      return {};
    }
  }

  // Проверка соединения
  async testConnection() {
    try {
      const result = await databasePool.query('SELECT 1');
      return !!result;
    } catch (error) {
      console.error('❌ Connection test failed:', error.message);
      return false;
    }
  }

  // Для совместимости со старым кодом
  get pool() {
    console.warn('⚠️ Direct pool access is deprecated. Use databasePool instead.');
    return databasePool;
  }
}

module.exports = new PostgresService();