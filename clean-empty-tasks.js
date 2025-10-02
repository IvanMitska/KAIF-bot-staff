const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const TASKS_DB_ID = process.env.NOTION_DATABASE_TASKS_ID;

async function cleanEmptyTasks() {
    console.log('🧹 Очистка пустых задач из базы данных...\n');

    try {
        const response = await notion.databases.query({
            database_id: TASKS_DB_ID,
            page_size: 100
        });

        const tasks = response.results;
        console.log(`📊 Всего задач в базе: ${tasks.length}\n`);

        const emptyTasks = [];
        const validTasks = [];

        tasks.forEach(task => {
            const title = task.properties['Задача']?.title?.[0]?.plain_text || '';
            const assignee = task.properties['Исполнитель']?.people?.[0];
            const deadline = task.properties['Дедлайн']?.date?.start;

            // Проверяем, пустая ли задача
            if (!title.trim() && !assignee && !deadline) {
                emptyTasks.push({
                    id: task.id,
                    created: task.created_time,
                    status: task.properties['Статус']?.select?.name || 'Нет статуса'
                });
            } else {
                validTasks.push({
                    id: task.id,
                    title: title || 'Без названия',
                    assignee: assignee?.name || 'Не назначен',
                    deadline: deadline || 'Нет срока',
                    status: task.properties['Статус']?.select?.name || 'Нет статуса'
                });
            }
        });

        console.log(`✅ Валидных задач: ${validTasks.length}`);
        console.log(`❌ Пустых задач: ${emptyTasks.length}\n`);

        if (validTasks.length > 0) {
            console.log('📋 Примеры валидных задач:');
            validTasks.slice(0, 5).forEach((task, i) => {
                console.log(`${i + 1}. ${task.title} (${task.assignee}) - ${task.status}`);
            });
            console.log('');
        }

        if (emptyTasks.length === 0) {
            console.log('✅ Пустых задач не найдено!');
            return;
        }

        console.log(`⚠️  ВНИМАНИЕ: Будет удалено ${emptyTasks.length} пустых задач`);
        console.log('Первые 5 для проверки:');
        emptyTasks.slice(0, 5).forEach((task, i) => {
            console.log(`${i + 1}. ID: ${task.id.slice(0, 20)}... (${task.status}) - Создано: ${task.created}`);
        });
        console.log('\n⏳ Начинаю удаление через 3 секунды...\n');

        await new Promise(resolve => setTimeout(resolve, 3000));

        let deleted = 0;
        for (const task of emptyTasks) {
            try {
                await notion.pages.update({
                    page_id: task.id,
                    archived: true
                });
                deleted++;
                if (deleted % 10 === 0) {
                    console.log(`📦 Удалено ${deleted}/${emptyTasks.length}...`);
                }
            } catch (error) {
                console.error(`❌ Ошибка при удалении ${task.id}:`, error.message);
            }
        }

        console.log(`\n✅ Удаление завершено!`);
        console.log(`📊 Успешно удалено: ${deleted} задач`);
        console.log(`📋 Осталось валидных задач: ${validTasks.length}`);

    } catch (error) {
        console.error('❌ Ошибка при очистке:', error.message);
    }
}

cleanEmptyTasks();
