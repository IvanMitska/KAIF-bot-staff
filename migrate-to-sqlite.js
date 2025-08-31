require('dotenv').config();
const notionService = require('./src/services/notionService');
const { getInstance: getDBInstance } = require('./src/services/sqliteService');

async function migrate() {
  console.log('🚀 Starting migration from Notion to SQLite...');
  
  try {
    // Инициализируем SQLite
    const db = await getDBInstance();
    console.log('✅ SQLite database ready');
    
    // Мигрируем пользователей
    console.log('\n📥 Migrating users...');
    const users = await notionService.getAllActiveUsers();
    console.log(`Found ${users.length} users in Notion`);
    
    for (const user of users) {
      await db.saveUser(user);
      console.log(`  ✅ User migrated: ${user.name} (${user.telegramId})`);
    }
    
    // Мигрируем задачи
    console.log('\n📥 Migrating tasks...');
    const tasks = await notionService.getAllTasks();
    console.log(`Found ${tasks.length} tasks in Notion`);
    
    let taskCount = 0;
    for (const task of tasks) {
      await db.saveTask(task);
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
              await db.saveReport({
                ...report,
                telegramId: user.telegramId,
                employeeName: user.name
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
              await db.saveAttendance({
                ...record,
                employeeId: user.telegramId,
                employeeName: user.name
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
    const stats = await db.getStats();
    console.log('Database contents:');
    console.log(`  - Users: ${stats.users}`);
    console.log(`  - Tasks: ${stats.tasks}`);
    console.log(`  - Reports: ${stats.reports}`);
    console.log(`  - Attendance: ${stats.attendance}`);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('📝 Now you can switch the bot to use SQLite by updating the service configuration.');
    
    db.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Запускаем миграцию
migrate();