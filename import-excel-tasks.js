const { Pool } = require('pg');
const XLSX = require('xlsx');
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

async function checkDuplicateTask(title, assigneeId) {
    const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM tasks
        WHERE LOWER(title) = LOWER($1)
        AND assignee_id = $2
    `, [title, assigneeId]);

    return result.rows[0].count > 0;
}

async function importExcelTasks(excelFilePath) {
    console.log('📝 Импорт задач из Excel файла...\n');

    try {
        // Читаем Excel файл
        const workbook = XLSX.readFile(excelFilePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Конвертируем в JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Проверяем наличие данных
        if (jsonData.length < 2) {
            throw new Error('Файл не содержит данных или имеет неправильный формат');
        }

        // Получаем заголовки (первая строка)
        const headers = jsonData[0].map(h => h ? h.toString().trim() : '');
        console.log('📋 Найденные колонки:', headers);

        // Ищем нужные колонки (могут быть на русском или английском)
        const titleIndex = headers.findIndex(h =>
            h.toLowerCase().includes('задач') ||
            h.toLowerCase().includes('title') ||
            h.toLowerCase().includes('название')
        );

        const descIndex = headers.findIndex(h =>
            h.toLowerCase().includes('описание') ||
            h.toLowerCase().includes('description')
        );

        const assigneeIndex = headers.findIndex(h =>
            h.toLowerCase().includes('исполнитель') ||
            h.toLowerCase().includes('сотрудник') ||
            h.toLowerCase().includes('assignee') ||
            h.toLowerCase().includes('ответственный')
        );

        const priorityIndex = headers.findIndex(h =>
            h.toLowerCase().includes('приоритет') ||
            h.toLowerCase().includes('priority')
        );

        const statusIndex = headers.findIndex(h =>
            h.toLowerCase().includes('статус') ||
            h.toLowerCase().includes('status')
        );

        if (titleIndex === -1) {
            throw new Error('Не найдена колонка с названием задач');
        }

        if (assigneeIndex === -1) {
            throw new Error('Не найдена колонка с исполнителями');
        }

        console.log('\n📊 Обработка данных...\n');

        let successCount = 0;
        let duplicateCount = 0;
        let errorCount = 0;
        const errors = [];

        // Обрабатываем каждую строку (начиная со второй)
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];

            // Пропускаем пустые строки
            if (!row || row.length === 0 || !row[titleIndex]) {
                continue;
            }

            const title = row[titleIndex] ? row[titleIndex].toString().trim() : '';
            const description = descIndex !== -1 && row[descIndex] ? row[descIndex].toString().trim() : '';
            const assigneeName = row[assigneeIndex] ? row[assigneeIndex].toString().trim() : '';
            const priority = priorityIndex !== -1 && row[priorityIndex] ? row[priorityIndex].toString().trim() : 'Средний';
            const status = statusIndex !== -1 && row[statusIndex] ? row[statusIndex].toString().trim() : 'Новая';

            // Пропускаем строки без названия или исполнителя
            if (!title || !assigneeName) {
                continue;
            }

            // Находим ID сотрудника
            const employeeId = employeeMapping[assigneeName];

            if (!employeeId) {
                errorCount++;
                errors.push(`Строка ${i + 1}: Сотрудник "${assigneeName}" не найден в базе`);
                console.log(`❌ Строка ${i + 1}: Сотрудник "${assigneeName}" не найден`);
                continue;
            }

            // Проверяем на дубликат
            const isDuplicate = await checkDuplicateTask(title, employeeId);

            if (isDuplicate) {
                duplicateCount++;
                console.log(`⚠️  Пропущена (дубликат): "${title}" для ${assigneeName}`);
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
                    title,
                    description,
                    status,
                    priority,
                    createdDate,
                    deadline,
                    'Admin',
                    '0',
                    employeeId,
                    assigneeName,
                    false
                ]);

                successCount++;
                console.log(`✅ Добавлена: "${title}" для ${assigneeName}`);

                // Небольшая задержка между вставками
                await new Promise(resolve => setTimeout(resolve, 50));

            } catch (error) {
                errorCount++;
                errors.push(`Строка ${i + 1}: Ошибка при добавлении "${title}": ${error.message}`);
                console.log(`❌ Строка ${i + 1}: Ошибка при добавлении "${title}": ${error.message}`);
            }
        }

        // Выводим итоги
        console.log('\n' + '='.repeat(50));
        console.log('📊 ИТОГИ ИМПОРТА:');
        console.log('='.repeat(50));
        console.log(`✅ Успешно добавлено: ${successCount}`);
        console.log(`⚠️  Пропущено дубликатов: ${duplicateCount}`);
        console.log(`❌ Ошибок: ${errorCount}`);
        console.log('='.repeat(50));

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
const excelPath = process.argv[2];

if (!excelPath) {
    console.log('❌ Укажите путь к Excel файлу');
    console.log('Использование: node import-excel-tasks.js путь/к/файлу.xlsx');
    console.log('\nОжидаемый формат Excel:');
    console.log('- Колонка "Задача" или "Title" - название задачи');
    console.log('- Колонка "Исполнитель" или "Assignee" - имя сотрудника');
    console.log('- Колонка "Описание" (опционально)');
    console.log('- Колонка "Приоритет" (опционально, по умолчанию: Средний)');
    console.log('- Колонка "Статус" (опционально, по умолчанию: Новая)');
    console.log('\nДоступные сотрудники:');
    Object.keys(employeeMapping).forEach(name => {
        console.log(`  - ${name}`);
    });
    process.exit(1);
}

// Проверяем существование файла
if (!fs.existsSync(excelPath)) {
    console.error(`❌ Файл не найден: ${excelPath}`);
    process.exit(1);
}

// Запускаем импорт
importExcelTasks(excelPath);