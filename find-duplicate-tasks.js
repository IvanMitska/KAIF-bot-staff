#!/usr/bin/env node

/**
 * Скрипт для поиска и удаления дубликатов задач в Notion
 */

require('dotenv').config();
const { Client } = require('@notionhq/client');

const notion = new Client({
  auth: process.env.NOTION_API_KEY
});

const TASKS_DB_ID = '24429e84-656d-8145-b032-dad938461018'; // Tasks DB ID

async function findAndRemoveDuplicates() {
  console.log('🔍 Поиск дубликатов задач в Notion...\n');
  
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
    
    console.log(`Найдено всего задач: ${allTasks.length}`);
    
    // Группируем задачи по названию и исполнителю
    const taskGroups = {};
    
    for (const task of allTasks) {
      const title = task.properties['Название']?.rich_text?.[0]?.text?.content || '';
      const assignee = task.properties['Исполнитель']?.rich_text?.[0]?.text?.content || 'Не назначен';
      const status = task.properties['Статус']?.select?.name || 'Новая';
      const createdDate = task.properties['Дата создания']?.date?.start || task.created_time;
      
      // Ключ для группировки - название + исполнитель
      const key = `${title.trim()}|${assignee}`;
      
      if (!taskGroups[key]) {
        taskGroups[key] = [];
      }
      
      taskGroups[key].push({
        id: task.id,
        title,
        assignee,
        status,
        createdDate: new Date(createdDate),
        createdTime: new Date(task.created_time)
      });
    }
    
    // Находим дубликаты
    const duplicates = [];
    let duplicateCount = 0;
    
    for (const [key, tasks] of Object.entries(taskGroups)) {
      if (tasks.length > 1) {
        // Сортируем по дате создания (старые первые)
        tasks.sort((a, b) => a.createdTime - b.createdTime);
        
        console.log(`\n📌 Найдены дубликаты: "${tasks[0].title}" (${tasks[0].assignee})`);
        console.log(`   Количество копий: ${tasks.length}`);
        
        // Оставляем самую старую задачу, остальные помечаем для удаления
        const toKeep = tasks[0];
        const toDelete = tasks.slice(1);
        
        console.log(`   ✅ Оставляем: ID ${toKeep.id.slice(0, 8)}... (создана ${toKeep.createdTime.toISOString().split('T')[0]})`);
        
        for (const task of toDelete) {
          console.log(`   ❌ Удаляем: ID ${task.id.slice(0, 8)}... (создана ${task.createdTime.toISOString().split('T')[0]})`);
          duplicates.push(task);
          duplicateCount++;
        }
      }
    }
    
    if (duplicateCount === 0) {
      console.log('\n✅ Дубликатов не найдено!');
      return;
    }
    
    console.log(`\n⚠️  Найдено ${duplicateCount} дубликатов задач`);
    console.log('Начинаем удаление дубликатов...\n');
    
    // Удаляем дубликаты
    let deleted = 0;
    let failed = 0;
    
    for (const task of duplicates) {
      try {
        await notion.pages.update({
          page_id: task.id,
          archived: true
        });
        deleted++;
        process.stdout.write(`\rУдалено: ${deleted}/${duplicateCount}`);
      } catch (error) {
        failed++;
        console.error(`\n❌ Ошибка при удалении задачи ${task.id}: ${error.message}`);
      }
    }
    
    console.log(`\n\n✅ Удаление завершено!`);
    console.log(`   Успешно удалено: ${deleted}`);
    if (failed > 0) {
      console.log(`   Не удалось удалить: ${failed}`);
    }
    
    // Проверяем результат
    const checkResponse = await notion.databases.query({
      database_id: TASKS_DB_ID,
      page_size: 1
    });
    
    console.log(`\nОсталось активных задач в базе: ~${checkResponse.results.length > 0 ? allTasks.length - deleted : 0}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Запускаем поиск и удаление дубликатов
findAndRemoveDuplicates();