const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function createDatabases() {
  try {
    console.log('Creating Notion databases...');
    
    // Получаем список страниц для создания баз данных
    const response = await notion.search({
      filter: {
        property: 'object',
        value: 'page'
      },
      page_size: 1
    });

    if (response.results.length === 0) {
      console.log('No pages found. Please create databases manually in Notion.');
      console.log('\nInstructions:');
      console.log('1. Create a new page in Notion');
      console.log('2. Create two databases with the following properties:');
      console.log('\nDatabase 1: "Users"');
      console.log('- Telegram ID (Title)');
      console.log('- Имя (Text)');
      console.log('- Username (Text)');
      console.log('- Должность (Text)');
      console.log('- Дата регистрации (Date)');
      console.log('- Активен (Checkbox)');
      console.log('\nDatabase 2: "Daily Reports"');
      console.log('- Дата (Date)');
      console.log('- Сотрудник (Text)');
      console.log('- Telegram ID (Text)');
      console.log('- Что сделал (Text)');
      console.log('- Проблемы (Text)');
      console.log('- Цели на завтра (Text)');
      console.log('- Время отправки (Date)');
      console.log('- Статус (Select with options: Отправлен, Просрочен)');
      console.log('\n3. Copy database IDs from URLs and update .env file');
      return;
    }

    const parentPageId = response.results[0].id;
    console.log('Found parent page:', parentPageId);

    // Создаем базу данных Users
    console.log('Creating Users database...');
    const usersDb = await notion.databases.create({
      parent: { page_id: parentPageId },
      title: [
        {
          type: 'text',
          text: { content: 'Users' }
        }
      ],
      properties: {
        'Telegram ID': {
          title: {}
        },
        'Имя': {
          rich_text: {}
        },
        'Username': {
          rich_text: {}
        },
        'Должность': {
          rich_text: {}
        },
        'Дата регистрации': {
          date: {}
        },
        'Активен': {
          checkbox: {}
        }
      }
    });

    console.log('Users database created! ID:', usersDb.id);

    // Создаем базу данных Daily Reports
    console.log('Creating Daily Reports database...');
    const reportsDb = await notion.databases.create({
      parent: { page_id: parentPageId },
      title: [
        {
          type: 'text',
          text: { content: 'Daily Reports' }
        }
      ],
      properties: {
        'ID': {
          title: {}
        },
        'Дата': {
          date: {}
        },
        'Сотрудник': {
          rich_text: {}
        },
        'Telegram ID': {
          rich_text: {}
        },
        'Что сделал': {
          rich_text: {}
        },
        'Проблемы': {
          rich_text: {}
        },
        'Цели на завтра': {
          rich_text: {}
        },
        'Время отправки': {
          date: {}
        },
        'Статус': {
          select: {
            options: [
              { name: 'Отправлен', color: 'green' },
              { name: 'Просрочен', color: 'red' }
            ]
          }
        }
      }
    });

    console.log('Daily Reports database created! ID:', reportsDb.id);

    console.log('\n✅ Databases created successfully!');
    console.log('\nPlease update your .env file with these IDs:');
    console.log(`NOTION_DATABASE_USERS_ID=${usersDb.id}`);
    console.log(`NOTION_DATABASE_REPORTS_ID=${reportsDb.id}`);

  } catch (error) {
    if (error.code === 'unauthorized') {
      console.error('❌ Unauthorized: Please check your Notion API key');
      console.log('\nTo fix this:');
      console.log('1. Go to https://www.notion.so/my-integrations');
      console.log('2. Create a new integration or use existing one');
      console.log('3. Copy the Internal Integration Token');
      console.log('4. Update NOTION_API_KEY in .env file');
      console.log('5. Share your Notion page with the integration');
    } else if (error.code === 'object_not_found') {
      console.error('❌ No accessible pages found');
      console.log('\nTo fix this:');
      console.log('1. Create a new page in Notion');
      console.log('2. Share the page with your integration');
      console.log('3. Run this script again');
    } else {
      console.error('Error creating databases:', error);
    }
  }
}

// Проверяем подключение к Notion
async function testConnection() {
  try {
    console.log('Testing Notion connection...');
    const response = await notion.users.me();
    console.log('✅ Connected to Notion as:', response.name || 'Integration');
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to Notion:', error.message);
    return false;
  }
}

async function main() {
  const connected = await testConnection();
  if (connected) {
    await createDatabases();
  }
}

main();