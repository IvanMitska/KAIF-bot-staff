const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function createTestTask() {
    console.log('📝 Создание тестовой задачи...\n');

    try {
        // Для тестирования используем один из реальных ID из базы
        // Или создадим для нескольких тестовых пользователей
        const testUsers = [
            { id: '385436658', name: 'Борис' },
            { id: '1151085087', name: 'Ксения' },
            { id: '1734337242', name: 'Иван' }
        ];

        for (const user of testUsers) {
            const taskId = `test-task-${Date.now()}-${user.id}`;

            await pool.query(`
                INSERT INTO tasks (
                    id, task_id, title, description, status, priority,
                    created_date, deadline, creator_name, creator_id,
                    assignee_id, assignee_name
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, [
                taskId,
                taskId,
                'Тестовая задача для проверки модального окна',
                'Это тестовая задача для проверки открытия модального окна при клике. После тестирования её можно удалить.',
                'Новая',
                'Средний',
                new Date(),
                new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // через неделю
                'Система',
                '0',
                user.id,
                user.name
            ]);

            console.log(`✅ Создана задача для ${user.name} (ID: ${user.id})`);
        }

        console.log('\n📊 Всего создано тестовых задач: ' + testUsers.length);
        console.log('\n💡 Теперь войдите как один из этих пользователей и попробуйте кликнуть на задачу');

    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

createTestTask();
