#!/usr/bin/env node

/**
 * Скрипт для получения Telegram ID всех сотрудников
 * Запустите для получения маппинга имен на ID
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function getUsersFromCache() {
    console.log('📊 Получаем пользователей из кэша SQLite...\n');
    
    const dbPath = path.join(process.cwd(), 'cache.db');
    const db = new sqlite3.Database(dbPath);
    
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT telegram_id, name, username, position FROM users WHERE is_active = 1 ORDER BY name`,
            [],
            (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
                db.close();
            }
        );
    });
}

async function getUsersFromNotion() {
    console.log('📊 Получаем пользователей из Notion...\n');
    
    try {
        const notionService = require('./src/services/notionService');
        const users = await notionService.getAllActiveUsers();
        return users.map(u => ({
            telegram_id: u.telegramId,
            name: u.name,
            username: u.username,
            position: u.position
        }));
    } catch (error) {
        console.error('Ошибка при получении из Notion:', error.message);
        return [];
    }
}

async function main() {
    console.log('🔍 Поиск Telegram ID сотрудников\n');
    console.log('=' .repeat(50));
    
    let users = [];
    
    // Пробуем получить из кэша
    try {
        users = await getUsersFromCache();
        console.log('✅ Данные получены из локального кэша\n');
    } catch (error) {
        console.log('⚠️ Кэш недоступен, получаем из Notion...');
        users = await getUsersFromNotion();
    }
    
    if (users.length === 0) {
        console.log('❌ Пользователи не найдены');
        console.log('\nУбедитесь что:');
        console.log('1. Бот запущен и синхронизирован');
        console.log('2. Сотрудники зарегистрированы в боте');
        return;
    }
    
    console.log(`Найдено сотрудников: ${users.length}\n`);
    console.log('=' .repeat(50));
    
    // Выводим маппинг для копирования в скрипт импорта
    console.log('\n📋 СКОПИРУЙТЕ ЭТО В import-tasks-from-sheets.js:\n');
    console.log('const USER_MAPPING = {');
    
    const uniqueNames = new Set();
    users.forEach(user => {
        const firstName = user.name.split(' ')[0];
        if (!uniqueNames.has(firstName)) {
            console.log(`    '${firstName}': { telegramId: '${user.telegram_id}', name: '${user.name}' },`);
            uniqueNames.add(firstName);
        }
    });
    
    // Добавляем специальные случаи для совместных задач
    console.log(`    // Совместные задачи (выберите основного исполнителя)`);
    console.log(`    'Борис + Ксения': { telegramId: '${users[0]?.telegram_id || 'ID'}', name: '${users[0]?.name || 'Имя'}' },`);
    console.log(`    'Борис + Иван': { telegramId: '${users[0]?.telegram_id || 'ID'}', name: '${users[0]?.name || 'Имя'}' },`);
    console.log(`    'Максим + Борис': { telegramId: '${users[0]?.telegram_id || 'ID'}', name: '${users[0]?.name || 'Имя'}' },`);
    console.log(`    'Дмитрий + Максим': { telegramId: '${users[0]?.telegram_id || 'ID'}', name: '${users[0]?.name || 'Имя'}' },`);
    console.log(`    'Иван + Борис': { telegramId: '${users[0]?.telegram_id || 'ID'}', name: '${users[0]?.name || 'Имя'}' },`);
    console.log(`    'Борис + Иван + Дмитрий': { telegramId: '${users[0]?.telegram_id || 'ID'}', name: '${users[0]?.name || 'Имя'}' },`);
    console.log(`    'Ксения + Алла': { telegramId: '${users[0]?.telegram_id || 'ID'}', name: '${users[0]?.name || 'Имя'}' },`);
    console.log(`    'Ксения + Алла + Елена': { telegramId: '${users[0]?.telegram_id || 'ID'}', name: '${users[0]?.name || 'Имя'}' },`);
    console.log(`    'Игорь + Борис': { telegramId: '${users[0]?.telegram_id || 'ID'}', name: '${users[0]?.name || 'Имя'}' },`);
    console.log('};');
    
    console.log('\n' + '=' .repeat(50));
    console.log('\n📊 ДЕТАЛЬНАЯ ИНФОРМАЦИЯ:\n');
    
    // Выводим таблицу с информацией
    console.log('Имя'.padEnd(20) + 'Telegram ID'.padEnd(15) + 'Username'.padEnd(20) + 'Должность');
    console.log('-'.repeat(80));
    
    users.forEach(user => {
        console.log(
            (user.name || '-').padEnd(20) + 
            (user.telegram_id || '-').padEnd(15) + 
            ('@' + (user.username || '-')).padEnd(20) + 
            (user.position || '-')
        );
    });
    
    console.log('\n' + '=' .repeat(50));
    console.log('\n✅ Готово! Теперь вы можете:');
    console.log('1. Скопировать USER_MAPPING в файл import-tasks-from-sheets.js');
    console.log('2. Экспортировать таблицу в CSV');
    console.log('3. Запустить импорт: node import-tasks-from-sheets.js --csv tasks.csv');
}

main().catch(console.error);