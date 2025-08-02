const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Статические файлы для Web App
app.use('/webapp/public', express.static(path.join(__dirname, 'webapp/public')));
app.use('/webapp/static', express.static(path.join(__dirname, 'webapp/static')));

// API endpoints
app.use('/api', require('./webapp/server'));

// Главная страница
app.get('/', (req, res) => {
  res.send(`
    <h1>KAIF Bot Server</h1>
    <p>Bot is running!</p>
    <p>Web App: <a href="/webapp/public">/webapp/public</a></p>
  `);
});

// Запуск бота
require('./src/app');

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});