// Функция для получения URL веб-приложения
function getWebAppUrl() {
  let webAppUrl = process.env.WEBAPP_URL;
  
  if (!webAppUrl) {
    if (process.env.RAILWAY_STATIC_URL) {
      webAppUrl = `https://${process.env.RAILWAY_STATIC_URL}/webapp/public`;
    } else if (process.env.RAILWAY_PUBLIC_DOMAIN) {
      webAppUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/webapp/public`;
    } else if (process.env.RAILWAY_DEPLOYMENT_NAME) {
      webAppUrl = `https://${process.env.RAILWAY_DEPLOYMENT_NAME}.up.railway.app/webapp/public`;
    } else {
      webAppUrl = 'https://telegram-report-bot-production.up.railway.app/webapp/public';
    }
  }
  
  if (webAppUrl.startsWith('http://') && !webAppUrl.includes('localhost')) {
    webAppUrl = webAppUrl.replace('http://', 'https://');
  }
  
  return webAppUrl;
}

module.exports = {
  mainMenu: () => {
    const webAppUrl = getWebAppUrl();
    return {
      inline_keyboard: [
        [
          { text: '🚀 Открыть KAIF App', web_app: { url: webAppUrl } }
        ]
      ]
    };
  },

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

  reminderOptions: () => {
    const webAppUrl = getWebAppUrl();
    return {
      inline_keyboard: [
        [
          { text: '📝 Отправить отчет', web_app: { url: webAppUrl } }
        ],
        [
          { text: '⏰ Напомнить через час', callback_data: 'remind_later' }
        ]
      ]
    };
  },

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