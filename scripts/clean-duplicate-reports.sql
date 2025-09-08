-- Скрипт для очистки дублированных отчетов в PostgreSQL
-- Оставляет только самый последний отчет для каждого пользователя за каждый день

-- 1. Показать дубликаты перед удалением
SELECT telegram_id, date, COUNT(*) as count, 
       ARRAY_AGG(id ORDER BY timestamp DESC) as report_ids
FROM reports
GROUP BY telegram_id, date
HAVING COUNT(*) > 1;

-- 2. Удалить дубликаты, оставив только самый последний отчет
DELETE FROM reports
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY telegram_id, date 
                   ORDER BY timestamp DESC
               ) as rn
        FROM reports
    ) t
    WHERE rn > 1
);

-- 3. Создать уникальный индекс если его еще нет
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_unique 
ON reports(telegram_id, date);

-- 4. Проверить результат
SELECT 'Total reports:' as info, COUNT(*) as count FROM reports
UNION ALL
SELECT 'Unique user-date combinations:', COUNT(DISTINCT (telegram_id, date)) FROM reports;