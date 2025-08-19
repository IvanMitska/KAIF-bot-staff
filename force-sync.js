#!/usr/bin/env node

/**
 * Скрипт для принудительной синхронизации задач с Notion
 */

require('dotenv').config();

async function forceSync() {
    console.log('🔄 Запуск принудительной синхронизации с Notion...\n');
    
    try {
        const { getInstance: getSyncInstance } = require('./src/services/syncService');
        const sync = await getSyncInstance();
        
        console.log('📤 Синхронизация несохраненных задач...');
        await sync.syncUnsyncedTasks();
        
        console.log('\n✅ Синхронизация завершена!');
        
        // Проверяем статус
        const { getInstance: getCacheInstance } = require('./src/services/cacheService');
        const cache = await getCacheInstance();
        
        const unsyncedCount = await cache.getUnsyncedCount('tasks');
        if (unsyncedCount > 0) {
            console.log(`⚠️ Остались несинхронизированные задачи: ${unsyncedCount}`);
        } else {
            console.log('✅ Все задачи синхронизированы с Notion!');
        }
        
        await cache.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка синхронизации:', error.message);
        process.exit(1);
    }
}

forceSync();