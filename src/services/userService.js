const notionService = require('./railwayOptimizedService');

const userService = {
  async createUser(userData) {
    try {
      const user = {
        telegramId: userData.telegramId,
        username: userData.username,
        name: userData.name,
        position: userData.position,
        registrationDate: new Date().toISOString(),
        isActive: true
      };
      
      const notionUser = await notionService.createUser(user);
      return notionUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  async getUserByTelegramId(telegramId) {
    try {
      const user = await notionService.getUserByTelegramId(telegramId);
      return user;
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  },

  async updateUser(telegramId, updates) {
    try {
      const user = await notionService.updateUser(telegramId, updates);
      return user;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  async getAllActiveUsers() {
    try {
      const users = await notionService.getAllActiveUsers();
      return users;
    } catch (error) {
      console.error('Error getting active users:', error);
      throw error;
    }
  }
};

module.exports = userService;