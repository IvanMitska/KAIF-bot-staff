# Локальное тестирование Web App

## Быстрый старт

1. **Установите localtunnel:**
```bash
npm install -g localtunnel
```

2. **Запустите Web App и бота:**
```bash
npm run all
```

3. **В новом терминале создайте туннель:**
```bash
lt --port 3001 --subdomain kaifbot
```

Вы получите URL вида: `https://kaifbot.loca.lt`

4. **Добавьте URL в `.env`:**
```env
WEBAPP_URL=https://kaifbot.loca.lt
```

5. **Перезапустите бота** (Ctrl+C и снова `npm run all`)

## Альтернативный способ - Cloudflare

1. **Установите Cloudflare tunnel:**
```bash
brew install cloudflare/cloudflare/cloudflared
```

2. **Запустите туннель:**
```bash
cloudflared tunnel --url http://localhost:3001
```

3. **Используйте полученный URL в `.env`**

## Тестирование без туннеля

Для локального тестирования интерфейса без Telegram:

1. Откройте `http://localhost:3001` в браузере
2. В консоли браузера выполните:
```javascript
// Эмулируем данные Telegram
window.Telegram = {
  WebApp: {
    initData: 'user=%7B%22id%22%3A1734337242%2C%22first_name%22%3A%22Test%22%7D',
    initDataUnsafe: {
      user: {
        id: 1734337242,
        first_name: "Test User"
      }
    },
    ready: () => {},
    expand: () => {},
    showAlert: (msg) => alert(msg),
    themeParams: {
      bg_color: '#ffffff',
      text_color: '#000000',
      button_color: '#007aff'
    }
  }
};
// Перезагрузите страницу
location.reload();
```

## Проблемы и решения

### "Page not found" в Telegram
- Убедитесь что URL правильный и без слеша в конце
- Проверьте что Web App сервер запущен (порт 3001)
- Проверьте логи сервера

### Ошибки авторизации
- В разработке можно временно отключить проверку в `webapp/server.js`
- Убедитесь что пользователь зарегистрирован в боте

### Стили не применяются
- Проверьте консоль браузера на ошибки
- Убедитесь что `styles.css` загружается