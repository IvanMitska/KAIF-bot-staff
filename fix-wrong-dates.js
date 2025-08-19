#!/usr/bin/env node

/**
 * Скрипт для исправления неправильных дат (2026 год) в задачах
 */

require('dotenv').config();
const { Client } = require('@notionhq/client');

const notion = new Client({
  auth: process.env.NOTION_API_KEY
});

const TASKS_DB_ID = '24429e84-656d-8145-b032-dad938461018';

// Правильные сроки выполнения задач (из таблицы)
const CORRECT_DEADLINES = {
  // Борис
  "партнёрские офферы": "2025-09-09",
  "цветы в комплекс": "2025-09-02",
  "вывеска на въезде": "2025-09-09",
  "анализ крови": "2025-09-02",
  "тест на наркотики": "2025-09-02",
  "смета на ремонт": "2025-08-26",
  "регламенты подразделений": "2025-09-16",
  "эквайринг машинки": "2025-09-02",
  "цены аренды": "2025-09-02",
  "qr на чаевые": "2025-08-26",
  "табличка": "2025-08-26",
  "стенд": "2025-08-26",
  "чайная карта": "2025-09-02",
  "чайные церемонии": "2025-09-02",
  "контракт без work permit": "2025-09-02",
  "внедрить систему отчетов": "2025-08-26",
  "пест контроль": "2025-08-26",
  "финансовый порядок": "2025-08-26",
  "беспроводные принтеры": "2025-08-26",
  
  // Ксения
  "распечатки официантам": "2025-08-26",
  "лед в купель": "2025-08-22",
  "мятный пар": "2025-08-26",
  "арома масла": "2025-08-22",
  "массаж головы": "2025-08-22",
  "истории про групповые": "2025-08-22",
  "инста фотозона": "2025-09-02",
  "фото террасы": "2025-08-26",
  
  // Иван
  "финансовый бот": "2025-08-26",
  "оцифровка трафика": "2025-09-02",
  "новая срм": "2025-09-02",
  
  // Максим
  "потолок": "2025-08-22",
  
  // Дмитрий
  "мангал на втором": "2025-09-02",
  "брендированный пергамент": "2025-08-26",
  
  // Аля
  "жим + кардио": "2025-09-02",
  "массаж": "2025-08-22",
  
  // Игорь
  "обновление wifi": "2025-08-26"
};

async function fixWrongDates() {
  console.log('🔧 Исправление неправильных дат в задачах...\n');
  
  try {
    // Получаем все задачи с датой 2026-08-17
    const response = await notion.databases.query({
      database_id: TASKS_DB_ID,
      filter: {
        property: 'Срок выполнения',
        date: {
          equals: '2026-08-17'
        }
      },
      page_size: 100
    });
    
    console.log(`Найдено задач с датой 2026-08-17: ${response.results.length}\n`);
    
    if (response.results.length === 0) {
      console.log('✅ Задач с неправильной датой не найдено!');
      return;
    }
    
    let fixed = 0;
    let failed = 0;
    
    for (const task of response.results) {
      const title = task.properties['Название']?.rich_text?.[0]?.text?.content || '';
      const assignee = task.properties['Исполнитель']?.rich_text?.[0]?.text?.content || '';
      
      // Ищем правильную дату для этой задачи
      let correctDate = null;
      const titleLower = title.toLowerCase();
      
      for (const [key, date] of Object.entries(CORRECT_DEADLINES)) {
        if (titleLower.includes(key)) {
          correctDate = date;
          break;
        }
      }
      
      if (!correctDate) {
        console.log(`⚠️  Не найдена правильная дата для: "${title}"`);
        console.log(`   Оставляем как есть или устанавливаем дефолт...`);
        // Устанавливаем дефолтную дату через 2 недели
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 14);
        correctDate = defaultDate.toISOString().split('T')[0];
      }
      
      try {
        await notion.pages.update({
          page_id: task.id,
          properties: {
            'Срок выполнения': {
              date: {
                start: correctDate
              }
            }
          }
        });
        
        fixed++;
        console.log(`✅ Исправлено: "${title}" -> ${correctDate}`);
      } catch (error) {
        failed++;
        console.error(`❌ Ошибка при исправлении "${title}": ${error.message}`);
      }
    }
    
    console.log(`\n📊 Результаты:`);
    console.log(`   Исправлено: ${fixed} задач`);
    if (failed > 0) {
      console.log(`   Ошибок: ${failed}`);
    }
    
    // Проверяем остальные задачи с датами в далеком будущем
    console.log('\n🔍 Проверяем другие задачи с датами после 2025-12-31...');
    
    const futureTasksResponse = await notion.databases.query({
      database_id: TASKS_DB_ID,
      filter: {
        property: 'Срок выполнения',
        date: {
          after: '2025-12-31'
        }
      },
      page_size: 100
    });
    
    if (futureTasksResponse.results.length > 0) {
      console.log(`\n⚠️  Найдено еще ${futureTasksResponse.results.length} задач с датами в далеком будущем`);
      
      for (const task of futureTasksResponse.results) {
        const title = task.properties['Название']?.rich_text?.[0]?.text?.content || '';
        const deadline = task.properties['Срок выполнения']?.date?.start;
        console.log(`   - "${title}" -> ${deadline}`);
      }
      
      console.log('\nЗапустите скрипт еще раз для исправления этих задач');
    } else {
      console.log('✅ Других задач с неправильными датами не найдено');
    }
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Запускаем
fixWrongDates();