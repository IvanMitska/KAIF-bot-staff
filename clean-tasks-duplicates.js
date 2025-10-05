require('dotenv').config();
const { Pool } = require('pg');

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function cleanDuplicateTasks() {
  console.log('🔍 Поиск и удаление дубликатов задач...');

  try {
    // Находим дубликаты по названию, исполнителю и дате создания
    const findDuplicatesQuery = `
      WITH duplicates AS (
        SELECT
          id,
          data->>'title' as title,
          data->>'assigneeId' as assignee_id,
          data->>'createdAt' as created_at,
          ROW_NUMBER() OVER (
            PARTITION BY
              data->>'title',
              data->>'assigneeId',
              DATE(CAST(data->>'createdAt' AS TIMESTAMP))
            ORDER BY created_at DESC
          ) as rn
        FROM tasks
        WHERE data->>'title' IS NOT NULL
      )
      SELECT id, title, assignee_id, created_at
      FROM duplicates
      WHERE rn > 1
    `;

    const duplicatesResult = await pool.query(findDuplicatesQuery);

    if (duplicatesResult.rows.length === 0) {
      console.log('✅ Дубликатов не найдено');
      return;
    }

    console.log(`⚠️ Найдено ${duplicatesResult.rows.length} дубликатов:`);

    duplicatesResult.rows.forEach(task => {
      console.log(`  - ID: ${task.id}, Title: ${task.title}, Assignee: ${task.assignee_id}`);
    });

    // Запрашиваем подтверждение
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('\n❓ Удалить эти дубликаты? (y/n): ', resolve);
    });

    rl.close();

    if (answer.toLowerCase() === 'y') {
      // Удаляем дубликаты
      const deleteQuery = `
        WITH duplicates AS (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY
                data->>'title',
                data->>'assigneeId',
                DATE(CAST(data->>'createdAt' AS TIMESTAMP))
              ORDER BY created_at DESC
            ) as rn
          FROM tasks
          WHERE data->>'title' IS NOT NULL
        )
        DELETE FROM tasks
        WHERE id IN (
          SELECT id FROM duplicates WHERE rn > 1
        )
      `;

      const deleteResult = await pool.query(deleteQuery);
      console.log(`✅ Удалено ${deleteResult.rowCount} дубликатов`);
    } else {
      console.log('❌ Операция отменена');
    }

  } catch (error) {
    console.error('❌ Ошибка при очистке дубликатов:', error);
  } finally {
    await pool.end();
  }
}

// Запускаем очистку
cleanDuplicateTasks();