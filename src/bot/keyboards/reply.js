// Reply клавиатуры для навигации

const mainMenuKeyboard = () => ({
  keyboard: [
    ['🚀 KAIF App'],
    ['📝 Отчет', '📊 Статистика'],
    ['✅ Задачи', '❓ Помощь']
  ],
  resize_keyboard: true,
  persistent: true,
  one_time_keyboard: false
});

const managerMenuKeyboard = () => ({
  keyboard: [
    ['🚀 KAIF App'],
    ['📝 Отчет', '📊 Статистика'],
    ['✅ Задачи', '⚡ Быстрая задача'],
    ['👥 Сотрудники', '❓ Помощь']
  ],
  resize_keyboard: true,
  persistent: true,
  one_time_keyboard: false
});

module.exports = {
  mainMenuKeyboard,
  managerMenuKeyboard
};