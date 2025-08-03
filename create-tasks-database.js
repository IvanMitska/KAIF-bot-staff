require('dotenv').config();
const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function createTasksDatabase() {
  try {
    console.log('Создаем базу данных задач...');
    
    // ID страницы REPORT - KAIF
    const PARENT_PAGE_ID = process.argv[2] || '1b929e84656d805ab7acec1620feee54';
    
    const response = await notion.databases.create({
      parent: {
        type: 'page_id',
        page_id: PARENT_PAGE_ID
      },
      title: [
        {
          type: 'text',
          text: {
            content: 'Tasks'
          }
        }
      ],
      properties: {
        'ID': {
          title: {}
        },
        'Название': {
          rich_text: {}
        },
        'Описание': {
          rich_text: {}
        },
        'Исполнитель': {
          rich_text: {}
        },
        'Исполнитель ID': {
          number: {
            format: 'number'
          }
        },
        'Постановщик': {
          rich_text: {}
        },
        'Постановщик ID': {
          number: {
            format: 'number'
          }
        },
        'Статус': {
          select: {
            options: [
              {
                name: 'Новая',
                color: 'red'
              },
              {
                name: 'В работе',
                color: 'yellow'
              },
              {
                name: 'Выполнена',
                color: 'green'
              }
            ]
          }
        },
        'Приоритет': {
          select: {
            options: [
              {
                name: 'low',
                color: 'green'
              },
              {
                name: 'medium',
                color: 'yellow'
              },
              {
                name: 'high',
                color: 'red'
              }
            ]
          }
        },
        'Дата создания': {
          date: {}
        },
        'Срок выполнения': {
          date: {}
        },
        'Дата выполнения': {
          date: {}
        },
        'Комментарий исполнителя': {
          rich_text: {}
        }
      }
    });
    
    console.log('✅ База данных создана успешно!');
    console.log('ID новой базы данных:', response.id);
    console.log('\n📋 Что делать дальше:');
    console.log('1. Скопируйте ID:', response.id);
    console.log('2. Откройте Railway и обновите NOTION_DATABASE_TASKS_ID');
    console.log('3. Перезапустите деплой');
    
    // Создаем несколько примеров задач
    console.log('\nСоздаем примеры задач...');
    
    await notion.pages.create({
      parent: { database_id: response.id },
      properties: {
        'ID': {
          title: [{ text: { content: 'TASK-001' } }]
        },
        'Название': {
          rich_text: [{ text: { content: 'Тестовая задача' } }]
        },
        'Описание': {
          rich_text: [{ text: { content: 'Это пример задачи для проверки работы системы' } }]
        },
        'Исполнитель': {
          rich_text: [{ text: { content: 'Иван Мицка' } }]
        },
        'Исполнитель ID': {
          number: 1734337242
        },
        'Постановщик': {
          rich_text: [{ text: { content: 'Борис' } }]
        },
        'Постановщик ID': {
          number: 385436658
        },
        'Статус': {
          select: { name: 'Новая' }
        },
        'Приоритет': {
          select: { name: 'medium' }
        },
        'Дата создания': {
          date: { start: new Date().toISOString() }
        },
        'Срок выполнения': {
          date: { start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() }
        }
      }
    });
    
    console.log('✅ Примеры задач созданы!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error('Детали:', error);
  }
}

// Инструкция для получения ID страницы
console.log('📌 Как получить ID страницы REPORT - KAIF:');
console.log('1. Откройте страницу REPORT - KAIF в Notion');
console.log('2. Нажмите на три точки (...) в правом верхнем углу');
console.log('3. Выберите "Copy link"');
console.log('4. Вставьте ссылку сюда и извлеките ID');
console.log('   Пример: https://notion.so/Page-Name-XXXXXXXXXXXXX');
console.log('   ID это часть XXXXXXXXXXXXX\n');

// Запускаем создание базы данных
createTasksDatabase();