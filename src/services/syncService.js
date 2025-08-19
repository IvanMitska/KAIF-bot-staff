const notionService = require('./notionService');
const { getInstance: getCacheInstance } = require('./cacheService');

class SyncService {
  constructor() {
    this.cache = null;
    this.isSyncing = false;
    this.syncInterval = null;
    this.syncQueue = [];
    this.SYNC_INTERVAL = 5 * 60 * 1000; // 5 минут
    this.BATCH_SIZE = 10; // Размер батча для синхронизации
  }

  async initialize() {
    this.cache = await getCacheInstance();
    console.log('✅ Sync service initialized');
    
    // Запускаем начальную синхронизацию
    await this.initialSync();
    
    // Запускаем периодическую синхронизацию
    this.startPeriodicSync();
  }

  // ========== НАЧАЛЬНАЯ СИНХРОНИЗАЦИЯ ==========
  async initialSync() {
    console.log('🔄 Starting initial sync from Notion...');
    
    try {
      // Синхронизируем пользователей
      await this.syncUsersFromNotion();
      
      // Синхронизируем последние отчеты
      await this.syncRecentReportsFromNotion();
      
      // Синхронизируем активные задачи
      await this.syncActiveTasksFromNotion();
      
      console.log('✅ Initial sync completed');
    } catch (error) {
      console.error('❌ Initial sync failed:', error);
    }
  }

  // ========== СИНХРОНИЗАЦИЯ ПОЛЬЗОВАТЕЛЕЙ ==========
  async syncUsersFromNotion() {
    try {
      console.log('Syncing users from Notion...');
      const users = await notionService.getAllActiveUsers();
      
      for (const user of users) {
        await this.cache.cacheUser(user);
      }
      
      await this.cache.logSync('users', users.length, 'success');
      console.log(`✅ Synced ${users.length} users`);
    } catch (error) {
      console.error('Error syncing users:', error);
      await this.cache.logSync('users', 0, 'failed', error.message);
    }
  }

  // ========== СИНХРОНИЗАЦИЯ ОТЧЕТОВ ==========
  async syncRecentReportsFromNotion() {
    try {
      console.log('Syncing recent reports from Notion...');
      
      // Получаем отчеты за последние 7 дней
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const startDateISO = startDate.toISOString().split('T')[0];
      
      const reports = await notionService.getReportsForPeriod(startDateISO, endDate);
      
      for (const report of reports) {
        report.synced = true;
        await this.cache.cacheReport(report);
      }
      
      await this.cache.logSync('reports', reports.length, 'success');
      console.log(`✅ Synced ${reports.length} reports`);
    } catch (error) {
      console.error('Error syncing reports:', error);
      await this.cache.logSync('reports', 0, 'failed', error.message);
    }
  }

  // ========== СИНХРОНИЗАЦИЯ ЗАДАЧ ==========
  async syncActiveTasksFromNotion() {
    try {
      console.log('Syncing active tasks from Notion...');
      
      // Получаем все активные задачи
      const statuses = ['Новая', 'В работе', 'На проверке'];
      let allTasks = [];
      
      for (const status of statuses) {
        const tasks = await notionService.getAllTasks(status);
        allTasks = allTasks.concat(tasks);
      }
      
      for (const task of allTasks) {
        task.synced = true;
        await this.cache.cacheTask(task);
      }
      
      await this.cache.logSync('tasks', allTasks.length, 'success');
      console.log(`✅ Synced ${allTasks.length} tasks`);
    } catch (error) {
      console.error('Error syncing tasks:', error);
      await this.cache.logSync('tasks', 0, 'failed', error.message);
    }
  }

  // ========== ПЕРИОДИЧЕСКАЯ СИНХРОНИЗАЦИЯ ==========
  startPeriodicSync() {
    this.syncInterval = setInterval(async () => {
      if (!this.isSyncing) {
        await this.performSync();
      }
    }, this.SYNC_INTERVAL);
    
    console.log(`⏰ Periodic sync started (every ${this.SYNC_INTERVAL / 1000}s)`);
  }

