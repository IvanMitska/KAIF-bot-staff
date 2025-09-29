const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Подключаемся к базе данных
const dbPath = path.join(__dirname, 'bot.db');
const db = new sqlite3.Database(dbPath);

console.log('🗑️ Удаление сотрудников Елена и Яков из системы');
console.log('================================================');

// ID пользователей для удаления
const usersToRemove = [
    { telegramId: '726915228', name: 'Елена' },
    { telegramId: '893020643', name: 'Яков' }
];

db.serialize(() => {
    // Проверяем текущих пользователей
    console.log('\n📋 Текущие пользователи в базе:');
    db.all("SELECT telegram_id, name, position FROM users ORDER BY name", (err, rows) => {
        if (err) {
            console.error('Ошибка при получении пользователей:', err);
            return;
        }

        console.table(rows);

        // Проверяем наличие пользователей для удаления
        const existingUsers = rows.filter(row =>
            usersToRemove.some(user => user.telegramId === row.telegram_id)
        );

        if (existingUsers.length === 0) {
            console.log('\n✅ Пользователи Елена и Яков не найдены в базе.');
            console.log('Возможно, они уже были удалены ранее.');
            db.close();
            return;
        }

        console.log('\n⚠️ Найдены пользователи для удаления:');
        console.table(existingUsers);

        // Сначала проверим, есть ли у них активные задачи
        const userIds = existingUsers.map(u => u.telegram_id).join(',');

        db.all(`
            SELECT
                t.id,
                t.title,
                t.status,
                t.assignee_name as assignee
            FROM tasks t
            WHERE t.assignee_id IN (${userIds.split(',').map(() => '?').join(',')})
                AND t.status != 'Выполнена'
        `, userIds.split(','), (err, tasks) => {
            if (err) {
                console.error('Ошибка при проверке задач:', err);
                db.close();
                return;
            }

            if (tasks && tasks.length > 0) {
                console.log('\n⚠️ ВНИМАНИЕ! У этих пользователей есть активные задачи:');
                console.table(tasks);
                console.log('\n❌ Удаление отменено. Сначала переназначьте или закройте активные задачи.');
                db.close();
                return;
            }

            // Удаляем пользователей
            console.log('\n🗑️ Удаление пользователей...');

            const deleteStmt = db.prepare("DELETE FROM users WHERE telegram_id = ?");

            existingUsers.forEach(user => {
                deleteStmt.run(user.telegram_id, function(err) {
                    if (err) {
                        console.error(`❌ Ошибка при удалении ${user.name}:`, err);
                    } else {
                        console.log(`✅ Удален пользователь ${user.name} (ID: ${user.telegram_id})`);
                    }
                });
            });

            deleteStmt.finalize(() => {
                // Проверяем результат
                console.log('\n📋 Оставшиеся пользователи в базе:');
                db.all("SELECT telegram_id, name, position FROM users ORDER BY name", (err, rows) => {
                    if (err) {
                        console.error('Ошибка при получении пользователей:', err);
                        db.close();
                        return;
                    }

                    console.table(rows);

                    // Также удаляем из других таблиц
                    console.log('\n🧹 Очистка связанных данных...');

                    // Удаляем отчеты
                    db.run(`DELETE FROM reports WHERE user_telegram_id IN (${userIds.split(',').map(() => '?').join(',')})`,
                        userIds.split(','),
                        function(err) {
                            if (err) {
                                console.error('Ошибка при удалении отчетов:', err);
                            } else if (this.changes > 0) {
                                console.log(`✅ Удалено отчетов: ${this.changes}`);
                            }
                        }
                    );

                    // Удаляем записи о присутствии
                    db.run(`DELETE FROM attendance WHERE user_telegram_id IN (${userIds.split(',').map(() => '?').join(',')})`,
                        userIds.split(','),
                        function(err) {
                            if (err) {
                                console.error('Ошибка при удалении записей присутствия:', err);
                            } else if (this.changes > 0) {
                                console.log(`✅ Удалено записей присутствия: ${this.changes}`);
                            }
                        }
                    );

                    // Удаляем завершенные задачи
                    db.run(`DELETE FROM tasks WHERE assignee_id IN (${userIds.split(',').map(() => '?').join(',')}) AND status = 'Выполнена'`,
                        userIds.split(','),
                        function(err) {
                            if (err) {
                                console.error('Ошибка при удалении завершенных задач:', err);
                            } else if (this.changes > 0) {
                                console.log(`✅ Удалено завершенных задач: ${this.changes}`);
                            }

                            console.log('\n✅ Процесс удаления завершен!');
                            db.close();
                        }
                    );
                });
            });
        });
    });
});