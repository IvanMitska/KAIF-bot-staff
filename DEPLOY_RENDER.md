# 🚀 Деплой на Render.com за 5 минут

## 📋 Что нужно:
- GitHub аккаунт
- Аккаунт Render.com (бесплатный)

## 📝 Пошаговая инструкция:

### 1. Создайте репозиторий на GitHub

1. Зайдите на [github.com](https://github.com)
2. Нажмите "New repository"
3. Название: `telegram-report-bot`
4. Сделайте **Private** (приватным)
5. НЕ добавляйте README
6. Создайте репозиторий

### 2. Загрузите код на GitHub

```bash
# Добавьте удаленный репозиторий (замените YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/telegram-report-bot.git

# Отправьте код
git push -u origin main
```

### 3. Зарегистрируйтесь на Render

1. Зайдите на [render.com](https://render.com)
2. Нажмите "Get Started"
3. Войдите через GitHub

### 4. Создайте новый сервис

1. В дашборде нажмите "New +"
2. Выберите "Web Service"
3. Подключите GitHub (если еще не подключен)
4. Найдите ваш репозиторий `telegram-report-bot`
5. Нажмите "Connect"

### 5. Настройте сервис

Заполните поля:
- **Name**: `telegram-report-bot`
- **Region**: `Frankfurt (EU Central)`
- **Branch**: `main`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: `Free`

### 6. Добавьте переменные окружения

Нажмите "Advanced" и добавьте переменные:

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

### 7. Запустите деплой

1. Нажмите "Create Web Service"
2. Дождитесь окончания сборки (3-5 минут)
3. Статус должен стать "Live"

### 8. Проверьте работу

1. Откройте Telegram
2. Найдите вашего бота @Report_KAIF_bot
3. Отправьте /start

## ⚠️ Важно про бесплатный план:

Render отключает бота после 15 минут неактивности. Решения:

### Вариант 1: Бесплатный пингер
1. Зайдите на [cron-job.org](https://cron-job.org)
2. Создайте задачу
3. URL: `https://telegram-report-bot.onrender.com/health`
4. Интервал: каждые 14 минут

### Вариант 2: Платный план ($7/месяц)
- Бот работает 24/7 без перерывов
- Быстрее отвечает
- Больше ресурсов

## 🔄 Обновление бота:

```bash
git add .
git commit -m "Update bot"
git push
```

Render автоматически обновит бота!

## ❓ Проблемы?

1. **Бот не отвечает**: Проверьте логи в Render
2. **Ошибки при деплое**: Убедитесь, что все переменные добавлены
3. **Бот засыпает**: Настройте пингер

---

После деплоя можете продолжить разработку, а бот будет работать независимо!