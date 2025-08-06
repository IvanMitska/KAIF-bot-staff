const { Client } = require('@notionhq/client');
const { formatPhuketTime, getPhuketDateISO } = require('../utils/timezone');

// Проверка наличия API ключа
if (!process.env.NOTION_API_KEY) {
  console.error('❌ CRITICAL ERROR: NOTION_API_KEY is not set!');
  console.error('Please set NOTION_API_KEY in Railway environment variables');
}

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const USERS_DB_ID = process.env.NOTION_DATABASE_USERS_ID;
const REPORTS_DB_ID = process.env.NOTION_DATABASE_REPORTS_ID;
const TASKS_DB_ID = process.env.NOTION_DATABASE_TASKS_ID;
const ATTENDANCE_DB_ID = process.env.NOTION_DATABASE_ATTENDANCE_ID || process.env.NOTION_DATABASE_TASKS_ID;

console.log('Notion configuration:');
console.log('- API Key:', process.env.NOTION_API_KEY ? 'Present' : 'MISSING!');
console.log('- Users DB:', USERS_DB_ID || 'MISSING!');
console.log('- Reports DB:', REPORTS_DB_ID || 'MISSING!');
console.log('- Tasks DB:', TASKS_DB_ID || 'MISSING!');
console.log('- Attendance DB:', ATTENDANCE_DB_ID || 'MISSING!');
console.log('- Attendance DB (actual value):', ATTENDANCE_DB_ID);
console.log('- Using Tasks DB for attendance:', ATTENDANCE_DB_ID === TASKS_DB_ID);

