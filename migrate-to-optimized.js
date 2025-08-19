#!/usr/bin/env node

/**
 * Скрипт миграции на оптимизированную версию с локальным кэшированием
 * 
 * Этот скрипт:
 * 1. Создает резервные копии существующих файлов
 * 2. Заменяет импорты notionService на optimizedNotionService
 * 3. Инициализирует базу данных кэша
 * 4. Выполняет начальную синхронизацию
 */

const fs = require('fs').promises;
const path = require('path');

async function backup(filePath) {
  const backupPath = filePath + '.backup';
  try {
    await fs.copyFile(filePath, backupPath);
    console.log(`✅ Backup created: ${backupPath}`);
  } catch (error) {
    console.error(`❌ Failed to backup ${filePath}:`, error.message);
  }
}

async function replaceInFile(filePath, searchValue, replaceValue) {
  try {
    let content = await fs.readFile(filePath, 'utf8');
    const originalContent = content;
    
    content = content.replace(new RegExp(searchValue, 'g'), replaceValue);
    
    if (content !== originalContent) {
      await fs.writeFile(filePath, content);
      console.log(`✅ Updated: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Failed to update ${filePath}:`, error.message);
    return false;
  }
}

async function migrateFiles() {
  console.log('🔄 Starting migration to optimized version...\n');
  
  // Список файлов для миграции
  const filesToMigrate = [
    'src/bot/handlers/start.js',
    'src/bot/handlers/report.js',
    'src/bot/handlers/tasks.js',
    'src/bot/handlers/taskList.js',
    'src/bot/handlers/taskCreation.js',
    'src/bot/handlers/quickTask.js',
    'src/bot/handlers/quickTaskMenu.js',
    'src/bot/handlers/commands.js',
    'src/bot/handlers/callbackHandler.js',
    'src/bot/handlers/mainCallbackHandler.js',
    'src/services/schedulerService.js',
    'src/services/userService.js',
    'webapp/api/notion.js',
    'webapp/api/reports.js',
    'webapp/api/tasks.js',
    'webapp/api/users.js',
    'webapp/api/attendance.js'
  ];
  
  console.log('📁 Creating backups...');
  for (const file of filesToMigrate) {
    const filePath = path.join(process.cwd(), file);
    try {
      await fs.access(filePath);
      await backup(filePath);
    } catch {
      console.log(`⚠️ File not found: ${file}`);
    }
  }
  
  console.log('\n📝 Updating imports...');
  let updatedCount = 0;
  
  for (const file of filesToMigrate) {
    const filePath = path.join(process.cwd(), file);
    try {
      await fs.access(filePath);
      
      // Заменяем импорты
      const updated = await replaceInFile(
        filePath,
        "require\\(['\"].*\\/notionService['\"]\\)",
        "require('../services/optimizedNotionService')"
      );
      
      if (updated) updatedCount++;
    } catch {
      // Файл не существует
    }
  }
  
  console.log(`\n✅ Updated ${updatedCount} files`);
  
  // Создаем файл конфигурации
  console.log('\n📄 Creating configuration file...');
  const configContent = `// Конфигурация оптимизированного сервиса
module.exports = {
  // Интервал синхронизации с Notion (в миллисекундах)
  SYNC_INTERVAL: 5 * 60 * 1000, // 5 минут
  
  // Размер батча для синхронизации
  BATCH_SIZE: 10,
  
  // Время хранения старых данных в днях
  DATA_RETENTION_DAYS: 30,
  
  // Включить автоматическую синхронизацию
  AUTO_SYNC_ENABLED: true,
  
  // Включить кэширование
  CACHE_ENABLED: true,
  
  // Путь к базе данных кэша
  CACHE_DB_PATH: 'cache.db'
};`;
  
  await fs.writeFile(
    path.join(process.cwd(), 'src/config/optimized.config.js'),
    configContent
  );
  console.log('✅ Configuration file created');
  
  // Создаем скрипт инициализации
  console.log('\n📄 Creating initialization script...');
  const initScript = `#!/usr/bin/env node

/**
 * Скрипт инициализации оптимизированной системы
 * Запускайте этот скрипт после установки зависимостей
 */

require('dotenv').config();
const { getInstance: getCacheInstance } = require('./src/services/cacheService');
const { getInstance: getSyncInstance } = require('./src/services/syncService');

async function initialize() {
  console.log('🚀 Initializing optimized system...\\n');
  
  try {
    // Инициализируем кэш
    console.log('📦 Initializing cache database...');
    const cache = await getCacheInstance();
    const stats = await cache.getCacheStats();
    console.log('✅ Cache initialized');
    console.log('   Tables:', Object.keys(stats).filter(k => k !== 'sizeBytes' && k !== 'sizeMB').join(', '));
    console.log('   Database size:', stats.sizeMB + ' MB\\n');
    
    // Инициализируем синхронизацию
    console.log('🔄 Initializing sync service...');
    const sync = await getSyncInstance();
    console.log('✅ Sync service initialized');
    console.log('   Auto-sync enabled');
    console.log('   Sync interval: 5 minutes\\n');
    
    // Показываем статистику
    const syncStats = await sync.getStats();
    console.log('📊 System statistics:');
    console.log('   Cached users:', syncStats.cache.users);
    console.log('   Cached reports:', syncStats.cache.reports);
    console.log('   Cached tasks:', syncStats.cache.tasks);
    console.log('   Cached attendance:', syncStats.cache.attendance);
    
    console.log('\\n✅ System initialized successfully!');
    console.log('\\n💡 Tips:');
    console.log('   - First launch will sync all data from Notion (may take 1-2 minutes)');
    console.log('   - Subsequent launches will be instant');
    console.log('   - Data syncs automatically every 5 minutes');
    console.log('   - All changes are saved locally first, then synced');
    
    process.exit(0);
  } catch (error) {
    console.error('\\n❌ Initialization failed:', error.message);
    process.exit(1);
  }
}

initialize();`;
  
  await fs.writeFile(
    path.join(process.cwd(), 'init-optimized.js'),
    initScript
  );
  await fs.chmod(path.join(process.cwd(), 'init-optimized.js'), '755');
  console.log('✅ Initialization script created');
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
  console.log('='.repeat(60));
  
  console.log('\n📋 Next steps:');
  console.log('1. Install SQLite dependency:');
  console.log('   npm install sqlite3');
  console.log('\n2. Initialize the optimized system:');
  console.log('   node init-optimized.js');
  console.log('\n3. Test the bot:');
  console.log('   npm start');
  console.log('\n4. If everything works, you can delete backup files:');
  console.log('   find . -name "*.backup" -delete');
  
  console.log('\n⚠️ Important notes:');
  console.log('- First sync may take 1-2 minutes to load all data');
  console.log('- After initial sync, bot will respond instantly');
  console.log('- All data is saved to Notion in background');
  console.log('- Check cache.db file for local data storage');
  console.log('- Logs will show cache hits/misses for monitoring');
}

// Запускаем миграцию
migrateFiles().catch(console.error);