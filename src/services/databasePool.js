const { Pool } = require('pg');

class DatabasePool {
  constructor() {
    this.pool = null;
    this.initialized = false;
    this.initPromise = null;
  }

  async getPool() {
    // Если уже идёт инициализация, ждём её завершения
    if (this.initPromise) {
      await this.initPromise;
      return this.pool;
    }

    // Если уже инициализирован, возвращаем пул
    if (this.initialized && this.pool) {
      return this.pool;
    }

    // Начинаем инициализацию
    this.initPromise = this.initialize();
    await this.initPromise;
    return this.pool;
  }

  async initialize() {
    if (this.initialized && this.pool) {
      return this.pool;
    }

    console.log('🔵 Initializing database pool...');
    
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required');
    }

    try {
      const isInternal = process.env.DATABASE_URL.includes('.railway.internal');
      
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: isInternal ? false : { rejectUnauthorized: false },
        max: 10, // Уменьшаем количество соединений
        idleTimeoutMillis: 0, // Отключаем таймаут простоя
        connectionTimeoutMillis: 30000, // Увеличиваем таймаут подключения
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000
      });

      // Обработка ошибок пула
      this.pool.on('error', (err) => {
        console.error('❌ Unexpected pool error:', err);
        // НЕ переинициализируем автоматически, просто логируем
      });

      // Тест подключения
      const result = await this.pool.query('SELECT NOW()');
      console.log('✅ Database pool connected:', result.rows[0].now);

      this.initialized = true;
      this.initPromise = null;
      
      // Пинг каждые 5 минут для поддержания соединения
      this.startKeepAlive();
      
      return this.pool;
    } catch (error) {
      console.error('❌ Database pool initialization failed:', error.message);
      this.initPromise = null;
      throw error;
    }
  }

  startKeepAlive() {
    // Пингуем БД каждые 5 минут
    setInterval(async () => {
      try {
        if (this.pool) {
          await this.pool.query('SELECT 1');
          console.log('🔄 Keep-alive ping successful');
        }
      } catch (error) {
        console.error('❌ Keep-alive ping failed:', error.message);
      }
    }, 5 * 60 * 1000); // 5 минут
  }

  async query(text, params) {
    const pool = await this.getPool();
    return pool.query(text, params);
  }

  async end() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.initialized = false;
    }
  }
}

// Singleton экземпляр
module.exports = new DatabasePool();