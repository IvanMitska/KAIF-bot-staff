const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function cleanDuplicates() {
    console.log('🧹 Очистка дублированных задач...\n');

    try {
        // Находим все временные задачи (с ID начинающимся с 'task-')
        const tempTasksResult = await pool.query(`
            SELECT id, title, assignee_id, created_date
            FROM tasks
            WHERE id LIKE 'task-%'
            ORDER BY created_date DESC
        `);

        console.log(`📋 Найдено временных задач: ${tempTasksResult.rows.length}`);

        if (tempTasksResult.rows.length > 0) {
            console.log('\n🗑️ Удаление временных задач...');

            // Удаляем все временные задачи
            const deleteResult = await pool.query(`
                DELETE FROM tasks
                WHERE id LIKE 'task-%'
            `);

            console.log(`✅ Удалено временных задач: ${deleteResult.rowCount}`);
        }

        // Проверяем оставшиеся задачи
        const remainingResult = await pool.query(`
            SELECT COUNT(*) as count FROM tasks
        `);

        console.log(`\n📊 Всего задач после очистки: ${remainingResult.rows[0].count}`);

        // Показываем несколько примеров оставшихся задач
        const samplesResult = await pool.query(`
            SELECT id, title, assignee_name, status, created_date
            FROM tasks
            ORDER BY created_date DESC
            LIMIT 5
        `);

        console.log('\n📋 Примеры оставшихся задач:');
        samplesResult.rows.forEach((task, i) => {
            console.log(`${i + 1}. ${task.title} (${task.assignee_name}) - ${task.status}`);
            console.log(`   ID: ${task.id}`);
        });

    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    } finally {
        await pool.end();
    }
}

cleanDuplicates();