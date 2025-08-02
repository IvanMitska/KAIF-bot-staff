const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const USERS_DB_ID = process.env.NOTION_DATABASE_USERS_ID;
const REPORTS_DB_ID = process.env.NOTION_DATABASE_REPORTS_ID;
const TASKS_DB_ID = process.env.NOTION_DATABASE_TASKS_ID;

console.log('Notion databases configured:');
console.log('- Users DB:', USERS_DB_ID);
console.log('- Reports DB:', REPORTS_DB_ID);
console.log('- Tasks DB:', TASKS_DB_ID);

// Проверяем, что все ID баз данных заданы
if (!TASKS_DB_ID) {
  console.error('ERROR: NOTION_DATABASE_TASKS_ID is not set in environment variables!');
}

const notionService = {
  async createUser(userData) {
    try {
      const response = await notion.pages.create({
        parent: { database_id: USERS_DB_ID },
        properties: {
          'Telegram ID': {
            title: [{ text: { content: userData.telegramId.toString() } }]
          },
          'Имя': {
            rich_text: [{ text: { content: userData.name } }]
          },
          'Username': {
            rich_text: [{ text: { content: userData.username || '' } }]
          },
          'Должность': {
            rich_text: [{ text: { content: userData.position } }]
          },
          'Дата регистрации': {
            date: { start: userData.registrationDate }
          },
          'Активен': {
            checkbox: userData.isActive
          }
        }
      });
      return response;
    } catch (error) {
      console.error('Notion create user error:', error);
      throw error;
    }
  },

  async getUserByTelegramId(telegramId) {
    try {
      // Преобразуем ID в число, если это строка
      const numericId = typeof telegramId === 'string' ? parseInt(telegramId, 10) : telegramId;
      
      console.log('Querying Notion for user with Telegram ID:', numericId);
      console.log('Original telegramId:', telegramId, 'type:', typeof telegramId);
      console.log('Using database ID:', USERS_DB_ID);
      
      const response = await notion.databases.query({
        database_id: USERS_DB_ID,
        filter: {
          property: 'Telegram ID',
          title: {
            equals: numericId.toString()
          }
        }
      });

      if (response.results.length > 0) {
        const user = response.results[0];
        return {
          id: user.id,
          telegramId: telegramId,
          name: user.properties['Имя'].rich_text[0]?.text.content || '',
          position: user.properties['Должность'].rich_text[0]?.text.content || '',
          isActive: user.properties['Активен'].checkbox
        };
      }
      return null;
    } catch (error) {
      console.error('Notion get user error:', error);
      throw error;
    }
  },

  async createReport(reportData) {
    try {
      const response = await notion.pages.create({
        parent: { database_id: REPORTS_DB_ID },
        properties: {
          'Дата': {
            date: { start: reportData.date }
          },
          'Сотрудник': {
            rich_text: [{ text: { content: reportData.employeeName } }]
          },
          'Telegram ID': {
            rich_text: [{ text: { content: reportData.telegramId.toString() } }]
          },
          'Что сделал': {
            rich_text: [{ text: { content: reportData.whatDone } }]
          },
          'Проблемы': {
            rich_text: [{ text: { content: reportData.problems } }]
          },
          'Цели на завтра': {
            rich_text: [{ text: { content: reportData.goals } }]
          },
          'Время отправки': {
            date: { start: reportData.timestamp }
          },
          'Статус': {
            select: { name: reportData.status }
          }
        }
      });
      return response;
    } catch (error) {
      console.error('Notion create report error:', error);
      throw error;
    }
  },

  async getTodayReport(telegramId) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString().split('T')[0];

      const response = await notion.databases.query({
        database_id: REPORTS_DB_ID,
        filter: {
          and: [
            {
              property: 'Telegram ID',
              rich_text: {
                equals: telegramId.toString()
              }
            },
            {
              property: 'Дата',
              date: {
                equals: todayISO
              }
            }
          ]
        }
      });

      return response.results.length > 0 ? response.results[0] : null;
    } catch (error) {
      console.error('Notion get today report error:', error);
      throw error;
    }
  },

  async getUserReports(telegramId, limit = 5) {
    try {
      const response = await notion.databases.query({
        database_id: REPORTS_DB_ID,
        filter: {
          property: 'Telegram ID',
          rich_text: {
            equals: telegramId.toString()
          }
        },
        sorts: [
          {
            property: 'Дата',
            direction: 'descending'
          }
        ],
        page_size: limit
      });

      return response.results.map(report => ({
        id: report.id,
        date: report.properties['Дата'].date.start,
        whatDone: report.properties['Что сделал'].rich_text[0]?.text.content || '',
        problems: report.properties['Проблемы'].rich_text[0]?.text.content || '',
        goals: report.properties['Цели на завтра'].rich_text[0]?.text.content || '',
        status: report.properties['Статус'].select?.name || 'Отправлен'
      }));
    } catch (error) {
      console.error('Notion get user reports error:', error);
      throw error;
    }
  },

  async getAllActiveUsers() {
    try {
      const response = await notion.databases.query({
        database_id: USERS_DB_ID,
        filter: {
          property: 'Активен',
          checkbox: {
            equals: true
          }
        }
      });

      return response.results.map(user => ({
        id: user.id,
        telegramId: parseInt(user.properties['Telegram ID'].title[0]?.text.content),
        name: user.properties['Имя'].rich_text[0]?.text.content || '',
        position: user.properties['Должность'].rich_text[0]?.text.content || ''
      }));
    } catch (error) {
      console.error('Notion get all active users error:', error);
      throw error;
    }
  },

  async updateUser(telegramId, updates) {
    try {
      const user = await this.getUserByTelegramId(telegramId);
      if (!user) throw new Error('User not found');

      const properties = {};
      
      if (updates.name) {
        properties['Имя'] = {
          rich_text: [{ text: { content: updates.name } }]
        };
      }
      
      if (updates.position) {
        properties['Должность'] = {
          rich_text: [{ text: { content: updates.position } }]
        };
      }
      
      if (typeof updates.isActive === 'boolean') {
        properties['Активен'] = {
          checkbox: updates.isActive
        };
      }

      const response = await notion.pages.update({
        page_id: user.id,
        properties: properties
      });

      return response;
    } catch (error) {
      console.error('Notion update user error:', error);
      throw error;
    }
  },

  async createTask(taskData) {
    try {
      // Преобразуем ID в числа
      const assigneeId = typeof taskData.assigneeId === 'string' ? parseInt(taskData.assigneeId, 10) : taskData.assigneeId;
      const creatorId = typeof taskData.creatorId === 'string' ? parseInt(taskData.creatorId, 10) : taskData.creatorId;
      
      console.log('Creating task with assigneeId:', assigneeId, 'type:', typeof assigneeId);
      console.log('Creating task with creatorId:', creatorId, 'type:', typeof creatorId);
      
      const response = await notion.pages.create({
        parent: { database_id: TASKS_DB_ID },
        properties: {
          'ID': {
            title: [{ text: { content: `TASK-${Date.now()}` } }]
          },
          'Название': {
            rich_text: [{ text: { content: taskData.title } }]
          },
          'Описание': {
            rich_text: [{ text: { content: taskData.description } }]
          },
          'Исполнитель': {
            rich_text: [{ text: { content: taskData.assigneeName } }]
          },
          'Исполнитель ID': {
            number: assigneeId
          },
          'Постановщик': {
            rich_text: [{ text: { content: taskData.creatorName } }]
          },
          'Постановщик ID': {
            number: creatorId
          },
          'Статус': {
            select: { name: 'Новая' }
          },
          'Приоритет': {
            select: { name: taskData.priority }
          },
          'Дата создания': {
            date: { start: new Date().toISOString() }
          },
          'Срок выполнения': {
            date: { start: taskData.deadline }
          }
        }
      });
      
      console.log('Task created successfully');
      return response;
    } catch (error) {
      console.error('Notion create task error:', error);
      throw error;
    }
  },

  async getTasksByAssignee(telegramId, status = null) {
    try {
      console.log('Getting tasks for assignee:', telegramId, 'with status:', status);
      console.log('Tasks database ID:', TASKS_DB_ID);
      
      if (!TASKS_DB_ID) {
        console.error('TASKS_DB_ID is not set!');
        return [];
      }
      
      // Проверяем доступность базы данных
      try {
        await notion.databases.retrieve({ database_id: TASKS_DB_ID });
      } catch (dbError) {
        console.error('Tasks database not accessible:', dbError.message);
        console.error('Please check if the database is shared with the integration');
        return [];
      }
      
      // Преобразуем telegramId в число
      const numericId = typeof telegramId === 'string' ? parseInt(telegramId, 10) : telegramId;
      console.log('Using numeric ID:', numericId, 'type:', typeof numericId);
      
      const filters = [
        {
          property: 'Исполнитель ID',
          number: {
            equals: numericId
          }
        }
      ];

      if (status) {
        filters.push({
          property: 'Статус',
          select: {
            equals: status
          }
        });
      }
      
      console.log('Filters for assignee tasks:', JSON.stringify(filters, null, 2));

      // Временно отключаем фильтр для отладки
      const queryParams = {
        database_id: TASKS_DB_ID,
        sorts: [
          {
            property: 'Приоритет',
            direction: 'ascending'
          },
          {
            property: 'Дата создания',
            direction: 'descending'
          }
        ]
      };
      
      // Временно получаем все задачи для отладки
      console.log('WARNING: Fetching all tasks without filter for debugging');
      
      const response = await notion.databases.query(queryParams);

      console.log('Found tasks for assignee:', response.results.length);
      if (response.results.length > 0) {
        console.log('Assignee task statuses:', response.results.map(task => 
          task.properties['Статус'].select?.name || 'No status'
        ));
      }

      // Фильтруем задачи вручную
      const filteredResults = response.results.filter(task => {
        const taskAssigneeId = task.properties['Исполнитель ID']?.number;
        console.log('Task assignee ID:', taskAssigneeId, 'vs requested:', numericId);
        return taskAssigneeId === numericId;
      });
      
      console.log('Filtered tasks:', filteredResults.length);
      
      return filteredResults.map(task => {
        try {
          return {
            id: task.id,
            taskId: task.properties['ID']?.title?.[0]?.text?.content || 'NO_ID',
            title: task.properties['Название']?.rich_text?.[0]?.text?.content || '',
            description: task.properties['Описание']?.rich_text?.[0]?.text?.content || '',
            status: task.properties['Статус']?.select?.name || 'Новая',
            priority: task.properties['Приоритет']?.select?.name || 'Средний',
            createdDate: task.properties['Дата создания']?.date?.start,
            deadline: task.properties['Срок выполнения']?.date?.start,
            creatorName: task.properties['Постановщик']?.rich_text?.[0]?.text?.content || ''
          };
        } catch (mapError) {
          console.error('Error mapping assignee task:', task.id, mapError);
          return null;
        }
      }).filter(task => task !== null);
    } catch (error) {
      console.error('Notion get tasks by assignee error:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Database ID:', TASKS_DB_ID);
      throw error;
    }
  },

  async getAllTasks(status = null) {
    try {
      const filter = status ? {
        property: 'Статус',
        select: { equals: status }
      } : undefined;

      console.log('Getting all tasks with status:', status);
      console.log('Filter:', JSON.stringify(filter, null, 2));

      const response = await notion.databases.query({
        database_id: TASKS_DB_ID,
        filter: filter,
        sorts: [
          {
            property: 'Дата создания',
            direction: 'descending'
          }
        ]
      });

      console.log('Found tasks:', response.results.length);
      
      if (response.results.length > 0) {
        console.log('Task statuses:', response.results.map(task => 
          task.properties['Статус'].select?.name || 'No status'
        ));
      }

      return response.results.map(task => {
        try {
          return {
            id: task.id,
            taskId: task.properties['ID']?.title?.[0]?.text?.content || 'NO_ID',
            title: task.properties['Название']?.rich_text?.[0]?.text?.content || '',
            assigneeName: task.properties['Исполнитель']?.rich_text?.[0]?.text?.content || '',
            status: task.properties['Статус']?.select?.name || 'Новая',
            priority: task.properties['Приоритет']?.select?.name || 'Средний',
            createdDate: task.properties['Дата создания']?.date?.start,
            deadline: task.properties['Срок выполнения']?.date?.start
          };
        } catch (mapError) {
          console.error('Error mapping task:', task.id, mapError);
          return null;
        }
      }).filter(task => task !== null);
    } catch (error) {
      console.error('Notion get all tasks error:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Database ID:', TASKS_DB_ID);
      throw error;
    }
  },

  async completeTask(taskId) {
    return this.updateTaskStatus(taskId, 'Выполнена');
  },

  async updateTaskStatus(taskId, status, comment = null) {
    try {
      console.log('Updating task status:', { taskId, status, comment });
      
      const properties = {
        'Статус': {
          select: { name: status }
        }
      };

      if (status === 'Выполнена') {
        properties['Дата выполнения'] = {
          date: { start: new Date().toISOString() }
        };
      }

      if (comment) {
        properties['Комментарий исполнителя'] = {
          rich_text: [{ text: { content: comment } }]
        };
      }

      console.log('Update properties:', JSON.stringify(properties, null, 2));

      const response = await notion.pages.update({
        page_id: taskId,
        properties: properties
      });

      console.log('Task updated successfully');
      
      // Проверяем обновленный статус
      try {
        const updatedTask = await notion.pages.retrieve({ page_id: taskId });
        const updatedStatus = updatedTask.properties['Статус']?.select?.name;
        console.log('Verified task status after update:', updatedStatus);
      } catch (verifyError) {
        console.error('Error verifying task status:', verifyError);
      }
      
      return response;
    } catch (error) {
      console.error('Notion update task status error:', error);
      throw error;
    }
  },

  async getUsers() {
    return notionService.getAllActiveUsers();
  },

  async getUser(telegramId) {
    return notionService.getUserByTelegramId(telegramId);
  },

  // Временная функция для отладки
  async debugGetAllTasks() {
    try {
      const response = await notion.databases.query({
        database_id: TASKS_DB_ID,
        sorts: [
          {
            property: 'Дата создания',
            direction: 'descending'
          }
        ]
      });

      console.log('\n=== DEBUG: ALL TASKS IN DATABASE ===');
      console.log('Total tasks:', response.results.length);
      
      // Группируем задачи по статусам
      const tasksByStatus = {};
      
      response.results.forEach((task, index) => {
        const status = task.properties['Статус'].select?.name || 'No status';
        const assigneeId = task.properties['Исполнитель ID'].number || 'No ID';
        
        if (!tasksByStatus[status]) {
          tasksByStatus[status] = [];
        }
        
        tasksByStatus[status].push({
          title: task.properties['Название'].rich_text[0]?.text.content || 'No title',
          assignee: task.properties['Исполнитель'].rich_text[0]?.text.content || 'No assignee',
          assigneeId: assigneeId,
          id: task.id
        });
        
        console.log(`\nTask ${index + 1}:`);
        console.log('- ID:', task.id);
        console.log('- Title:', task.properties['Название'].rich_text[0]?.text.content || 'No title');
        console.log('- Status:', status);
        console.log('- Status object:', JSON.stringify(task.properties['Статус'].select));
        console.log('- Assignee:', task.properties['Исполнитель'].rich_text[0]?.text.content || 'No assignee');
        console.log('- Assignee ID:', assigneeId);
      });
      
      console.log('\n=== TASKS BY STATUS ===');
      Object.entries(tasksByStatus).forEach(([status, tasks]) => {
        console.log(`\n${status}: ${tasks.length} tasks`);
        tasks.forEach(task => {
          console.log(`  - ${task.title} (Assignee: ${task.assignee}, ID: ${task.assigneeId})`);
        });
      });
      
      console.log('=== END DEBUG ===\n');

      return response.results;
    } catch (error) {
      console.error('Debug error:', error);
      throw error;
    }
  },

  // Функция для проверки конкретной задачи
  async debugGetTaskById(taskId) {
    try {
      const task = await notion.pages.retrieve({ page_id: taskId });
      console.log('\n=== DEBUG: TASK DETAILS ===');
      console.log('Task ID:', taskId);
      console.log('Status:', task.properties['Статус']?.select?.name);
      console.log('Full status object:', JSON.stringify(task.properties['Статус'], null, 2));
      console.log('=== END DEBUG ===\n');
      return task;
    } catch (error) {
      console.error('Debug task error:', error);
      throw error;
    }
  },

  // Функция для принудительного обновления статуса задачи
  async forceUpdateTaskStatus(taskId, newStatus) {
    try {
      console.log(`\n=== FORCE UPDATE TASK STATUS ===`);
      console.log(`Task ID: ${taskId}`);
      console.log(`New Status: ${newStatus}`);
      
      // Сначала получаем текущий статус
      const task = await notion.pages.retrieve({ page_id: taskId });
      const currentStatus = task.properties['Статус']?.select?.name;
      console.log(`Current Status: ${currentStatus}`);
      
      // Обновляем статус
      const response = await notion.pages.update({
        page_id: taskId,
        properties: {
          'Статус': {
            select: { name: newStatus }
          }
        }
      });
      
      // Проверяем результат
      const updatedTask = await notion.pages.retrieve({ page_id: taskId });
      const finalStatus = updatedTask.properties['Статус']?.select?.name;
      console.log(`Final Status: ${finalStatus}`);
      console.log(`Update successful: ${finalStatus === newStatus}`);
      console.log(`=== END FORCE UPDATE ===\n`);
      
      return finalStatus === newStatus;
    } catch (error) {
      console.error('Force update error:', error);
      return false;
    }
  },

  // Функция для проверки подключения к базе данных задач
  async testTasksDatabase() {
    try {
      console.log('\n=== TESTING TASKS DATABASE CONNECTION ===');
      console.log('Database ID:', TASKS_DB_ID);
      
      // Пробуем получить информацию о базе данных
      const database = await notion.databases.retrieve({ database_id: TASKS_DB_ID });
      console.log('Database title:', database.title[0]?.plain_text);
      console.log('Database connection: SUCCESS');
      
      // Пробуем сделать простой запрос
      const response = await notion.databases.query({
        database_id: TASKS_DB_ID,
        page_size: 1
      });
      console.log('Query test: SUCCESS');
      console.log('=== END TEST ===\n');
      
      return true;
    } catch (error) {
      console.error('Tasks database test FAILED:', error.message);
      console.error('Error code:', error.code);
      console.error('Error status:', error.status);
      return false;
    }
  }
};

module.exports = notionService;