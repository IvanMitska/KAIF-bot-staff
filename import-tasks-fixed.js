#!/usr/bin/env node

/**
 * Улучшенный скрипт для импорта задач из CSV с корректной обработкой многострочных полей
 */

require('dotenv').config();
const fs = require('fs').promises;

// Используем оптимизированный сервис или обычный
let notionService;
try {
    notionService = require('./src/services/optimizedNotionService');
    console.log('Using optimized Notion service');
} catch (error) {
    notionService = require('./src/services/notionService');
    console.log('Using regular Notion service');
}

// Маппинг имен из таблицы на Telegram ID
const USER_MAPPING = {
    'Ксения': { telegramId: '1151085087', name: 'Ксения' },
    'Борис': { telegramId: '385436658', name: 'Борис' },
    'Иван': { telegramId: '1734337242', name: 'Иван' },
    'Игорь': { telegramId: '321654987', name: 'Игорь' },
    'Максим': { telegramId: '303267717', name: 'Максим' },
    'Дмитрий': { telegramId: '5937587032', name: 'Дмитрий' },
    'Алла': { telegramId: '642664990', name: 'Аля' },
    'Аля': { telegramId: '642664990', name: 'Аля' },
    'Елена': { telegramId: '726915228', name: 'Елена' },
    'Яков': { telegramId: '893020643', name: 'Яков' },
    // Совместные задачи - назначаем на основного исполнителя
    'Борис + Ксения': { telegramId: '385436658', name: 'Борис' },
    'Ксения + Борис': { telegramId: '1151085087', name: 'Ксения' },
    'Борис + Иван': { telegramId: '385436658', name: 'Борис' },
    'Максим + Борис': { telegramId: '303267717', name: 'Максим' },
    'Дмитрий + Максим': { telegramId: '5937587032', name: 'Дмитрий' },
    'Иван + Борис': { telegramId: '1734337242', name: 'Иван' },
    'Борис + Иван + Дмитрий': { telegramId: '385436658', name: 'Борис' },
    'Ксения + Алла': { telegramId: '1151085087', name: 'Ксения' },
    'Ксения + Аля': { telegramId: '1151085087', name: 'Ксения' },
    'Ксения + Алла + Елена': { telegramId: '1151085087', name: 'Ксения' },
    'Игорь + Борис': { telegramId: '385436658', name: 'Борис' },
    'Борис + Игорь': { telegramId: '385436658', name: 'Борис' }
};

/**
 * Парсит дату из строки формата "18.08" или "1-2 недели"
 */
function parseDeadline(dateStr) {
    if (!dateStr) return null;
    
    const today = new Date();
    const year = today.getFullYear();
    
    console.log(`  Парсинг срока: "${dateStr}"`);
    
    // Проверяем формат DD.MM
    if (dateStr.match(/^\d{1,2}\.\d{2}$/)) {
        const [day, month] = dateStr.split('.');
        const deadline = new Date(year, parseInt(month) - 1, parseInt(day));
        
        // Если дата уже прошла, возможно это следующий год
        if (deadline < today) {
            deadline.setFullYear(year + 1);
        }
        
        const result = deadline.toISOString().split('T')[0];
        console.log(`    -> Конкретная дата: ${result}`);
        return result;
    }
    
    // Проверяем "X недели/недель" или "X–Y недели"
    if (dateStr.includes('недел')) {
        // Извлекаем максимальное число недель (берем большее из диапазона)
        const matches = dateStr.match(/\d+/g);
        const weeks = matches ? Math.max(...matches.map(n => parseInt(n))) : 1;
        const deadline = new Date(today);
        deadline.setDate(deadline.getDate() + (weeks * 7));
        const result = deadline.toISOString().split('T')[0];
        console.log(`    -> ${weeks} недель от сегодня: ${result}`);
        return result;
    }
    
    // Проверяем "X дней/дня" или "X–Y дней"
    if (dateStr.includes('дн')) {
        const matches = dateStr.match(/\d+/g);
        const days = matches ? Math.max(...matches.map(n => parseInt(n))) : 1;
        const deadline = new Date(today);
        deadline.setDate(deadline.getDate() + days);
        const result = deadline.toISOString().split('T')[0];
        console.log(`    -> ${days} дней от сегодня: ${result}`);
        return result;
    }
    
    // Проверяем "Постоянно" или "сразу"
    if (dateStr.toLowerCase().includes('постоянно') || dateStr.toLowerCase().includes('сразу')) {
        // Для срочных/постоянных задач ставим дедлайн через 3 дня
        const deadline = new Date(today);
        deadline.setDate(deadline.getDate() + 3);
        const result = deadline.toISOString().split('T')[0];
        console.log(`    -> Срочная задача: ${result}`);
        return result;
    }
    
    // По умолчанию - через неделю
    const defaultDeadline = new Date(today);
    defaultDeadline.setDate(defaultDeadline.getDate() + 7);
    const result = defaultDeadline.toISOString().split('T')[0];
    console.log(`    -> По умолчанию (7 дней): ${result}`);
    return result;
}

