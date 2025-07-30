const https = require('https');

const token = '7532857659:AAEPe50lGzA_eSIw3DtYZV3Qkh0lquCXAFk';

console.log('Checking bot directly with token...\n');

// 1. Проверяем информацию о боте
https.get(`https://api.telegram.org/bot${token}/getMe`, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const botInfo = JSON.parse(data);
    console.log('1. Bot info:');
    console.log(botInfo);
    console.log('\n');
    
    // 2. Получаем все обновления
    https.get(`https://api.telegram.org/bot${token}/getUpdates`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const updates = JSON.parse(data);
        console.log('2. Updates:');
        console.log('OK:', updates.ok);
        console.log('Count:', updates.result?.length || 0);
        
        if (updates.result && updates.result.length > 0) {
          console.log('\nLast 5 updates:');
          updates.result.slice(-5).forEach((update, i) => {
            if (update.message) {
              console.log(`\nUpdate ${i + 1}:`);
              console.log('From:', update.message.from.username || update.message.from.id);
              console.log('Text:', update.message.text);
              console.log('Chat ID:', update.message.chat.id);
              console.log('Message ID:', update.message.message_id);
              console.log('Date:', new Date(update.message.date * 1000).toLocaleString());
            }
          });
          
          // Пробуем отправить тестовое сообщение последнему отправителю
          const lastMessage = updates.result[updates.result.length - 1].message;
          if (lastMessage) {
            console.log('\n3. Trying to send test message to chat:', lastMessage.chat.id);
            
            const postData = JSON.stringify({
              chat_id: lastMessage.chat.id,
              text: 'Тест! Если вы видите это сообщение, бот работает правильно. Отправьте /start еще раз.'
            });
            
            const options = {
              hostname: 'api.telegram.org',
              path: `/bot${token}/sendMessage`,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
              }
            };
            
            const req = https.request(options, (res) => {
              let data = '';
              res.on('data', (chunk) => data += chunk);
              res.on('end', () => {
                const response = JSON.parse(data);
                console.log('\nSend message result:');
                console.log(response);
              });
            });
            
            req.write(postData);
            req.end();
          }
        } else {
          console.log('\nNo updates found. Please send a message to the bot and run this script again.');
        }
      });
    });
  });
}).on('error', (err) => {
  console.error('Error:', err);
});