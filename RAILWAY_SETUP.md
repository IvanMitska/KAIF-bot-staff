# Настройка Railway для telegram-report-bot

## ⚠️ ВАЖНО: Настройка переменных окружения

Для корректной работы бота с PostgreSQL базой данных на Railway необходимо настроить переменную DATABASE_URL.

### Шаги для настройки:

1. **Откройте Railway Dashboard**
   - Перейдите в проект с вашим ботом

2. **Выберите сервис `telegram-report-bot`**
   - Кликните на сервис бота (не на Postgres!)

3. **Перейдите на вкладку Variables**
   - В верхнем меню сервиса выберите "Variables"

4. **Добавьте Variable Reference**
   - Нажмите кнопку "Add a Variable Reference"
   - В появившемся окне выберите сервис "Postgres"
   - Выберите переменную `DATABASE_URL`
   - Нажмите "Add"

5. **Проверьте другие переменные**
   Убедитесь, что также настроены:
   - `TELEGRAM_BOT_TOKEN` - токен вашего бота
   - `NOTION_API_KEY` - ключ API Notion
   - `NOTION_DATABASE_REPORTS_ID` - ID базы отчетов
   - `NOTION_DATABASE_USERS_ID` - ID базы пользователей
   - `NOTION_DATABASE_TASKS_ID` - ID базы задач

6. **Сохраните и перезапустите**
   - Railway автоматически перезапустит сервис после добавления переменных

### Проверка подключения

После настройки в логах бота должно появиться:
```
🔗 Connecting to Railway PostgreSQL...
✅ Railway PostgreSQL connected successfully!
📊 Database stats: { users: X, reports: X, tasks: X, attendance: X }
```

### Если подключение не работает

Если вы видите сообщение:
```
⚠️ DATABASE_URL not configured
⚠️ Using direct Notion API calls (slower but working)
```

Это означает, что DATABASE_URL не настроен. Бот будет работать, но медленнее, так как будет напрямую обращаться к Notion API без кэширования.

### Структура DATABASE_URL

Правильный формат DATABASE_URL:
```
postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway
```

Для внешнего подключения (из локальной среды):
```
postgresql://postgres:PASSWORD@HOST.proxy.rlwy.net:PORT/railway
```

## Проверка работы

1. Отправьте боту команду `/start`
2. Попробуйте создать отчет
3. Проверьте, что отчет появился в таблице PostgreSQL

## Поддержка

При возникновении проблем проверьте:
1. Логи сервиса telegram-report-bot в Railway
2. Логи сервиса Postgres в Railway
3. Статус сервисов (должны быть зеленые индикаторы)