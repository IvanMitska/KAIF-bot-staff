const localtunnel = require('localtunnel');

async function startTunnel() {
  try {
    const tunnel = await localtunnel({ 
      port: 3001,
      subdomain: 'kaifbot-' + Math.random().toString(36).substring(7)
    });

    console.log('🚀 Web App доступен по адресу:', tunnel.url);
    console.log('\n📝 Добавьте этот URL в .env:');
    console.log(`WEBAPP_URL=${tunnel.url}`);
    
    // Держим туннель открытым
    tunnel.on('close', () => {
      console.log('Туннель закрыт');
      process.exit();
    });

    // Обработка ошибок
    tunnel.on('error', err => {
      console.error('Ошибка туннеля:', err);
    });

  } catch (err) {
    console.error('Не удалось создать туннель:', err);
  }
}

startTunnel();