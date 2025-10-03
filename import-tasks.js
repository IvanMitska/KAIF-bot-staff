const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Маппинг имен сотрудников на их ID
const employeeMapping = {
    'Iurii Bugatti': '907672555',
    'Test User': '1515429',
    'Аля': '642664990',
    'Борис': '385436658',
    'Дмитрий': '5937587032',
    'Елена': '726915228',
    'Иван': '1734337242',
    'Игорь': '321654987',
    'Ксения': '1151085087',
    'Максим': '303267717'
};

async function importTasks(csvFilePath) {
    console.log('📝 Импорт задач из CSV файла...\n');

    try {
        // Читаем CSV файл
        const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
        const lines = fileContent.split('\n').filter(line => line.trim());

        // Парсим заголовки
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

        // Проверяем необходимые поля
        const requiredFields = ['title', 'description', 'assignee_name', 'priority', 'status'];
        const missingFields = requiredFields.filter(f => !headers.includes(f));

        if (missingFields.length > 0) {
            throw new Error(`Отсутствуют обязательные поля: ${missingFields.join(', ')}`);
        }

        // Парсим задачи
        const tasks = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Простой CSV парсер для строк с кавычками
            const values = [];
            let current = '';
            let inQuotes = false;

            for (let j = 0; j < line.length; j++) {
                const char = line[j];

                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            values.push(current.trim());

            // Создаем объект задачи
            const task = {};
            headers.forEach((header, index) => {
                task[header] = values[index] || '';
            });

            tasks.push(task);
        }

        console.log(`📊 Найдено задач для импорта: ${tasks.length}\n`);

        // Добавляем задачи в базу
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const task of tasks) {
            // Находим ID сотрудника
            const employeeId = employeeMapping[task.assignee_name];

            if (!employeeId) {
                errorCount++;
                errors.push(`Сотрудник "${task.assignee_name}" не найден в базе`);
                console.log(`❌ Ошибка: Сотрудник "${task.assignee_name}" не найден`);
                continue;
            }

            // Генерируем уникальный ID для задачи
            const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Устанавливаем даты
            const createdDate = new Date('2025-10-03'); // 3 октября 2025
            const deadline = new Date('2025-10-10'); // 10 октября 2025 (через 7 дней)

            try {
                await pool.query(`
                    INSERT INTO tasks (
                        id, task_id, title, description, status, priority,
                        created_date, deadline, creator_name, creator_id,
                        assignee_id, assignee_name, synced
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                `, [
                    taskId,
                    taskId,
                    task.title,
                    task.description || '',
                    task.status || 'Новая',
                    task.priority || 'Средний',
                    createdDate,
                    deadline,
                    'Admin',
                    '0',
                    employeeId,
                    task.assignee_name,
                    false
                ]);

                successCount++;
                console.log(`✅ Добавлена задача: "${task.title}" для ${task.assignee_name}`);
            } catch (error) {
                errorCount++;
                errors.push(`Ошибка при добавлении "${task.title}": ${error.message}`);
                console.log(`❌ Ошибка при добавлении "${task.title}": ${error.message}`);
            }
        }

        // Выводим итоги
        console.log('\n📊 Итоги импорта:');
        console.log(`✅ Успешно добавлено: ${successCount}`);
        console.log(`❌ Ошибок: ${errorCount}`);

        if (errors.length > 0) {
            console.log('\n⚠️ Детали ошибок:');
            errors.forEach(err => console.log(`  - ${err}`));
        }

    } catch (error) {
        console.error('❌ Критическая ошибка:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

// Проверяем аргументы командной строки
const csvPath = process.argv[2];

if (!csvPath) {
    console.log('❌ Укажите путь к CSV файлу');
    console.log('Использование: node import-tasks.js путь/к/файлу.csv');
    console.log('\nПример CSV формата (tasks-template.csv):');
    console.log('title,description,assignee_name,priority,status');
    console.log('"Задача 1","Описание задачи 1","Иван","Высокий","Новая"');
    console.log('"Задача 2","Описание задачи 2","Борис","Средний","Новая"');
    console.log('\nДоступные сотрудники:');
    Object.keys(employeeMapping).forEach(name => {
        console.log(`  - ${name}`);
    });
    process.exit(1);
}

// Проверяем существование файла
if (!fs.existsSync(csvPath)) {
    console.error(`❌ Файл не найден: ${csvPath}`);
    process.exit(1);
}

// Запускаем импорт
importTasks(csvPath);