// Проверяем, что все ID баз данных заданы
if (!USERS_DB_ID || !REPORTS_DB_ID || !TASKS_DB_ID) {
  console.error('❌ ERROR: One or more Notion database IDs are missing!');
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
      // Валидация обязательных полей
      if (!reportData.employeeName || !reportData.telegramId || !reportData.whatDone) {
        console.error('Missing required fields in report data:', {
          hasEmployeeName: !!reportData.employeeName,
          hasTelegramId: !!reportData.telegramId,
          hasWhatDone: !!reportData.whatDone
        });
        throw new Error('Missing required fields in report data');
      }
      
      console.log('Creating report in Notion:', {
        date: reportData.date,
        employeeName: reportData.employeeName,
        telegramId: reportData.telegramId,
        status: reportData.status,
        whatDoneLength: reportData.whatDone?.length,
        problemsLength: reportData.problems?.length
      });
      
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
      
      console.log('Report created successfully in Notion:', {
        pageId: response.id,
        employeeName: reportData.employeeName
      });
      
      return response;
    } catch (error) {
      console.error('Notion create report error:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        reportData: reportData
      });
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

  async getReportsForPeriod(startDate, endDate, employeeId = null) {
    try {
      console.log('Getting reports for period:', { startDate, endDate, employeeId });
      
      const filters = [
        {
          property: 'Дата',
          date: {
            on_or_after: startDate
          }
        },
        {
          property: 'Дата',
          date: {
            on_or_before: endDate
          }
        }
      ];
      
      if (employeeId && employeeId !== '') {
        filters.push({
          property: 'Telegram ID',
          rich_text: {
            equals: employeeId.toString()
          }
        });
      }
      
      const response = await notion.databases.query({
        database_id: REPORTS_DB_ID,
        filter: {
          and: filters
        },
        sorts: [
          {
            property: 'Дата',
            direction: 'descending'
          },
          {
            property: 'Время отправки',
            direction: 'descending'
          }
        ]
      });

      return response.results.map(report => ({
        id: report.id,
        date: report.properties['Дата'].date.start,
        employeeName: report.properties['Сотрудник'].rich_text[0]?.text.content || '',
        telegramId: report.properties['Telegram ID'].rich_text[0]?.text.content || '',
        whatDone: report.properties['Что сделал'].rich_text[0]?.text.content || '',
        problems: report.properties['Проблемы'].rich_text[0]?.text.content || '',
        goals: report.properties['Цели на завтра'].rich_text[0]?.text.content || '',
        timestamp: report.properties['Время отправки'].date?.start || report.properties['Дата'].date.start,
        status: report.properties['Статус'].select?.name || 'Отправлен'
      }));
    } catch (error) {
      console.error('Notion get reports for period error:', error);
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
            creatorName: task.properties['Постановщик']?.rich_text?.[0]?.text?.content || '',
            creatorId: task.properties['Постановщик ID']?.number,
            assigneeId: task.properties['Исполнитель ID']?.number,
            assigneeName: task.properties['Исполнитель']?.rich_text?.[0]?.text?.content || ''
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
            deadline: task.properties['Срок выполнения']?.date?.start,
            completedDate: task.properties['Дата выполнения']?.date?.start
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

  async getTasksByCreator(creatorId, status = null) {
    try {
      console.log('Getting tasks by creator:', creatorId);
      
      if (!TASKS_DB_ID) {
        console.error('TASKS_DB_ID is not set!');
        return [];
      }
      
      // Проверяем доступность базы данных
      try {
        await notion.databases.retrieve({ database_id: TASKS_DB_ID });
      } catch (dbError) {
        console.error('Tasks database not accessible:', dbError.message);
        return [];
      }
      
      // Преобразуем creatorId в число
      const numericId = typeof creatorId === 'string' ? parseInt(creatorId, 10) : creatorId;
      
      const queryParams = {
        database_id: TASKS_DB_ID,
        sorts: [
          {
            property: 'Дата создания',
            direction: 'descending'
          }
        ]
      };
      
      const response = await notion.databases.query(queryParams);
      
      // Фильтруем задачи по постановщику
      const filteredResults = response.results.filter(task => {
        const taskCreatorId = task.properties['Постановщик ID']?.number;
        return taskCreatorId === numericId;
      });
      
      console.log('Found tasks by creator:', filteredResults.length);
      
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
            assigneeName: task.properties['Исполнитель']?.rich_text?.[0]?.text?.content || '',
            assigneeId: task.properties['Исполнитель ID']?.number
          };
        } catch (mapError) {
          console.error('Error mapping creator task:', task.id, mapError);
          return null;
        }
      }).filter(task => task !== null);
    } catch (error) {
      console.error('Notion get tasks by creator error:', error);
      throw error;
    }
  },

  async updateTask(taskId, updates) {
    try {
      console.log('Updating task:', { taskId, updates });
      
      const properties = {};
      
      if (updates.title) {
        properties['Название'] = {
          title: [{ text: { content: updates.title } }]
        };
      }
      
      if (updates.description !== undefined) {
        properties['Описание'] = {
          rich_text: updates.description ? [{ text: { content: updates.description } }] : []
        };
      }
      
      if (updates.deadline) {
        properties['Срок выполнения'] = {
          date: { start: updates.deadline }
        };
      }
      
      if (updates.priority) {
        properties['Приоритет'] = {
          select: { name: updates.priority }
        };
      }
      
      if (updates.assigneeId && updates.assigneeName) {
        properties['Исполнитель ID'] = {
          number: updates.assigneeId
        };
        properties['Исполнитель'] = {
          rich_text: [{ text: { content: updates.assigneeName } }]
        };
      }
      
      await notion.pages.update({
        page_id: taskId,
        properties
      });
      
      console.log('Task updated successfully');
      return true;
    } catch (error) {
      console.error('Notion update task error:', error);
      throw error;
    }
  },
  
  async addPhotoToTask(taskId, photoUrl, caption = '') {
    try {
      console.log('Adding photo to task:', { taskId, photoUrl, caption });
      
      const properties = {
        'Фото результата': {
          url: photoUrl
        }
      };
      
      if (caption) {
        properties['Комментарий к фото'] = {
          rich_text: [{ text: { content: caption } }]
        };
      }
      
      await notion.pages.update({
        page_id: taskId,
        properties
      });
      
      console.log('Photo added successfully to task');
      return true;
    } catch (error) {
      console.error('Notion add photo error:', error);
      throw error;
    }
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
  },

  // Получить схему базы данных
  async getDatabaseSchema(databaseId) {
    try {
      const database = await notion.databases.retrieve({ database_id: databaseId });
      const properties = {};
      
      for (const [key, value] of Object.entries(database.properties)) {
        properties[key] = {
          type: value.type,
          id: value.id
        };
      }
      
      console.log('Database schema:', JSON.stringify(properties, null, 2));
      return properties;
    } catch (error) {
      console.error('Error getting database schema:', error);
      throw error;
    }
  },

  // Методы для учета рабочего времени
  async getTodayAttendance(employeeId) {
    try {
      if (!ATTENDANCE_DB_ID) {
        console.error('ATTENDANCE_DB_ID is not set!');
        return null;
      }
      
      const todayISO = getPhuketDateISO();
      
      console.log('Getting today attendance for employee:', employeeId, 'date:', todayISO);
      
      // Для посещаемости используем базу задач - ищем специальные задачи check-in/check-out
      console.log('Searching for attendance records in tasks database...');
      
      try {
        const response = await notion.databases.query({
          database_id: ATTENDANCE_DB_ID,
          filter: {
            and: [
              {
                property: 'ID',
                title: {
                  contains: todayISO
                }
              },
              {
                or: [
                  {
                    property: 'ID',
                    title: {
                      contains: 'check-in'
                    }
                  },
                  {
                    property: 'ID', 
                    title: {
                      contains: 'check-out'
                    }
                  }
                ]
              }
            ]
          },
          page_size: 100
        });
        
        console.log(`Found ${response.results.length} tasks for employee ${employeeId}`);
        
        // Фильтруем результаты вручную по employeeId
        const todayAttendance = response.results.find(page => {
          // Получаем ID (заголовок)
          const id = page.properties['ID']?.title?.[0]?.text?.content || '';
          
          // Проверяем assigneeId
          const assigneeId = page.properties['Исполнитель ID']?.number;
          
          // Проверяем, что это задача check-in/check-out для нужного сотрудника на сегодня
          const isForEmployee = assigneeId === employeeId || id.includes(employeeId.toString());
          const isToday = id.includes(todayISO);
          const isAttendance = id.includes('check-in') || id.includes('check-out');
          
          return isForEmployee && isToday && isAttendance;
        });
        
        if (todayAttendance) {
          console.log('Found today attendance record');
          return this.parseAttendanceFromPage(todayAttendance, todayISO);
        }
        
        console.log('No attendance record found for today');
        return null;
        
      } catch (searchError) {
        console.error('Error searching for attendance:', searchError);
        // Если поиск не удался, возвращаем null
        return null;
      }
      
    } catch (error) {
      console.error('Error in getTodayAttendance:', error);
      return null;
    }
  },
  
  // Парсинг записи учета времени из страницы Notion
  parseAttendanceFromPage(page, dateISO) {
    try {
      console.log('Parsing attendance from page:', page.id);
      
      // Получаем Description из разных возможных полей
      let descriptionContent = '';
      const descriptionFields = ['Description', 'Описание', 'Content', 'Содержание'];
      
      for (const field of descriptionFields) {
        if (page.properties[field]?.rich_text?.[0]?.text?.content) {
          descriptionContent = page.properties[field].rich_text[0].text.content;
          console.log(`Found description in field "${field}"`);
          break;
        }
      }
      
      // Парсим информацию из описания
      const checkInMatch = descriptionContent.match(/Время прихода: ([\d:]+)/);
      const checkOutMatch = descriptionContent.match(/Время ухода: ([\d:]+)/);
      
      const checkInTimeStr = checkInMatch ? checkInMatch[1] : null;
      const checkOutTimeStr = checkOutMatch ? checkOutMatch[1] : null;
      
      // Конвертируем время в полную дату ISO
      let checkInISO = null;
      let checkOutISO = null;
      
      if (checkInTimeStr) {
        const [hours, minutes] = checkInTimeStr.split(':');
        const checkInDate = new Date(dateISO);
        checkInDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        checkInISO = checkInDate.toISOString();
      }
      
      if (checkOutTimeStr) {
        const [hours, minutes] = checkOutTimeStr.split(':');
        const checkOutDate = new Date(dateISO);
        checkOutDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        checkOutISO = checkOutDate.toISOString();
      }
      
      // Получаем статус из разных возможных полей
      let status = 'В работе';
      const statusFields = ['Status', 'Статус'];
      
      for (const field of statusFields) {
        if (page.properties[field]?.select?.name) {
          status = page.properties[field].select.name;
          break;
        }
      }
      
      // Рассчитываем отработанные часы
      let workHours = null;
      if (checkInISO && checkOutISO) {
        const checkInTime = new Date(checkInISO);
        const checkOutTime = new Date(checkOutISO);
        const hoursWorked = (checkOutTime - checkInTime) / (1000 * 60 * 60);
        workHours = Math.round(hoursWorked * 10) / 10; // Округляем до 1 знака после запятой
      }
      
      const attendance = {
        id: page.id,
        employeeId: null,
        date: dateISO,
        checkIn: checkInISO,
        checkOut: checkOutISO,
        status: status,
        isPresent: !checkOutISO && !!checkInISO,
        workHours: workHours
      };
      
      console.log('Parsed attendance:', attendance);
      return attendance;
      
    } catch (error) {
      console.error('Error parsing attendance from page:', error);
      return null;
    }
  },

  async createAttendance(attendanceData) {
    try {
      console.log('=== CREATE ATTENDANCE DEBUG ===');
      console.log('ATTENDANCE_DB_ID:', ATTENDANCE_DB_ID);
      console.log('TASKS_DB_ID:', TASKS_DB_ID);
      console.log('Are they equal?', ATTENDANCE_DB_ID === TASKS_DB_ID);
      
      if (!ATTENDANCE_DB_ID) {
        throw new Error('ATTENDANCE_DB_ID is not configured');
      }
      
      // Валидация обязательных полей
      if (!attendanceData.employeeName || !attendanceData.employeeId || !attendanceData.checkIn) {
        throw new Error('Missing required fields in attendance data');
      }
      
      console.log('Creating attendance record:', {
        employeeName: attendanceData.employeeName,
        employeeId: attendanceData.employeeId,
        date: attendanceData.date,
        checkIn: attendanceData.checkIn
      });
      
      // Создаем задачу в базе Tasks для учета времени
      const attendanceTitle = `Учет времени - ${attendanceData.employeeName} - ${attendanceData.date}`;
      const checkInTime = formatPhuketTime(attendanceData.checkIn);
      
      // Пробуем создать с минимальным набором полей
      console.log('Attempting to create page with properties...');
      
      // Получаем схему базы данных чтобы узнать правильные имена полей
      console.log('Getting database schema...');
      const schema = await this.getDatabaseSchema(ATTENDANCE_DB_ID);
      
      // Находим поле title
      let titleField = null;
      for (const [fieldName, fieldInfo] of Object.entries(schema)) {
        if (fieldInfo.type === 'title') {
          titleField = fieldName;
          console.log(`Found title field: "${fieldName}"`);
          break;
        }
      }
      
      if (!titleField) {
        console.error('No title field found in database!');
        console.error('Available fields:', JSON.stringify(schema, null, 2));
        throw new Error('Database has no title field');
      }
      
      // Создаем запись с правильным полем title
      console.log(`Creating page with title field: "${titleField}"`);
      const response = await notion.pages.create({
        parent: { database_id: ATTENDANCE_DB_ID },
        properties: {
          [titleField]: {
            title: [{ text: { content: attendanceTitle } }]
          }
        }
      });
      
      if (!response) {
        throw new Error('Failed to create attendance record');
      }
      
      console.log(`Page created successfully with field "${titleField}"`);
      
      // Теперь попробуем обновить с остальными полями используя схему
      try {
        const updateProps = {};
        const description = `Сотрудник: ${attendanceData.employeeName}
ID: ${attendanceData.employeeId}
Дата: ${attendanceData.date}
Время прихода: ${checkInTime}`;
        
        // Ищем поле для ID сотрудника (number type)
        for (const [fieldName, fieldInfo] of Object.entries(schema)) {
          if (fieldInfo.type === 'number' && 
              (fieldName.toLowerCase().includes('assignee') || 
               fieldName.toLowerCase().includes('исполнитель') ||
               fieldName.toLowerCase().includes('id'))) {
            try {
              updateProps[fieldName] = {
                number: typeof attendanceData.employeeId === 'string' ? 
                  parseInt(attendanceData.employeeId, 10) : attendanceData.employeeId
              };
              console.log(`Using field "${fieldName}" for employee ID`);
              break;
            } catch (e) {
              console.log(`Field "${fieldName}" failed:`, e.message);
            }
          }
        }
        
        // Ищем поле для статуса (select type)
        for (const [fieldName, fieldInfo] of Object.entries(schema)) {
          if (fieldInfo.type === 'select' && 
              (fieldName.toLowerCase().includes('status') || 
               fieldName.toLowerCase().includes('статус'))) {
            updateProps[fieldName] = { select: { name: 'В работе' } };
            console.log(`Using field "${fieldName}" for status`);
            break;
          }
        }
        
        // Ищем поле для описания (rich_text type)
        for (const [fieldName, fieldInfo] of Object.entries(schema)) {
          if (fieldInfo.type === 'rich_text' && 
              (fieldName.toLowerCase().includes('description') || 
               fieldName.toLowerCase().includes('описание') ||
               fieldName.toLowerCase().includes('content'))) {
            updateProps[fieldName] = {
              rich_text: [{ text: { content: description } }]
            };
            console.log(`Using field "${fieldName}" for description`);
            break;
          }
        }
        
        // Обновляем страницу если есть что обновлять
        if (Object.keys(updateProps).length > 0) {
          await notion.pages.update({
            page_id: response.id,
            properties: updateProps
          });
          console.log('Page updated with additional properties');
        }
        
      } catch (updateError) {
        console.error('Error updating page:', updateError.message);
      }
      
      console.log('Attendance record created successfully:', response.id);
      return response;
    } catch (error) {
      console.error('Notion create attendance error:', error);
      throw error;
    }
  },

  async updateAttendanceCheckOut(attendanceId, checkOut) {
    try {
      if (!attendanceId || !checkOut) {
        throw new Error('Missing attendanceId or checkOut time');
      }
      
      console.log('Updating attendance check-out:', {
        attendanceId,
        checkOut
      });
      
      // Сначала получаем текущую страницу
      const page = await notion.pages.retrieve({ page_id: attendanceId });
      
      // Ищем поле описания адаптивно
      let currentDescription = '';
      let descriptionField = null;
      const descriptionFields = ['Description', 'Описание', 'Content', 'Содержание'];
      
      for (const field of descriptionFields) {
        if (page.properties[field]?.rich_text) {
          currentDescription = page.properties[field].rich_text[0]?.text?.content || '';
          descriptionField = field;
          console.log(`Found description field: ${field}`);
          break;
        }
      }
      
      if (!descriptionField) {
        console.error('Could not find description field in page properties');
        throw new Error('Description field not found');
      }
      
      // Добавляем время ухода к описанию
      const checkOutTime = formatPhuketTime(checkOut);
      
      const updatedDescription = currentDescription + `\nВремя ухода: ${checkOutTime}`;
      
      // Ищем поле статуса адаптивно
      let statusField = null;
      const statusFields = ['Status', 'Статус'];
      
      for (const field of statusFields) {
        if (page.properties[field]?.select !== undefined) {
          statusField = field;
          console.log(`Found status field: ${field}`);
          break;
        }
      }
      
      // Формируем объект обновления
      const updateProperties = {
        [descriptionField]: {
          rich_text: [
            { 
              text: { 
                content: updatedDescription
              } 
            }
          ]
        }
      };
      
      // Добавляем статус только если нашли поле
      if (statusField) {
        updateProperties[statusField] = {
          select: { name: 'Выполнена' }
        };
      }
      
      const response = await notion.pages.update({
        page_id: attendanceId,
        properties: updateProperties
      });
      
      console.log('Attendance check-out updated successfully');
      return response;
    } catch (error) {
      console.error('Notion update attendance check-out error:', error);
      throw error;
    }
  },

  // Получить все записи учета времени за период
  async getAttendanceForPeriod(startDate, endDate, employeeId = null) {
    try {
      if (!ATTENDANCE_DB_ID) {
        console.error('ATTENDANCE_DB_ID is not set!');
        return [];
      }
      
      const filters = [
        {
          property: 'Date',
          date: {
            on_or_after: startDate
          }
        },
        {
          property: 'Date',
          date: {
            on_or_before: endDate
          }
        }
      ];
      
      if (employeeId) {
        filters.push({
          property: 'Employee ID',
          number: {
            equals: typeof employeeId === 'string' ? parseInt(employeeId, 10) : employeeId
          }
        });
      }
      
      const response = await notion.databases.query({
        database_id: ATTENDANCE_DB_ID,
        filter: {
          and: filters
        },
        sorts: [
          {
            property: 'Date',
            direction: 'descending'
          },
          {
            property: 'Check In',
            direction: 'descending'
          }
        ]
      });
      
      return response.results.map(attendance => ({
        id: attendance.id,
        employeeName: attendance.properties['Employee Name']?.title?.[0]?.text?.content || '',
        employeeId: attendance.properties['Employee ID']?.number,
        date: attendance.properties['Date']?.date?.start,
        checkIn: attendance.properties['Check In']?.date?.start,
        checkOut: attendance.properties['Check Out']?.date?.start || null,
        status: attendance.properties['Status']?.select?.name || 'Present',
        late: attendance.properties['Late']?.checkbox || false,
        workHours: attendance.properties['Work Hours']?.formula?.number || null,
        notes: attendance.properties['Notes']?.rich_text?.[0]?.text?.content || ''
      }));
    } catch (error) {
      console.error('Notion get attendance for period error:', error);
      throw error;
    }
  },

  // Получить текущий статус присутствия всех сотрудников
  async getCurrentAttendanceStatus() {
    try {
      if (!ATTENDANCE_DB_ID) {
        console.error('ATTENDANCE_DB_ID is not set!');
        return [];
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString().split('T')[0];
      
      const response = await notion.databases.query({
        database_id: ATTENDANCE_DB_ID,
        filter: {
          property: 'Date',
          date: {
            equals: todayISO
          }
        },
        sorts: [
          {
            property: 'Check In',
            direction: 'descending'
          }
        ]
      });
      
      return response.results.map(attendance => ({
        employeeName: attendance.properties['Employee Name']?.title?.[0]?.text?.content || '',
        employeeId: attendance.properties['Employee ID']?.number,
        checkIn: attendance.properties['Check In']?.date?.start,
        checkOut: attendance.properties['Check Out']?.date?.start || null,
        status: attendance.properties['Status']?.select?.name || 'Present',
        isPresent: !attendance.properties['Check Out']?.date?.start,
        workHours: attendance.properties['Work Hours']?.formula?.number || null
      }));
    } catch (error) {
      console.error('Notion get current attendance status error:', error);
      throw error;
    }
  }
};

module.exports = notionService;