const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const USERS_DB_ID = process.env.NOTION_DATABASE_USERS_ID;
const REPORTS_DB_ID = process.env.NOTION_DATABASE_REPORTS_ID;
const TASKS_DB_ID = process.env.NOTION_DATABASE_TASKS_ID;

console.log('Notion databases configured:');
console.log('- Users DB:', USERS_DB_ID);
console.log('- Reports DB:', REPORTS_DB_ID);
console.log('- Tasks DB:', TASKS_DB_ID);

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
            number: taskData.assigneeId
          },
          'Постановщик': {
            rich_text: [{ text: { content: taskData.creatorName } }]
          },
          'Постановщик ID': {
            number: taskData.creatorId
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
      return response;
    } catch (error) {
      console.error('Notion create task error:', error);
      throw error;
    }
  },

  async getTasksByAssignee(telegramId, status = null) {
    try {
      const filters = [
        {
          property: 'Исполнитель ID',
          number: {
            equals: telegramId
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

      const response = await notion.databases.query({
        database_id: TASKS_DB_ID,
        filter: filters.length > 1 ? { and: filters } : filters[0],
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
      });

      return response.results.map(task => ({
        id: task.id,
        taskId: task.properties['ID'].title[0]?.text.content,
        title: task.properties['Название'].rich_text[0]?.text.content || '',
        description: task.properties['Описание'].rich_text[0]?.text.content || '',
        status: task.properties['Статус'].select?.name || 'Новая',
        priority: task.properties['Приоритет'].select?.name || 'Средний',
        createdDate: task.properties['Дата создания'].date?.start,
        deadline: task.properties['Срок выполнения'].date?.start,
        creatorName: task.properties['Постановщик'].rich_text[0]?.text.content || ''
      }));
    } catch (error) {
      console.error('Notion get tasks by assignee error:', error);
      throw error;
    }
  },

  async getAllTasks(status = null) {
    try {
      const filter = status ? {
        property: 'Статус',
        select: { equals: status }
      } : undefined;

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

      return response.results.map(task => ({
        id: task.id,
        taskId: task.properties['ID'].title[0]?.text.content,
        title: task.properties['Название'].rich_text[0]?.text.content || '',
        assigneeName: task.properties['Исполнитель'].rich_text[0]?.text.content || '',
        status: task.properties['Статус'].select?.name || 'Новая',
        priority: task.properties['Приоритет'].select?.name || 'Средний',
        createdDate: task.properties['Дата создания'].date?.start,
        deadline: task.properties['Срок выполнения'].date?.start
      }));
    } catch (error) {
      console.error('Notion get all tasks error:', error);
      throw error;
    }
  },

  async updateTaskStatus(taskId, status, comment = null) {
    try {
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

      const response = await notion.pages.update({
        page_id: taskId,
        properties: properties
      });

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
  }
};

module.exports = notionService;