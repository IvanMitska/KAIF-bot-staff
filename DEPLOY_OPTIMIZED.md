# 🚀 Деплой оптимизированного бота на хостинг

## ⚠️ ВАЖНО ПРО SQLite И ДЕПЛОЙ

### Проблема с SQLite на бесплатных хостингах:
- **Railway, Render, Heroku** - используют **эфемерную файловую систему**
- SQLite база **удаляется при каждом редеплое**
- Данные в `cache.db` **НЕ СОХРАНЯЮТСЯ** между деплоями

## ✅ РЕШЕНИЯ

### Вариант 1: PostgreSQL на Railway (РЕКОМЕНДУЮ)
Railway предоставляет **бесплатную PostgreSQL** базу данных с постоянным хранением.

#### Шаги для миграции на PostgreSQL:

1. **Установите зависимости локально:**
```bash
npm install pg
npm uninstall sqlite3
```

2. **Создам адаптированный сервис для PostgreSQL:**

Создайте файл `src/services/cacheServicePG.js`:
```javascript
const { Pool } = require('pg');

class CacheServicePG {
  constructor() {
    // Railway автоматически предоставляет DATABASE_URL
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  async initialize() {
    await this.createTables();
    console.log('✅ PostgreSQL cache connected');
  }

  // Остальной код остается тем же, только меняем SQL синтаксис
  // SQLite → PostgreSQL
}
```

3. **В Railway:**
- Добавьте PostgreSQL плагин к проекту
- Railway автоматически добавит `DATABASE_URL`
- Деплойте через GitHub

### Вариант 2: Использовать только Notion (без кэша)
Если хостинг не поддерживает постоянные базы данных:

1. **Переключитесь на обычную версию:**
```bash
# Используйте оригинальные файлы
git checkout -- src/services/notionService.js
```

2. **Деплойте обычную версию:**
```bash
git add .
git commit -m "Use direct Notion API for hosting"
git push
```

### Вариант 3: Гибридный режим
Используйте кэш только локально, а на хостинге - прямое подключение к Notion:

```javascript
// В начале optimizedNotionService.js
const USE_CACHE = process.env.USE_CACHE !== 'false' && 
                  !process.env.DYNO && // Не Heroku
                  !process.env.RAILWAY_ENVIRONMENT && // Не Railway
                  !process.env.RENDER; // Не Render

if (!USE_CACHE) {
  // Экспортируем обычный notionService
  module.exports = require('./notionService');
  return;
}
// Остальной код с кэшем...
```

## 📦 ДЕПЛОЙ НА RAILWAY (Рекомендую)

### Подготовка для Railway:

1. **Создайте `railway.json`:**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

2. **Обновите `package.json`:**
```json
{
  "scripts": {
    "start": "node start-production.js",
    "start:dev": "node start-optimized.js"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
```

3. **Создайте `start-production.js`:**
```javascript
// Для продакшена без локального кэша
require('dotenv').config();

// Проверяем окружение
if (process.env.DATABASE_URL) {
  // Есть PostgreSQL - используем его
  console.log('Using PostgreSQL cache');
  require('./start-optimized.js');
} else {
  // Нет БД - используем прямое подключение к Notion
  console.log('Using direct Notion API');
  require('./src/app.js');
}
```

### Деплой на Railway:

1. **Создайте проект на Railway:**
```bash
# Установите Railway CLI
npm install -g @railway/cli

# Логин
railway login

# Создайте проект
railway init
```

2. **Добавьте PostgreSQL:**
```bash
railway add
# Выберите PostgreSQL
```

3. **Установите переменные окружения:**
```bash
railway variables set TELEGRAM_BOT_TOKEN="your_token"
railway variables set NOTION_API_KEY="your_key"
railway variables set NOTION_DATABASE_USERS_ID="your_id"
railway variables set NOTION_DATABASE_REPORTS_ID="your_id"
railway variables set NOTION_DATABASE_TASKS_ID="your_id"
railway variables set ALLOWED_USER_IDS="id1,id2,id3"
```

4. **Деплой:**
```bash
railway up
```

## 📦 ДЕПЛОЙ НА RENDER

Для Render используйте прямое подключение к Notion (без кэша):

1. **Создайте `render.yaml`:**
```yaml
services:
  - type: web
    name: telegram-bot
    env: node
    buildCommand: npm install
    startCommand: node src/app.js
    envVars:
      - key: TELEGRAM_BOT_TOKEN
        sync: false
      - key: NOTION_API_KEY
        sync: false
```

2. **Подключите GitHub репозиторий к Render**

3. **Установите Environment Variables в настройках Render**

## 🐳 DOCKER (для VPS)

Если у вас есть VPS, используйте Docker с volume для сохранения БД:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Создаем volume для БД
VOLUME ["/app/data"]

ENV NODE_ENV=production

CMD ["node", "start-optimized.js"]
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  bot:
    build: .
    volumes:
      - bot-data:/app/data
    environment:
      - DATABASE_PATH=/app/data/cache.db
    env_file: .env
    restart: unless-stopped

volumes:
  bot-data:
```

## 📝 ЧЕК-ЛИСТ ПЕРЕД ДЕПЛОЕМ

### Для GitHub:
- [x] Добавить `*.db` в `.gitignore`
- [x] Не коммитить `cache.db`
- [x] Не коммитить `.env`
- [x] Проверить что все sensitive данные в `.gitignore`

### Для хостинга:
- [ ] Выбрать стратегию (PostgreSQL / Direct Notion / Hybrid)
- [ ] Настроить переменные окружения на хостинге
- [ ] Проверить `package.json` scripts
- [ ] Протестировать локально перед деплоем

## 🔧 КОМАНДЫ ДЛЯ РАЗНЫХ РЕЖИМОВ

```bash
# Локальная разработка с кэшем
npm run start:optimized

# Продакшен без кэша (Notion напрямую)  
npm start

# Тестирование
npm run test

# Миграция на PostgreSQL (если выбрали вариант 1)
npm run migrate:pg
```

## ⚡ ПРОИЗВОДИТЕЛЬНОСТЬ НА ХОСТИНГЕ

### С PostgreSQL на Railway:
- Отклик: **50-100мс** (быстро)
- Надежность: ⭐⭐⭐⭐⭐
- Стоимость: Бесплатно (с лимитами)

### Без кэша (прямой Notion):
- Отклик: **2-5 секунд** (медленно)
- Надежность: ⭐⭐⭐
- Стоимость: Бесплатно

### С VPS + Docker:
- Отклик: **5-50мс** (очень быстро)
- Надежность: ⭐⭐⭐⭐⭐
- Стоимость: ~$5/месяц

## 🆘 ПРОБЛЕМЫ И РЕШЕНИЯ

### "Database is locked" на хостинге
- Используйте PostgreSQL вместо SQLite

### "ENOENT: no such file cache.db"
- База удалилась при редеплое
- Переключитесь на PostgreSQL или прямой Notion

### Медленная работа после деплоя
- Проверьте что кэш работает: `/stats` команда
- Возможно используется прямое подключение к Notion

### Данные не синхронизируются
- Проверьте NOTION_API_KEY
- Проверьте логи: `railway logs`

---

**Рекомендация:** Для продакшена используйте **Railway + PostgreSQL** или **VPS + Docker**. 
Это даст вам и скорость, и надежность!