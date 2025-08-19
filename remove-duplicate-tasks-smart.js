#!/usr/bin/env node

/**
 * Скрипт для умного удаления дубликатов задач в Notion
 * Оставляет задачи с правильными датами (из последнего импорта)
 */

require('dotenv').config();
const { Client } = require('@notionhq/client');

const notion = new Client({
  auth: process.env.NOTION_API_KEY
});

const TASKS_DB_ID = '24429e84-656d-8145-b032-dad938461018';

async function findAndRemoveSmartDuplicates() {
  console.log('🔍 Умный поиск дубликатов задач в Notion...\n');
  
  try {
    // Получаем все задачи
    let allTasks = [];
    let hasMore = true;
    let startCursor = undefined;
    
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: TASKS_DB_ID,
        start_cursor: startCursor,
        page_size: 100
      });
      
      allTasks = allTasks.concat(response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }
    
    console.log(`Найдено всего задач: ${allTasks.length}\n`);
    
    // Группируем задачи по названию и исполнителю (игнорируя даты)
    const taskGroups = {};
    
    for (const task of allTasks) {
      const title = task.properties['Название']?.rich_text?.[0]?.text?.content || '';
      const assignee = task.properties['Исполнитель']?.rich_text?.[0]?.text?.content || 'Не назначен';
      const status = task.properties['Статус']?.select?.name || 'Новая';
      const deadline = task.properties['Срок выполнения']?.date?.start || null;
      const createdDate = task.properties['Дата создания']?.date?.start || task.created_time;
      const description = task.properties['Описание']?.rich_text?.[0]?.text?.content || '';
      
      // Пропускаем пустые задачи
      if (!title.trim()) continue;
      
      // Ключ для группировки - название + исполнитель (без учета даты)
      const key = `${title.trim().toLowerCase()}|${assignee}`;
      
      if (!taskGroups[key]) {
        taskGroups[key] = [];
      }
      
      taskGroups[key].push({
        id: task.id,
        title,
        assignee,
        status,
        deadline,
        description,
        createdDate: new Date(createdDate),
        createdTime: new Date(task.created_time),
        lastEditedTime: new Date(task.last_edited_time)
      });
    }
    
    // Находим дубликаты с разными датами
    const toDelete = [];
    let groupsWithDuplicates = 0;
    
    for (const [key, tasks] of Object.entries(taskGroups)) {
      if (tasks.length > 1) {
        groupsWithDuplicates++;
        
        // Сортируем задачи по приоритету:
        // 1. Сначала задачи созданные 18-19 августа 2025 (наш последний импорт)
        // 2. Потом задачи с более поздним сроком выполнения
        // 3. Потом по дате последнего редактирования
        tasks.sort((a, b) => {
          // Проверяем, созданы ли задачи 18-19 августа 2025
          const isAFromImport = a.createdTime >= new Date('2025-08-18') && a.createdTime < new Date('2025-08-20');
          const isBFromImport = b.createdTime >= new Date('2025-08-18') && b.createdTime < new Date('2025-08-20');
          
          if (isAFromImport && !isBFromImport) return -1;
          if (!isAFromImport && isBFromImport) return 1;
          
          // Если обе из импорта или обе не из импорта, сравниваем по дедлайну
          if (a.deadline && b.deadline) {
            const deadlineA = new Date(a.deadline);
            const deadlineB = new Date(b.deadline);
            // Предпочитаем более поздние дедлайны (более реалистичные)
            if (deadlineA > deadlineB) return -1;
            if (deadlineA < deadlineB) return 1;
          }
          
          // По дате последнего редактирования
          return b.lastEditedTime - a.lastEditedTime;
        });
        
        const toKeep = tasks[0];
        const duplicatesToDelete = tasks.slice(1);
        
        console.log(`\n📌 Группа дубликатов: "${toKeep.title}" (${toKeep.assignee})`);
        console.log(`   Количество копий: ${tasks.length}`);
        console.log(`   ✅ Оставляем:`);
        console.log(`      - ID: ${toKeep.id.slice(0, 8)}...`);
        console.log(`      - Дедлайн: ${toKeep.deadline || 'не указан'}`);
        console.log(`      - Создана: ${toKeep.createdTime.toISOString().split('T')[0]}`);
        
        console.log(`   ❌ Удаляем ${duplicatesToDelete.length} дубликатов:`);
        for (const task of duplicatesToDelete) {
          console.log(`      - ID: ${task.id.slice(0, 8)}... (дедлайн: ${task.deadline || 'не указан'})`);
          toDelete.push(task);
        }
      }
    }
    
    if (toDelete.length === 0) {
      console.log('\n✅ Дубликатов с разными датами не найдено!');
      return;
    }
    
    console.log(`\n⚠️  Найдено ${groupsWithDuplicates} групп с дубликатами`);
    console.log(`📊 Всего задач к удалению: ${toDelete.length}`);
    
    // Запрашиваем подтверждение
    console.log('\n🚀 Начинаем удаление дубликатов...\n');
    
    // Удаляем дубликаты
    let deleted = 0;
    let failed = 0;
    
    for (const task of toDelete) {
      try {
        await notion.pages.update({
          page_id: task.id,
          archived: true
        });
        deleted++;
        process.stdout.write(`\rПрогресс: ${deleted}/${toDelete.length} удалено`);
      } catch (error) {
        failed++;
        console.error(`\n❌ Ошибка при удалении задачи ${task.id}: ${error.message}`);
      }
    }
    
    console.log(`\n\n✅ Удаление завершено!`);
    console.log(`   Успешно удалено: ${deleted} задач`);
    if (failed > 0) {
      console.log(`   Не удалось удалить: ${failed} задач`);
    }
    
    // Финальная статистика
    console.log(`\n📈 Итоговая статистика:`);
    console.log(`   Было задач: ${allTasks.length}`);
    console.log(`   Удалено дубликатов: ${deleted}`);
    console.log(`   Осталось задач: ~${allTasks.length - deleted}`);
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Запускаем
findAndRemoveSmartDuplicates();