#!/usr/bin/env node

/**
 * Скрипт для импорта задач из Google Sheets в Notion
 * Автоматически создает задачи и назначает их правильным исполнителям
 */

require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

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
// Реальные ID из вашей базы данных
const USER_MAPPING = {
    'Ксения': { telegramId: '1151085087', name: 'Ксения' },
    'Борис': { telegramId: '385436658', name: 'Борис' },
    'Иван': { telegramId: '1734337242', name: 'Иван' },
    'Игорь': { telegramId: '321654987', name: 'Игорь' }, // Нужно уточнить ID
    'Максим': { telegramId: '303267717', name: 'Максим' },
    'Дмитрий': { telegramId: '5937587032', name: 'Дмитрий' },
    'Алла': { telegramId: '642664990', name: 'Аля' },
    'Аля': { telegramId: '642664990', name: 'Аля' },
    'Елена': { telegramId: '726915228', name: 'Елена' },
    'Яков': { telegramId: '893020643', name: 'Яков' },
    // Совместные задачи - назначаем на основного исполнителя
    'Борис + Ксения': { telegramId: '385436658', name: 'Борис' },
    'Борис + Иван': { telegramId: '385436658', name: 'Борис' },
    'Максим + Борис': { telegramId: '303267717', name: 'Максим' },
    'Дмитрий + Максим': { telegramId: '5937587032', name: 'Дмитрий' },
    'Иван + Борис': { telegramId: '1734337242', name: 'Иван' },
    'Борис + Иван + Дмитрий': { telegramId: '385436658', name: 'Борис' },
    'Ксения + Алла': { telegramId: '1151085087', name: 'Ксения' },
    'Ксения + Алла + Елена': { telegramId: '1151085087', name: 'Ксения' },
    'Ксения + Аля': { telegramId: '1151085087', name: 'Ксения' },
    'Игорь + Борис': { telegramId: '385436658', name: 'Борис' }
};

// Маппинг приоритетов
const PRIORITY_MAPPING = {
    'Высокий': 'Высокий',
    'Средний': 'Средний', 
    'Низкий': 'Низкий'
};

// Маппинг статусов
const STATUS_MAPPING = {
    'Не внесено в бот': 'Новая',
    'Средний': 'Новая',
    'Высокий': 'Новая'
};

// Конфигурация Google Sheets
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'; // Замените на ID вашей таблицы
const RANGE = 'A2:J100'; // Диапазон с данными (без заголовков)

/**
 * Парсит дату из строки формата "18.08" или "1-2 недели"
 */
function parseDeadline(dateStr) {
    if (!dateStr) return null;
    
    const today = new Date();
    const year = today.getFullYear();
    
    // Проверяем формат DD.MM
    if (dateStr.match(/^\d{1,2}\.\d{2}$/)) {
        const [day, month] = dateStr.split('.');
        const deadline = new Date(year, parseInt(month) - 1, parseInt(day));
        
        // Если дата уже прошла, возможно это следующий год
        if (deadline < today) {
            deadline.setFullYear(year + 1);
        }
        
        return deadline.toISOString().split('T')[0];
    }
    
    // Проверяем "X недели/недель"
    if (dateStr.includes('недел')) {
        const weeks = parseInt(dateStr.match(/\d+/)?.[0] || '1');
        const deadline = new Date(today);
        deadline.setDate(deadline.getDate() + (weeks * 7));
        return deadline.toISOString().split('T')[0];
    }
    
    // Проверяем "X дней/дня"  
    if (dateStr.includes('дн')) {
        const days = parseInt(dateStr.match(/\d+/)?.[0] || '1');
        const deadline = new Date(today);
        deadline.setDate(deadline.getDate() + days);
        return deadline.toISOString().split('T')[0];
    }
    
    return null;
}

/**
 * Получает данные из Google Sheets
 */
async function getDataFromSheets() {
    console.log('\n📊 Подключаемся к Google Sheets...');
    
    // Загружаем credentials из файла
    const credentialsPath = path.join(__dirname, 'google-credentials.json');
    
    try {
        const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
        
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
        });
        
        const sheets = google.sheets({ version: 'v4', auth });
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: RANGE
        });
        
        return response.data.values;
    } catch (error) {
        console.error('❌ Ошибка при получении данных из Google Sheets:', error.message);
        console.log('\n⚠️  Для работы с Google Sheets необходимо:');
        console.log('1. Создать Service Account в Google Cloud Console');
        console.log('2. Скачать JSON ключ и сохранить как google-credentials.json');
        console.log('3. Дать доступ Service Account к вашей таблице');
        console.log('4. Указать SPREADSHEET_ID в скрипте');
        return null;
    }
}

/**
 * Импортирует задачи из массива данных
 */
