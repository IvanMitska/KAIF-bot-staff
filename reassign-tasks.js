const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'bot.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Переназначение задач от удаляемых сотрудников');
console.log('================================================\n');

// Сотрудники для удаления и новый исполнитель
const usersToRemove = [
    { id: '726915228', name: 'Елена' },
    { id: '893020643', name: 'Яков' }
];

// Переназначаем на Ксению (менеджер комплекса)
const newAssignee = {
    id: '1151085087',
    name: 'Ксения'
};

db.serialize(() => {
    // Проверяем активные задачи
    const userIds = usersToRemove.map(u => u.id);

    console.log(`📋 Проверяем задачи для переназначения...`);

    db.all(`
        SELECT id, title, assignee_id, assignee_name, status
        FROM tasks
        WHERE assignee_id IN (${userIds.map(() => '?').join(',')})
            AND status NOT IN ('Выполнена', 'Отменена')
    `, userIds, (err, tasks) => {
        if (err) {
            console.error('Ошибка при получении задач:', err);
            db.close();
            return;
        }

        if (!tasks || tasks.length === 0) {
            console.log('✅ Нет активных задач для переназначения');
            db.close();
            return;
        }

        console.log(`\n⚠️ Найдено ${tasks.length} активных задач для переназначения:`);
        console.table(tasks.map(t => ({
            id: t.id.substring(0, 8) + '...',
            title: t.title.substring(0, 40) + (t.title.length > 40 ? '...' : ''),
            assignee: t.assignee_name,
            status: t.status
        })));

        console.log(`\n🔄 Переназначаем все задачи на ${newAssignee.name}...`);

        // Переназначаем задачи
        const updateStmt = db.prepare(`
            UPDATE tasks
            SET assignee_id = ?,
                assignee_name = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        let updated = 0;
        tasks.forEach(task => {
            updateStmt.run(newAssignee.id, newAssignee.name, task.id, function(err) {
                if (err) {
                    console.error(`❌ Ошибка при переназначении задачи ${task.id}:`, err);
                } else {
                    updated++;
                }
            });
        });

        updateStmt.finalize(() => {
            console.log(`\n✅ Переназначено задач: ${updated} из ${tasks.length}`);

            // Проверяем результат
            db.all(`
                SELECT assignee_name, COUNT(*) as count
                FROM tasks
                WHERE status NOT IN ('Выполнена', 'Отменена')
                GROUP BY assignee_name
                ORDER BY count DESC
            `, (err, stats) => {
                if (err) {
                    console.error('Ошибка при получении статистики:', err);
                } else {
                    console.log('\n📊 Текущее распределение активных задач:');
                    console.table(stats);
                }

                console.log('\n✅ Процесс переназначения завершен!');
                console.log('Теперь можно безопасно удалить сотрудников Елена и Яков.');
                db.close();
            });
        });
    });
});