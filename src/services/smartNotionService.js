/**
 * Умный сервис для работы с Notion
 * Автоматически выбирает режим работы:
 * - Локально: использует SQLite кэш (быстро)
 * - На хостинге: прямое подключение к Notion (надежно)
 */

// Определяем окружение
const isProduction = process.env.NODE_ENV === 'production';
const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
const isRender = !!process.env.RENDER;
const isHeroku = !!process.env.DYNO;
const isLocalhost = !isRailway && !isRender && !isHeroku && !process.env.VERCEL;

// Определяем, можем ли использовать кэш
const CAN_USE_CACHE = isLocalhost && !process.env.DISABLE_CACHE;

console.log('🔍 Smart Notion Service Configuration:');
console.log(`   Environment: ${isProduction ? 'Production' : 'Development'}`);
console.log(`   Platform: ${isRailway ? 'Railway' : isRender ? 'Render' : isHeroku ? 'Heroku' : 'Local'}`);
console.log(`   Cache: ${CAN_USE_CACHE ? 'Enabled (SQLite)' : 'Disabled (Direct Notion)'}`);

// Экспортируем нужный сервис
if (CAN_USE_CACHE) {
  // Локально - используем оптимизированную версию с кэшем
  console.log('✅ Using optimized service with local cache');
  
  try {
    // Пробуем загрузить оптимизированный сервис
    module.exports = require('./optimizedNotionService');
  } catch (error) {
    // Если не удалось (например, не установлен sqlite3), используем обычный
    console.warn('⚠️ Failed to load optimized service, falling back to direct Notion');
    console.warn(`   Reason: ${error.message}`);
    module.exports = require('./notionService');
  }
} else {
  // На хостинге - используем прямое подключение к Notion
  console.log('📡 Using direct Notion API connection');
  module.exports = require('./notionService');
}

// Добавляем метод для проверки режима
module.exports.getMode = () => {
  return {
    isProduction,
    platform: isRailway ? 'Railway' : isRender ? 'Render' : isHeroku ? 'Heroku' : 'Local',
    cacheEnabled: CAN_USE_CACHE,
    mode: CAN_USE_CACHE ? 'optimized' : 'direct'
  };
};

// Метод для получения статистики (работает в обоих режимах)
module.exports.getSystemStats = async () => {
  const mode = module.exports.getMode();
  
  if (mode.cacheEnabled) {
    try {
      // Если кэш включен, показываем его статистику
      const stats = await module.exports.getStats();
      return {
        ...mode,
        cache: stats
      };
    } catch (error) {
      return {
        ...mode,
        cache: { error: error.message }
      };
    }
  } else {
    // Без кэша показываем базовую информацию
    return {
      ...mode,
      message: 'Cache disabled on hosting platform'
    };
  }
};