async function importTasks(rows) {
    if (!rows || rows.length === 0) {
        console.log('⚠️ Нет данных для импорта');
        return;
    }
    
    console.log(`\n📥 Найдено ${rows.length} задач для импорта`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        // Извлекаем данные из строки
        const [
            category,       // Колонка A - Категория (Маркетинг/Бар/Операционка)
            taskTitle,      // Колонка B - Задача
            details,        // Колонка C - Детали/шаги
            deadline,       // Колонка D - Дата постановки или срок
            priority,       // Колонка E - Примерный срок
            assignee,       // Колонка F - Ответственный
            _,              // Колонка G - Приоритет (цвет)
            result,         // Колонка H - Результат
            status          // Колонка I - Статус
        ] = row;
        
        // Пропускаем задачи без названия или исполнителя
        if (!taskTitle || !assignee) {
            console.log(`⏭️  Строка ${i + 2}: пропущена (нет названия или исполнителя)`);
            continue;
        }
        
        // Пропускаем выполненные задачи
        if (status && status.toLowerCase().includes('выполнен')) {
            console.log(`✅ Строка ${i + 2}: пропущена (уже выполнена)`);
            continue;
        }
        
        // Находим исполнителя
        const assigneeFirstName = assignee.split(' ')[0].trim();
        const user = USER_MAPPING[assigneeFirstName];
        
        if (!user) {
            console.log(`⚠️  Строка ${i + 2}: не найден пользователь "${assigneeFirstName}"`);
            errors.push(`Строка ${i + 2}: не найден пользователь "${assigneeFirstName}"`);
            errorCount++;
            continue;
        }
        
        try {
            // Формируем описание задачи
            let description = '';
            if (details) {
                description += `📋 Детали: ${details}\n\n`;
            }
            if (result) {
                description += `🎯 Ожидаемый результат: ${result}\n\n`;
            }
            if (category) {
                description += `📁 Категория: ${category}`;
            }
            
            // Определяем приоритет
            let taskPriority = 'Средний';
            if (priority) {
                if (priority.includes('Высок') || priority.includes('срочн')) {
                    taskPriority = 'Высокий';
                } else if (priority.includes('Низк')) {
                    taskPriority = 'Низкий';
                }
            }
            
            // Парсим дедлайн
            const taskDeadline = parseDeadline(deadline) || parseDeadline(priority);
            
            // Создаем задачу
            const taskData = {
                title: taskTitle,
                description: description.trim() || 'Без описания',
                assigneeId: user.telegramId,
                assigneeName: user.name,
                creatorId: 'import_script',
                creatorName: 'Импорт из Google Sheets',
                status: 'Новая',
                priority: taskPriority,
                deadline: taskDeadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // По умолчанию через неделю
            };
            
            console.log(`\n📝 Создаем задачу ${i + 2}/${rows.length}:`);
            console.log(`   Название: ${taskTitle}`);
            console.log(`   Исполнитель: ${user.name} (${user.telegramId})`);
            console.log(`   Приоритет: ${taskPriority}`);
            console.log(`   Дедлайн: ${taskData.deadline}`);
            
            await notionService.createTask(taskData);
            
            successCount++;
            console.log(`   ✅ Успешно создана!`);
            
            // Небольшая задержка чтобы не перегружать API
            await new Promise(resolve => setTimeout(resolve, 500));
            
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
}

/**
 * Альтернативный метод: импорт из CSV файла
 */
async function importFromCSV(filePath) {
    console.log('\n📄 Импорт из CSV файла...');
    
    try {
        const csvContent = await fs.readFile(filePath, 'utf8');
        const rows = [];
        
        // Используем более надежный парсер для CSV с кавычками и переносами строк
        const lines = [];
        let currentLine = '';
        let inQuotes = false;
        
        for (let i = 0; i < csvContent.length; i++) {
            const char = csvContent[i];
            const nextChar = csvContent[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Экранированная кавычка
                    currentLine += '"';
                    i++; // Пропускаем следующую кавычку
                } else {
                    // Переключаем режим кавычек
                    inQuotes = !inQuotes;
                }
            } else if (char === '\n' && !inQuotes) {
                // Конец строки (не внутри кавычек)
                lines.push(currentLine);
                currentLine = '';
            } else {
                currentLine += char;
            }
        }
        
        // Добавляем последнюю строку если она не пустая
        if (currentLine.trim()) {
            lines.push(currentLine);
        }
        
        // Парсим каждую строку
        for (let i = 1; i < lines.length; i++) { // Пропускаем заголовок
            const line = lines[i].trim();
            if (!line) continue;
            
            const row = [];
            let currentField = '';
            let inQuotes = false;
            
            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                const nextChar = line[j + 1];
                
                if (char === '"') {
                    if (inQuotes && nextChar === '"') {
                        currentField += '"';
                        j++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    row.push(currentField.trim());
                    currentField = '';
                } else {
                    currentField += char;
                }
            }
            
            // Добавляем последнее поле
            row.push(currentField.trim());
            
            // Добавляем строку если она содержит данные
            if (row.length > 1 && row.some(field => field)) {
                rows.push(row);
            }
        }
        
        console.log(`Распарсено строк: ${rows.length}`);
        await importTasks(rows);
    } catch (error) {
        console.error('❌ Ошибка при чтении CSV файла:', error.message);
    }
}

/**
 * Главная функция
 */
async function main() {
    console.log('🚀 Запуск импорта задач из Google Sheets в Notion');
    console.log('=' .repeat(50));
    
    // Проверяем аргументы командной строки
    const args = process.argv.slice(2);
    
    if (args[0] === '--csv' && args[1]) {
        // Импорт из CSV файла
        await importFromCSV(args[1]);
    } else if (args[0] === '--help') {
        console.log('\nИспользование:');
        console.log('  node import-tasks-from-sheets.js           - импорт из Google Sheets');
        console.log('  node import-tasks-from-sheets.js --csv file.csv - импорт из CSV файла');
        console.log('\nПеред использованием:');
        console.log('1. Обновите USER_MAPPING с реальными Telegram ID');
        console.log('2. Для Google Sheets: настройте google-credentials.json и SPREADSHEET_ID');
        console.log('3. Для CSV: экспортируйте таблицу в CSV формат');
    } else {
        // Импорт из Google Sheets
        const data = await getDataFromSheets();
        if (data) {
            await importTasks(data);
        } else {
            console.log('\n💡 Альтернативный вариант:');
            console.log('Экспортируйте таблицу в CSV и используйте:');
            console.log('node import-tasks-from-sheets.js --csv tasks.csv');
        }
    }
}

// Запускаем скрипт
main().catch(console.error);