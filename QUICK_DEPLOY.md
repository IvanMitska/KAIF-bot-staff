# 🚀 БЫСТРЫЙ ДЕПЛОЙ (5 минут)

## 1️⃣ Подготовка (в терминале)
```bash
# Проверка безопасности
./check-before-push.sh

# Инициализация Git
git init
git add .
git commit -m "Initial commit"
```

## 2️⃣ GitHub
1. Создайте приватный репозиторий на github.com
2. НЕ добавляйте README при создании
3. Скопируйте URL репозитория

```bash
# Замените YOUR_USERNAME на ваш GitHub username
git remote add origin https://github.com/YOUR_USERNAME/telegram-report-bot.git
git branch -M main
git push -u origin main
```

## 3️⃣ Render.com
1. Зарегистрируйтесь через GitHub
2. New → Web Service
3. Выберите ваш репозиторий
4. Настройки:
   - Name: `telegram-report-bot`
   - Build: `npm install`
   - Start: `npm start`
   - Plan: Free

## 4️⃣ Переменные окружения (в Render)
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
NOTION_API_KEY=your_notion_api_key_here
NOTION_DATABASE_REPORTS_ID=your_reports_database_id
NOTION_DATABASE_USERS_ID=your_users_database_id
NOTION_DATABASE_TASKS_ID=your_tasks_database_id
ALLOWED_USER_IDS=1734337242,385436658
NODE_ENV=production
PORT=10000
```

## 5️⃣ Деплой
1. Create Web Service
2. Ждите "Live"
3. Проверьте в Telegram

## 6️⃣ Обновления
```bash
git add .
git commit -m "Update"
git push
```

Render обновится автоматически!

---
⚠️ **ВАЖНО**: Добавьте свой Telegram ID в ALLOWED_USER_IDS!