/**
 * Правильный парсер CSV с поддержкой многострочных полей
 */
function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        
        if (char === '"') {
            if (inQuotes) {
                if (nextChar === '"') {
                    // Экранированная кавычка
                    currentField += '"';
                    i++; // Пропускаем следующую кавычку
                } else {
                    // Конец поля в кавычках
                    inQuotes = false;
                }
            } else {
                // Начало поля в кавычках
                inQuotes = true;
            }
        } else if (char === ',' && !inQuotes) {
            // Конец поля
            currentRow.push(currentField);
            currentField = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            // Конец строки
            if (char === '\r' && nextChar === '\n') {
                i++; // Пропускаем \n после \r
            }
            if (currentField || currentRow.length > 0) {
                currentRow.push(currentField);
                rows.push(currentRow);
                currentRow = [];
                currentField = '';
            }
        } else {
            // Обычный символ
            currentField += char;
        }
    }
    
    // Добавляем последнее поле и строку
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
    }
    
    return rows;
}

/**
 * Импортирует задачи из CSV файла
 */
async function importFromCSV(filePath) {
    console.log('\n📄 Чтение CSV файла...');
    
    try {
        const csvContent = await fs.readFile(filePath, 'utf8');
        const rows = parseCSV(csvContent);
        
        console.log(`✅ Распарсено строк: ${rows.length}`);
        
        // Пропускаем заголовок
        const dataRows = rows.slice(1);
        
        console.log(`\n📥 Найдено задач для импорта: ${dataRows.length}`);
        console.log('=' .repeat(50));
        
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            
            // Извлекаем данные из строки (индексы колонок)
            const [
                category,       // 0 - Категория
                taskTitle,      // 1 - Задача
                details,        // 2 - Детали/шаги
                dateCreated,    // 3 - Дата постановки
                deadline,       // 4 - Примерный срок
                assignee,       // 5 - Ответственный
                priority,       // 6 - Приоритет
                comment,        // 7 - Комментарий от исполнителя
                result,         // 8 - Результат
                status          // 9 - Статус
            ] = row;
            
            // Очищаем значения от лишних пробелов
            const cleanTitle = taskTitle?.trim();
            const cleanAssignee = assignee?.trim();
            
            // Пропускаем задачи без названия или исполнителя
            if (!cleanTitle || !cleanAssignee) {
                console.log(`⏭️  Строка ${i + 2}: пропущена (нет названия или исполнителя)`);
                continue;
            }
            
            // Пропускаем выполненные задачи
            if (status && (status.toLowerCase().includes('выполнен') || status.toLowerCase().includes('готов'))) {
                console.log(`✅ Строка ${i + 2}: пропущена (уже выполнена)`);
                continue;
            }
            
            // Находим исполнителя
            let user = USER_MAPPING[cleanAssignee];
            
            if (!user) {
                // Пробуем найти по первому имени
                const firstName = cleanAssignee.split(' ')[0].trim();
                user = USER_MAPPING[firstName];
            }
            
            if (!user) {
                console.log(`⚠️  Строка ${i + 2}: не найден пользователь "${cleanAssignee}"`);
                errors.push(`Строка ${i + 2}: не найден пользователь "${cleanAssignee}"`);
                errorCount++;
                continue;
            }
            
            try {
                // Формируем описание задачи
                let description = '';
                if (details && details.trim()) {
                    description += `📋 Детали: ${details.trim()}\n\n`;
                }
                if (result && result.trim() && result !== '0') {
                    description += `🎯 Ожидаемый результат: ${result.trim()}\n\n`;
                }
                if (category && category.trim()) {
                    description += `📁 Категория: ${category.trim()}`;
                }
                
                // Определяем приоритет
                let taskPriority = 'Средний';
                if (priority) {
                    const priorityLower = priority.toLowerCase();
                    if (priorityLower.includes('высок') || priorityLower.includes('срочн')) {
                        taskPriority = 'Высокий';
                    } else if (priorityLower.includes('низк')) {
                        taskPriority = 'Низкий';
                    }
                }
                
                // Парсим дедлайн
                const taskDeadline = parseDeadline(deadline) || parseDeadline(dateCreated);
                
                // Создаем задачу
                const taskData = {
                    title: cleanTitle,
                    description: description.trim() || 'Без описания',
                    assigneeId: user.telegramId,
                    assigneeName: user.name,
                    creatorId: 'import_script',
                    creatorName: 'Импорт из таблицы',
                    status: 'Новая',
                    priority: taskPriority,
                    deadline: taskDeadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                };
                
                console.log(`\n📝 Создаем задачу ${i + 2}/${dataRows.length}:`);
                console.log(`   Название: ${cleanTitle}`);
                console.log(`   Исполнитель: ${user.name} (${user.telegramId})`);
                console.log(`   Приоритет: ${taskPriority}`);
                console.log(`   Дедлайн: ${taskData.deadline}`);
                
                await notionService.createTask(taskData);
                
                successCount++;
                console.log(`   ✅ Успешно создана!`);
                
                // Небольшая задержка чтобы не перегружать API
                await new Promise(resolve => setTimeout(resolve, 300));
                
            } catch (error) {
                console.log(`   ❌ Ошибка: ${error.message}`);
                errors.push(`Строка ${i + 2}: ${error.message}`);
                errorCount++;
            }
        }
        
        // Итоговая статистика
        console.log('\n' + '='.repeat(50));
        console.log('📊 РЕЗУЛЬТАТЫ ИМПОРТА:');
        console.log('='.repeat(50));
        console.log(`✅ Успешно импортировано: ${successCount} задач`);
        console.log(`❌ Ошибок: ${errorCount}`);
        
        if (errors.length > 0) {
            console.log('\n⚠️ Детали ошибок:');
            errors.forEach(err => console.log(`   - ${err}`));
        }
        
    } catch (error) {
        console.error('❌ Ошибка при чтении CSV файла:', error.message);
    }
}

/**
 * Главная функция
 */
async function main() {
    console.log('🚀 Запуск улучшенного импорта задач из CSV');
    console.log('=' .repeat(50));
    
    const args = process.argv.slice(2);
    
    if (args[0] === '--help' || !args[0]) {
        console.log('\nИспользование:');
        console.log('  node import-tasks-fixed.js <file.csv>');
        console.log('\nПример:');
        console.log('  node import-tasks-fixed.js "/Users/ivan/Downloads/Задачи КАЙФ - Август.csv"');
        return;
    }
    
    await importFromCSV(args[0]);
}

// Запускаем скрипт
main().catch(console.error);