  async performSync() {
    if (this.isSyncing) {
      console.log('⚠️ Sync already in progress, skipping...');
      return;
    }

    this.isSyncing = true;
    console.log('🔄 Starting periodic sync...');

    try {
      // Синхронизируем несинхронизированные данные в Notion
      await this.syncToNotion();
      
      // Обновляем данные из Notion
      await this.syncFromNotion();
      
      // Очищаем старые данные
      await this.cache.cleanupOldData(30);
      
      console.log('✅ Periodic sync completed');
    } catch (error) {
      console.error('❌ Periodic sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // ========== СИНХРОНИЗАЦИЯ В NOTION ==========
  async syncToNotion() {
    console.log('📤 Syncing local changes to Notion...');
    
    // Синхронизируем отчеты
    await this.syncReportsToNotion();
    
    // Синхронизируем задачи
    await this.syncTasksToNotion();
    
    // Синхронизируем учет времени
    await this.syncAttendanceToNotion();
  }

  async syncReportsToNotion() {
    try {
      const unsyncedReports = await this.cache.getUnsyncedReports();
      console.log(`Found ${unsyncedReports.length} unsynced reports`);
      
      for (const report of unsyncedReports) {
        try {
          // Создаем отчет в Notion
          const notionReport = await notionService.createReport({
            employeeName: report.employee_name,
            telegramId: report.telegram_id,
            whatDone: report.what_done,
            problems: report.problems,
            goals: report.goals,
            date: report.date,
            timestamp: report.timestamp,
            status: report.status
          });
          
          // Помечаем как синхронизированный
          await this.cache.markReportSynced(report.id);
          console.log(`✅ Synced report ${report.id}`);
        } catch (error) {
          console.error(`Failed to sync report ${report.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error syncing reports to Notion:', error);
    }
  }

  async syncTasksToNotion() {
    try {
      const unsyncedTasks = await this.cache.getUnsyncedTasks();
      console.log(`Found ${unsyncedTasks.length} unsynced tasks`);
      
      for (const task of unsyncedTasks) {
        try {
          if (task.id && task.id.startsWith('task-')) {
            // Новая задача - создаем в Notion
            const notionTask = await notionService.createTask({
              title: task.title,
              description: task.description,
              assigneeId: task.assignee_id,
              assigneeName: task.assignee_name,
              creatorId: task.creator_id,
              creatorName: task.creator_name,
              priority: task.priority,
              deadline: task.deadline
            });
            
            // Обновляем ID в кэше
            await this.cache.runQuery(
              `UPDATE tasks SET id = ? WHERE id = ?`,
              [notionTask.id, task.id]
            );
          } else {
            // Существующая задача - обновляем статус
            await notionService.updateTaskStatus(task.id, task.status);
          }
          
          await this.cache.markTaskSynced(task.id);
          console.log(`✅ Synced task ${task.task_id}`);
        } catch (error) {
          console.error(`Failed to sync task ${task.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error syncing tasks to Notion:', error);
    }
  }

  async syncAttendanceToNotion() {
    try {
      const unsyncedAttendance = await this.cache.getUnsyncedAttendance();
      console.log(`Found ${unsyncedAttendance.length} unsynced attendance records`);
      
      for (const attendance of unsyncedAttendance) {
        try {
          if (!attendance.id.includes('notion-')) {
            // Новая запись - создаем в Notion
            const notionAttendance = await notionService.createAttendance({
              employeeId: attendance.employee_id,
              employeeName: attendance.employee_name,
              date: attendance.date,
              checkIn: attendance.check_in,
              location: attendance.location_in ? JSON.parse(attendance.location_in) : null
            });
            
            // Обновляем ID в кэше
            await this.cache.runQuery(
              `UPDATE attendance SET id = ? WHERE id = ?`,
              [`notion-${notionAttendance.id}`, attendance.id]
            );
            
            // Если есть check-out, обновляем
            if (attendance.check_out) {
              await notionService.updateAttendanceCheckOut(
                notionAttendance.id,
                attendance.check_out,
                attendance.location_out ? JSON.parse(attendance.location_out) : null
              );
            }
          } else {
            // Обновляем существующую запись
            const notionId = attendance.id.replace('notion-', '');
            if (attendance.check_out) {
              await notionService.updateAttendanceCheckOut(
                notionId,
                attendance.check_out,
                attendance.location_out ? JSON.parse(attendance.location_out) : null
              );
            }
          }
          
          await this.cache.markAttendanceSynced(attendance.id);
          console.log(`✅ Synced attendance for ${attendance.employee_name}`);
        } catch (error) {
          console.error(`Failed to sync attendance ${attendance.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error syncing attendance to Notion:', error);
    }
  }

  // ========== СИНХРОНИЗАЦИЯ ИЗ NOTION ==========
  async syncFromNotion() {
    console.log('📥 Syncing updates from Notion...');
    
    try {
      // Обновляем пользователей
      await this.syncUsersFromNotion();
      
      // Обновляем сегодняшние отчеты
      const today = new Date().toISOString().split('T')[0];
      const todayReports = await notionService.getReportsForPeriod(today, today);
      for (const report of todayReports) {
        report.synced = true;
        await this.cache.cacheReport(report);
      }
      
      console.log('✅ Synced updates from Notion');
    } catch (error) {
      console.error('Error syncing from Notion:', error);
    }
  }

  // ========== УТИЛИТЫ ==========
  async addToQueue(operation) {
    this.syncQueue.push(operation);
    
    // Если очередь достигла размера батча, выполняем синхронизацию
    if (this.syncQueue.length >= this.BATCH_SIZE) {
      await this.processSyncQueue();
    }
  }

  async processSyncQueue() {
    if (this.syncQueue.length === 0) return;
    
    const batch = this.syncQueue.splice(0, this.BATCH_SIZE);
    console.log(`Processing sync batch of ${batch.length} operations`);
    
    for (const operation of batch) {
      try {
        await operation();
      } catch (error) {
        console.error('Sync operation failed:', error);
      }
    }
  }

  async forceSync() {
    console.log('🔄 Force sync initiated...');
    await this.performSync();
  }

  async getStats() {
    const cacheStats = await this.cache.getCacheStats();
    const lastSyncs = {};
    
    for (const table of ['users', 'reports', 'tasks', 'attendance']) {
      lastSyncs[table] = await this.cache.getLastSyncTime(table);
    }
    
    return {
      cache: cacheStats,
      lastSyncs,
      isSyncing: this.isSyncing,
      queueSize: this.syncQueue.length
    };
  }

  async stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    // Обрабатываем оставшуюся очередь
    await this.processSyncQueue();
    
    console.log('⏹️ Sync service stopped');
  }
}

// Singleton
let syncInstance = null;

module.exports = {
  getInstance: async () => {
    if (!syncInstance) {
      syncInstance = new SyncService();
      await syncInstance.initialize();
    }
    return syncInstance;
  },
  SyncService
};