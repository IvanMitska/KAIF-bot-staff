require('dotenv').config();
const databasePool = require('./src/services/databasePool');

async function removeDuplicateTasks() {
  try {
    console.log('🔍 Удаляем дубликаты задач из базы данных...\n');
    
    // Подключаемся к БД
    await databasePool.getPool();
    
    // Находим все дубликаты
    const findDuplicatesQuery = `
      SELECT title, assignee_id, MIN(id) as keep_id, COUNT(*) as count
      FROM tasks
      GROUP BY title, assignee_id
      HAVING COUNT(*) > 1
    `;
    
    const duplicates = await databasePool.query(findDuplicatesQuery);
    
    console.log(`📊 Найдено ${duplicates.rows.length} групп дубликатов\n`);
    
    let totalDeleted = 0;
    
    // Для каждой группы дубликатов
    for (const dup of duplicates.rows) {
      console.log(`Обработка: "${dup.title}" для assignee_id: ${dup.assignee_id}`);
      console.log(`  Оставляем ID: ${dup.keep_id}, удаляем ${dup.count - 1} дубликатов`);
      
      // Удаляем все кроме первого (с минимальным ID)
      const deleteQuery = `
        DELETE FROM tasks 
        WHERE title = $1 
        AND assignee_id = $2 
        AND id != $3
      `;
      
      const result = await databasePool.query(deleteQuery, [
        dup.title,
        dup.assignee_id,
        dup.keep_id
      ]);
      
      console.log(`  ✅ Удалено: ${result.rowCount} записей\n`);
      totalDeleted += result.rowCount;
    }
    
    console.log('=' .repeat(50));
    console.log(`✅ ИТОГО УДАЛЕНО: ${totalDeleted} дубликатов`);
    console.log('=' .repeat(50));
    
    // Проверяем результат
    console.log('\n📊 Проверка результата:');
    
    const checkQuery = `
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(DISTINCT title) as unique_titles,
        (SELECT COUNT(*) FROM (
          SELECT title, COUNT(*) 
          FROM tasks 
          GROUP BY title 
          HAVING COUNT(*) > 1
        ) as dups) as duplicate_groups
      FROM tasks
    `;
    
    const checkResult = await databasePool.query(checkQuery);
    const stats = checkResult.rows[0];
    
    console.log(`Всего задач: ${stats.total_tasks}`);
    console.log(`Уникальных названий: ${stats.unique_titles}`);
    console.log(`Групп дубликатов: ${stats.duplicate_groups}`);
    
    // Проверяем задачи по пользователям
    console.log('\n📋 Задачи по пользователям после очистки:');
    
    const userStatsQuery = `
      SELECT assignee_name, assignee_id, COUNT(*) as task_count
      FROM tasks
      GROUP BY assignee_name, assignee_id
      ORDER BY task_count DESC
    `;
    
    const userStats = await databasePool.query(userStatsQuery);
    
    userStats.rows.forEach(row => {
      console.log(`  ${row.assignee_name}: ${row.task_count} задач`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    process.exit(0);
  }
}

removeDuplicateTasks();