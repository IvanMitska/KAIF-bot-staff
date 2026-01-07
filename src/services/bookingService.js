const db = require('./databasePool');

class BookingService {
  // Получить все записи с фильтрами
  async getBookings({ date, status, limit = 50, offset = 0 } = {}) {
    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (date) {
      query += ` AND booking_date = $${paramIndex++}`;
      params.push(date);
    }

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    query += ` ORDER BY booking_date ASC, booking_time ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }

  // Получить записи на сегодня
  async getTodayBookings() {
    const result = await db.query(
      `SELECT * FROM bookings
       WHERE booking_date = CURRENT_DATE
       ORDER BY booking_time ASC`
    );
    return result.rows;
  }

  // Получить записи на определённую дату
  async getBookingsByDate(date) {
    const result = await db.query(
      `SELECT * FROM bookings
       WHERE booking_date = $1
       ORDER BY booking_time ASC`,
      [date]
    );
    return result.rows;
  }

  // Получить одну запись по ID
  async getBookingById(id) {
    const result = await db.query(
      'SELECT * FROM bookings WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  // Создать новую запись
  async createBooking(data) {
    const {
      client_name,
      client_phone,
      booking_date,
      booking_time,
      steam_type,
      duration = 60,
      guests_count = 1,
      price,
      prepayment = 0,
      comment,
      created_by
    } = data;

    const result = await db.query(
      `INSERT INTO bookings
       (client_name, client_phone, booking_date, booking_time, steam_type,
        duration, guests_count, price, prepayment, comment, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [client_name, client_phone, booking_date, booking_time, steam_type,
       duration, guests_count, price, prepayment, comment, created_by]
    );
    return result.rows[0];
  }

  // Обновить запись
  async updateBooking(id, data) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = [
      'client_name', 'client_phone', 'booking_date', 'booking_time',
      'steam_type', 'duration', 'guests_count', 'price', 'prepayment', 'comment'
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = $${paramIndex++}`);
        values.push(data[field]);
      }
    }

    if (fields.length === 0) {
      return this.getBookingById(id);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await db.query(
      `UPDATE bookings SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  // Обновить статус записи
  async updateBookingStatus(id, status) {
    const validStatuses = ['new', 'confirmed', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const result = await db.query(
      `UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return result.rows[0];
  }

  // Удалить запись
  async deleteBooking(id) {
    const result = await db.query(
      'DELETE FROM bookings WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  // Статистика записей
  async getStats() {
    const result = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'new') as new_count,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
        COUNT(*) FILTER (WHERE booking_date = CURRENT_DATE) as today_count
      FROM bookings
    `);
    return result.rows[0];
  }

  // Получить записи на неделю
  async getWeekBookings() {
    const result = await db.query(`
      SELECT * FROM bookings
      WHERE booking_date >= CURRENT_DATE
        AND booking_date < CURRENT_DATE + INTERVAL '7 days'
      ORDER BY booking_date ASC, booking_time ASC
    `);
    return result.rows;
  }
}

module.exports = new BookingService();
