const db = require('./databasePool');

class UserService {
  // Получить пользователя по Telegram ID
  async getUserByTelegramId(telegramId) {
    const result = await db.query(
      'SELECT * FROM users WHERE telegram_id = $1 AND is_active = true',
      [String(telegramId)]
    );
    return result.rows[0] || null;
  }

  // Получить всех активных пользователей
  async getAllUsers() {
    const result = await db.query(
      'SELECT * FROM users WHERE is_active = true ORDER BY name'
    );
    return result.rows;
  }

  // Получить пользователей по роли
  async getUsersByRole(role) {
    const result = await db.query(
      'SELECT * FROM users WHERE role = $1 AND is_active = true ORDER BY name',
      [role]
    );
    return result.rows;
  }

  // Создать пользователя
  async createUser(data) {
    const { telegram_id, name, username, role = 'sales' } = data;

    const result = await db.query(
      `INSERT INTO users (telegram_id, name, username, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (telegram_id) DO UPDATE SET
         name = EXCLUDED.name,
         username = EXCLUDED.username,
         role = COALESCE(users.role, EXCLUDED.role),
         is_active = true
       RETURNING *`,
      [String(telegram_id), name, username, role]
    );
    return result.rows[0];
  }

  // Обновить пользователя
  async updateUser(telegramId, data) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = ['name', 'username', 'role', 'is_active'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = $${paramIndex++}`);
        values.push(data[field]);
      }
    }

    if (fields.length === 0) {
      return this.getUserByTelegramId(telegramId);
    }

    values.push(String(telegramId));
    const result = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE telegram_id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  // Деактивировать пользователя
  async deactivateUser(telegramId) {
    const result = await db.query(
      'UPDATE users SET is_active = false WHERE telegram_id = $1 RETURNING *',
      [String(telegramId)]
    );
    return result.rows[0];
  }

  // Проверить роль пользователя
  async checkUserRole(telegramId, allowedRoles) {
    const user = await this.getUserByTelegramId(telegramId);
    if (!user) return false;
    return allowedRoles.includes(user.role);
  }

  // Получить банщиков для уведомлений
  async getBathAttendants() {
    return this.getUsersByRole('bath_attendant');
  }

  // Получить админов
  async getAdmins() {
    return this.getUsersByRole('admin');
  }
}

module.exports = new UserService();
