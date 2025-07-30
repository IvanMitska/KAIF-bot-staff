const https = require('https');

/**
 * Функция для поддержания бота в активном состоянии
 * Отправляет запрос на свой URL каждые 14 минут
 */
function keepAlive(appUrl) {
  if (!appUrl || process.env.NODE_ENV !== 'production') {
    console.log('Keep-alive не активирован (только для production)');
    return;
  }

  setInterval(() => {
    https.get(appUrl + '/health', (res) => {
      console.log(`Keep-alive ping: ${res.statusCode}`);
    }).on('error', (err) => {
      console.error('Keep-alive error:', err.message);
    });
  }, 14 * 60 * 1000); // 14 минут

  console.log('Keep-alive активирован для:', appUrl);
}

module.exports = keepAlive;