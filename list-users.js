require('dotenv').config();
const userService = require('./src/services/userService');
const railwayService = require('./src/services/railwayOptimizedService');

async function listUsers() {
  try {
    // Инициализация сервисов
    await railwayService.initialize();
    
    // Получаем всех пользователей
    const users = await userService.getAllActiveUsers();
    
    console.log('📋 Список активных пользователей:');
    console.log('=====================================');
    
    users.forEach(user => {
      console.log(`Имя: ${user.name.padEnd(20)} | Telegram ID: ${user.telegramId} | Должность: ${user.position || 'Не указано'}`);
    });
    
    console.log('=====================================');
    console.log(`Всего пользователей: ${users.length}`);
    
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    process.exit(0);
  }
}

listUsers();