# Настройка Railway PostgreSQL для бота

## 🚀 Быстрый старт

### 1. Получите DATABASE_URL из Railway

1. Зайдите в [Railway Dashboard](https://railway.app/dashboard)
2. Выберите ваш проект
3. Нажмите на сервис PostgreSQL
4. Перейдите во вкладку **Variables**
5. Скопируйте значение `DATABASE_URL`

URL выглядит примерно так:
```
postgresql://postgres:PASSWORD@containers-us-west-XXX.railway.app:PORT/railway
```

### 2. Добавьте DATABASE_URL в .env

Откройте файл `.env` и добавьте:
```env
DATABASE_URL=ваш_url_из_railway
```

### 3. Мигрируйте данные из Notion

```bash
# Установите зависимости
npm install

# Запустите миграцию
node migrate-to-railway.js
```

Миграция перенесет:
- ✅ Всех пользователей
- ✅ Все задачи (100+)
- ✅ Все отчеты
- ✅ Записи учета времени

### 4. Запустите бота

```bash
npm start
```

## 📊 Преимущества Railway PostgreSQL

- **Скорость**: <50ms вместо 2-5 секунд через Notion API
- **Надежность**: База данных всегда доступна
- **Масштабируемость**: Поддержка тысяч пользователей
- **Автоматический бэкап**: Railway делает бэкапы автоматически

## 🔧 Проверка подключения

При запуске бота вы увидите:
```
🔗 Connecting to Railway PostgreSQL...
📍 Database URL found: containers-us-west-XXX.railway.app
✅ Railway PostgreSQL connected successfully!
📊 Database stats: { users: 8, tasks: 100, reports: 117, attendance: 0 }
```

## ⚠️ Решение проблем

### Ошибка подключения
```
❌ PostgreSQL connection failed
```
**Решение**: Проверьте DATABASE_URL в .env файле

### База данных не создана
```
relation "users" does not exist
```
**Решение**: Запустите миграцию `node migrate-to-railway.js`

### Медленная работа
Если бот работает медленно, проверьте логи:
```
⚠️ DATABASE_URL not configured
⚠️ Using direct Notion API calls (slower)
```
**Решение**: Добавьте DATABASE_URL в .env

## 📝 Структура базы данных

Railway PostgreSQL содержит 4 таблицы:

1. **users** - пользователи бота
2. **tasks** - задачи
3. **reports** - ежедневные отчеты
4. **attendance** - учет рабочего времени

## 🔄 Синхронизация с Notion

Бот работает в режиме "write-through cache":
1. Данные сначала сохраняются в PostgreSQL (мгновенно)
2. Затем асинхронно синхронизируются с Notion
3. При чтении сначала проверяется кэш, потом Notion

## 🚀 Деплой на Railway

1. Push код в GitHub:
```bash
git add .
git commit -m "feat: Railway PostgreSQL integration"
git push
```

2. Railway автоматически задеплоит изменения

## 📊 Мониторинг

Проверить статистику базы:
```javascript
const stats = await railwayService.getStats();
console.log(stats);
// { users: 8, tasks: 100, reports: 117, attendance: 0, sizeMB: "0.45" }
```