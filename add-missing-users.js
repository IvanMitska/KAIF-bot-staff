const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'bot.db');
const db = new sqlite3.Database(dbPath);

console.log('➕ Добавление новых сотрудников в базу данных');
console.log('==============================================\n');

// Новые сотрудники для добавления
// Полина заменяет Елену в салоне красоты
// Юрий заменяет Якова в бане
const newUsers = [
    {
        telegram_id: '726915228', // Используем ID от Елены для Полины
        name: 'Полина',
        full_name: 'Полина Борзова',
        position: 'Управляющая салоном красоты',
        is_manager: 0,
        is_active: 1
    },
    {
        telegram_id: '893020643', // Используем ID от Якова для Юрия
        name: 'Юрий',
        full_name: 'Юрий Бугатти',
        position: 'Банщик',
        is_manager: 0,
        is_active: 1
    }
];

db.serialize(() => {
    console.log('📋 Текущие пользователи в базе:');
    db.all("SELECT telegram_id, name, position FROM users ORDER BY name", (err, rows) => {
        if (err) {
            console.error('Ошибка при получении пользователей:', err);
            return;
        }

        console.table(rows);

        console.log('\n➕ Добавляем новых сотрудников...\n');

        const stmt = db.prepare(`
            INSERT OR REPLACE INTO users (telegram_id, name, position)
            VALUES (?, ?, ?)
        `);

        newUsers.forEach(user => {
            stmt.run(
                user.telegram_id,
                user.name,
                user.position,
                function(err) {
                    if (err) {
                        console.error(`❌ Ошибка при добавлении ${user.name}:`, err);
                    } else {
                        console.log(`✅ Добавлен пользователь: ${user.name} (${user.position})`);
                    }
                }
            );
        });

        stmt.finalize(() => {
            // Проверяем результат
            setTimeout(() => {
                console.log('\n📋 Обновленный список пользователей:');
                db.all("SELECT telegram_id, name, position FROM users ORDER BY name", (err, rows) => {
                    if (err) {
                        console.error('Ошибка при получении пользователей:', err);
                        db.close();
                        return;
                    }

                    console.table(rows);

                    // Переназначаем задачи если они остались от старых пользователей
                    console.log('\n🔄 Обновляем имена в существующих задачах...');

                    // Обновляем задачи где assignee_id соответствует новым пользователям
                    db.run(`
                        UPDATE tasks
                        SET assignee_name = 'Полина'
                        WHERE assignee_id = '726915228'
                    `, function(err) {
                        if (err) {
                            console.error('Ошибка при обновлении задач Полины:', err);
                        } else if (this.changes > 0) {
                            console.log(`✅ Обновлено задач для Полины: ${this.changes}`);
                        }
                    });

                    db.run(`
                        UPDATE tasks
                        SET assignee_name = 'Юрий'
                        WHERE assignee_id = '893020643'
                    `, function(err) {
                        if (err) {
                            console.error('Ошибка при обновлении задач Юрия:', err);
                        } else if (this.changes > 0) {
                            console.log(`✅ Обновлено задач для Юрия: ${this.changes}`);
                        }

                        console.log('\n✅ Процесс добавления пользователей завершен!');
                        console.log('\n📌 Информация:');
                        console.log('  - Полина (Polina Borzova) - Управляющая салоном красоты');
                        console.log('  - Юрий (Iurii Bugatti) - Банщик');
                        db.close();
                    });
                });
            }, 100);
        });
    });
});