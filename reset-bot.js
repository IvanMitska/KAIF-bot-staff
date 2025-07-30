require('dotenv').config();
const https = require('https');

const token = process.env.TELEGRAM_BOT_TOKEN;

console.log('Resetting bot...');

// Удаляем webhook
https.get(`https://api.telegram.org/bot${token}/deleteWebhook`, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Delete webhook result:', JSON.parse(data));
    
    // Получаем обновления с offset -1 чтобы получить все
    setTimeout(() => {
      https.get(`https://api.telegram.org/bot${token}/getUpdates?offset=-1`, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          const updates = JSON.parse(data);
          console.log('\nUpdates after reset:', updates.ok);
          console.log('Number of updates:', updates.result?.length || 0);
          
          if (updates.result && updates.result.length > 0) {
            updates.result.forEach((update, i) => {
              if (update.message) {
                console.log(`\nUpdate ${i + 1}:`);
                console.log('From:', update.message.from.username || update.message.from.id);
                console.log('Text:', update.message.text);
                console.log('Date:', new Date(update.message.date * 1000).toISOString());
              }
            });
          }
        });
      });
    }, 1000);
  });
});