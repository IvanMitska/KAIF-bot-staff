require('dotenv').config();
const notionService = require('./src/services/notionService');
const { getInstance: getCacheInstance } = require('./src/services/cacheServicePG');

async function migrate() {
  console.log('🚀 Starting migration from Notion to Railway PostgreSQL...');
  
  // Проверяем DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in .env file!');
    console.log('📝 Add your Railway PostgreSQL URL to .env:');
    console.log('   DATABASE_URL=postgresql://postgres:PASSWORD@containers-us-west-XXX.railway.app:PORT/railway');
    process.exit(1);
  }
  
  console.log('📍 Connecting to:', process.env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'unknown');
  
  try {
    // Инициализируем PostgreSQL
    const cache = await getCacheInstance();
    console.log('✅ Connected to Railway PostgreSQL');
    
    // Мигрируем пользователей
    console.log('\n📥 Migrating users...');
    const users = await notionService.getAllActiveUsers();
    console.log(`Found ${users.length} users in Notion`);
    
    for (const user of users) {
      await cache.cacheUser({
        ...user,
        synced: true
      });
      console.log(`  ✅ User migrated: ${user.name} (${user.telegramId})`);
    }
    
    // Мигрируем задачи
    console.log('\n📥 Migrating tasks...');
    const tasks = await notionService.getAllTasks();
    console.log(`Found ${tasks.length} tasks in Notion`);
    
    let taskCount = 0;
    for (const task of tasks) {
      await cache.cacheTask({
        ...task,
        synced: true
      });
      taskCount++;
      if (taskCount % 10 === 0) {
        console.log(`  ⏳ Migrated ${taskCount}/${tasks.length} tasks...`);
      }
    }
    console.log(`  ✅ All ${taskCount} tasks migrated`);
    
    // Мигрируем отчеты для каждого пользователя
    console.log('\n📥 Migrating reports...');
    let totalReports = 0;
    
    for (const user of users) {
      if (user.telegramId) {
        try {
          const reports = await notionService.getUserReports(user.telegramId, 100);
          if (reports.length > 0) {
            for (const report of reports) {
              await cache.cacheReport({
                ...report,
                telegramId: user.telegramId,
                employeeName: user.name,
                synced: true
              });
              totalReports++;
            }
            console.log(`  ✅ ${reports.length} reports for ${user.name}`);
          }
        } catch (error) {
          console.log(`  ⚠️ No reports for ${user.name}`);
        }
      }
    }
    console.log(`  ✅ Total ${totalReports} reports migrated`);
    
    // Мигрируем attendance
    console.log('\n📥 Migrating attendance records...');
    let totalAttendance = 0;
    
    // Получаем записи за последние 30 дней
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    for (const user of users) {
      if (user.telegramId) {
        try {
          const attendance = await notionService.getAttendanceForPeriod(startDate, endDate, user.telegramId);
          if (attendance.length > 0) {
            for (const record of attendance) {
              await cache.cacheAttendance({
                ...record,
                employeeId: user.telegramId,
                employeeName: user.name,
                synced: true
              });
              totalAttendance++;
            }
            console.log(`  ✅ ${attendance.length} attendance records for ${user.name}`);
          }
        } catch (error) {
          console.log(`  ⚠️ No attendance for ${user.name}`);
        }
      }
    }
    console.log(`  ✅ Total ${totalAttendance} attendance records migrated`);
    
    // Показываем статистику
    console.log('\n📊 Migration statistics:');
    const stats = await cache.getCacheStats();
    console.log('Railway PostgreSQL database:');
    console.log(`  - Users: ${stats.users}`);
    console.log(`  - Tasks: ${stats.tasks}`);
    console.log(`  - Reports: ${stats.reports}`);
    console.log(`  - Attendance: ${stats.attendance}`);
    console.log(`  - Database size: ${stats.sizeMB} MB`);
    
    console.log('\n✅ Migration to Railway PostgreSQL completed successfully!');
    console.log('🚀 Your bot now uses Railway PostgreSQL for fast data access');
    
    await cache.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\n🔍 Troubleshooting:');
    console.log('1. Check your DATABASE_URL in .env file');
    console.log('2. Make sure Railway PostgreSQL is running');
    console.log('3. Check network connectivity to Railway');
    process.exit(1);
  }
}

// Запускаем миграцию
migrate();