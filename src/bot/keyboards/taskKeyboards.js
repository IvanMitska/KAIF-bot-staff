const taskKeyboards = {
  managerMenu: () => ({
    inline_keyboard: [
      [{ text: '➕ Создать задачу', callback_data: 'new_task' }],
      [{ text: '📋 Все задачи', callback_data: 'all_tasks' }],
      [{ text: '✅ Выполненные', callback_data: 'completed_tasks' }],
      [{ text: '⏳ В работе', callback_data: 'in_progress_tasks' }],
      [{ text: '🔄 Новые', callback_data: 'new_tasks' }],
      [{ text: '⬅️ Назад', callback_data: 'back_to_menu' }]
    ]
  }),
  
  employeeMenu: () => ({
    inline_keyboard: [
      [{ text: '📋 Мои задачи', callback_data: 'my_tasks' }],
      [{ text: '🔄 Новые задачи', callback_data: 'my_new_tasks' }],
      [{ text: '⏳ В работе', callback_data: 'my_in_progress_tasks' }],
      [{ text: '✅ Выполненные', callback_data: 'my_completed_tasks' }],
      [{ text: '⬅️ Назад', callback_data: 'back_to_menu' }]
    ]
  }),
  
  selectEmployee: (employees) => ({
    inline_keyboard: [
      ...employees.map(emp => ([{
        text: `${emp.name} - ${emp.position}`,
        callback_data: `assign_to_${emp.telegramId}`
      }])),
      [{ text: '❌ Отмена', callback_data: 'cancel_task' }]
    ]
  }),
  
  taskPriority: () => ({
    inline_keyboard: [
      [{ text: '🔴 Высокий', callback_data: 'priority_high' }],
      [{ text: '🟡 Средний', callback_data: 'priority_medium' }],
      [{ text: '🟢 Низкий', callback_data: 'priority_low' }],
      [{ text: '❌ Отмена', callback_data: 'cancel_task' }]
    ]
  }),
  
  taskActions: (taskId, canComplete = false) => {
    const buttons = [];
    
    if (canComplete) {
      buttons.push([{ text: '✅ Выполнена', callback_data: `complete_task_${taskId}` }]);
      buttons.push([{ text: '⏳ В работе', callback_data: `start_task_${taskId}` }]);
    }
    
    buttons.push([{ text: '💬 Добавить комментарий', callback_data: `comment_task_${taskId}` }]);
    buttons.push([{ text: '⬅️ Назад', callback_data: 'my_tasks' }]);
    
    return { inline_keyboard: buttons };
  },
  
  confirmTaskCreation: () => ({
    inline_keyboard: [
      [{ text: '✅ Создать', callback_data: 'confirm_create_task' }],
      [{ text: '❌ Отмена', callback_data: 'cancel_task' }]
    ]
  })
};

module.exports = { taskKeyboards };