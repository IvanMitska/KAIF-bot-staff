module.exports = {
  mainMenu: () => ({
    inline_keyboard: [
      [
        { text: '📝 Отправить отчет', callback_data: 'send_report' },
        { text: '📊 Моя статистика', callback_data: 'my_stats' }
      ],
      [
        { text: '📋 История отчетов', callback_data: 'report_history' },
        { text: '❓ Помощь', callback_data: 'help' }
      ],
      [
        { text: '📂 Задачи', callback_data: 'tasks_menu' }
      ]
    ]
  }),

  reportStepNavigation: (step, canGoBack = true) => {
    const keyboard = [];
    const navigationRow = [];
    
    if (canGoBack) {
      navigationRow.push({ text: '⬅️ Назад', callback_data: 'report_back' });
    }
    
    navigationRow.push({ text: '➡️ Далее', callback_data: 'report_next' });
    navigationRow.push({ text: '❌ Отмена', callback_data: 'report_cancel' });
    
    keyboard.push(navigationRow);
    
    return { inline_keyboard: keyboard };
  },

  reportConfirmation: () => ({
    inline_keyboard: [
      [
        { text: '✅ Отправить', callback_data: 'report_confirm' },
        { text: '✏️ Изменить', callback_data: 'report_edit' }
      ],
      [
        { text: '❌ Отмена', callback_data: 'report_cancel' }
      ]
    ]
  }),

  reminderOptions: () => ({
    inline_keyboard: [
      [
        { text: '📝 Отправить отчет', callback_data: 'send_report' }
      ],
      [
        { text: '⏰ Напомнить через час', callback_data: 'remind_later' }
      ]
    ]
  }),

  reportEditMenu: () => ({
    inline_keyboard: [
      [
        { text: '1️⃣ Что сделал', callback_data: 'edit_done' }
      ],
      [
        { text: '2️⃣ Проблемы', callback_data: 'edit_problems' }
      ],
      [
        { text: '3️⃣ Цели на завтра', callback_data: 'edit_goals' }
      ],
      [
        { text: '⬅️ Назад к просмотру', callback_data: 'report_preview' }
      ]
    ]
  })
};