require('dotenv').config();
const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function createTasksDatabase() {
  try {
    console.log('Creating Tasks database in Notion...');
    
    // Получаем первую доступную страницу
    const response = await notion.search({
      filter: {
        property: 'object',
        value: 'page'
      },
      page_size: 1
    });

    if (response.results.length === 0) {
      console.log('No pages found. Please create a page in Notion first.');
      return;
    }

    const parentPageId = response.results[0].id;
    
    // Создаем базу данных для задач
    const tasksDb = await notion.databases.create({
      parent: { page_id: parentPageId },
      title: [
        {
          type: 'text',
          text: { content: 'Tasks' }
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
          number: {}
        },
        'Постановщик': {
          rich_text: {}
        },
        'Постановщик ID': {
          number: {}
        },
        'Статус': {
          select: {
            options: [
              { name: 'Новая', color: 'blue' },
              { name: 'В работе', color: 'yellow' },
              { name: 'Выполнена', color: 'green' },
              { name: 'Отменена', color: 'red' }
            ]
          }
        },
        'Приоритет': {
          select: {
            options: [
              { name: 'Высокий', color: 'red' },
              { name: 'Средний', color: 'yellow' },
              { name: 'Низкий', color: 'green' }
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

    console.log('✅ Tasks database created successfully!');
    console.log('Database ID:', tasksDb.id);
    console.log('\nAdd this to your .env file:');
    console.log(`NOTION_DATABASE_TASKS_ID=${tasksDb.id}`);
    
  } catch (error) {
    console.error('Error creating database:', error);
  }
}

createTasksDatabase();