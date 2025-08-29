#!/usr/bin/env node

/**
 * Скрипт для принудительной синхронизации из Notion в локальный кэш
 * Это обновит кэш актуальными данными из Notion
 */

require('dotenv').config();

async function resyncFromNotion() {
    console.log('🔄 Принудительная синхронизация из Notion...\n');
    
    try {
        // Получаем экземпляр сервиса синхронизации
        const { getInstance: getSyncInstance } = require('./src/services/syncService');
        const sync = await getSyncInstance();
        
        // Получаем экземпляр кэша
        const { getInstance: getCacheInstance } = require('./src/services/cacheService');
        const cache = await getCacheInstance();
        
        console.log('📥 Загрузка задач из Notion...');
        
        // Синхронизируем активные задачи
        await sync.syncActiveTasksFromNotion();
        
        console.log('\n📊 Проверка результатов:');
        
        // Проверяем задачи для каждого пользователя
        const users = [
            { id: '1734337242', name: 'Иван' },
            { id: '385436658', name: 'Борис' },
            { id: '1151085087', name: 'Ксения' },
            { id: '303267717', name: 'Максим' },
            { id: '5937587032', name: 'Дмитрий' },
            { id: '642664990', name: 'Аля' },
            { id: '321654987', name: 'Игорь' }
        ];
        
        for (const user of users) {
            const tasks = await cache.getCachedTasksByAssignee(user.id);
            console.log(`${user.name}: ${tasks.length} задач`);
        }
        
        console.log('\n✅ Синхронизация завершена!');
        console.log('Теперь бот должен показывать все задачи.');
        
        await cache.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка синхронизации:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

resyncFromNotion();