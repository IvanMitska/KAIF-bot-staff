#!/usr/bin/env node

/**
 * Скрипт для полной пересинхронизации кэша с Notion
 */

require('dotenv').config();

async function resyncCache() {
    console.log('🔄 Запускаем полную пересинхронизацию кэша...\n');
    
    try {
        // Получаем сервис кэша
        const { getInstance } = require('./src/services/cacheService');
        const cache = await getInstance();
        
        // Очищаем старые задачи
        await cache.runQuery('DELETE FROM tasks');
        console.log('✅ Старые задачи удалены из кэша');
        
        // Используем оптимизированный сервис для синхронизации
        const optimizedService = require('./src/services/optimizedNotionService');
        
        // Принудительная синхронизация
        await optimizedService.forceSync();
        
        // Ждем завершения синхронизации
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Проверяем результаты
        const stats = await cache.getCacheStats();
        console.log('\n📊 Статистика кэша после синхронизации:');
        console.log(`- Пользователей: ${stats.users}`);
        console.log(`- Задач: ${stats.tasks}`);
        console.log(`- Отчетов: ${stats.reports}`);
        console.log(`- Записей учета времени: ${stats.attendance}`);
        console.log(`- Размер БД: ${stats.sizeMB} MB`);
        
        // Проверяем задачи с assignee_id
        const tasksWithAssignee = await cache.getOne(
            'SELECT COUNT(*) as count FROM tasks WHERE assignee_id IS NOT NULL'
        );
        console.log(`\n✅ Задач с assignee_id: ${tasksWithAssignee.count}`);
        
        // Проверяем задачи по пользователям
        const userTasks = await cache.getAll(`
            SELECT 
                assignee_name, 
                assignee_id, 
                COUNT(*) as task_count
            FROM tasks 
            WHERE assignee_id IS NOT NULL
            GROUP BY assignee_id, assignee_name
            ORDER BY task_count DESC
        `);
        
        if (userTasks.length > 0) {
            console.log('\n📋 Распределение задач по пользователям:');
            userTasks.forEach(user => {
                console.log(`- ${user.assignee_name}: ${user.task_count} задач`);
            });
        }
        
        console.log('\n✅ Пересинхронизация завершена успешно!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Ошибка при пересинхронизации:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

resyncCache();