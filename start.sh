#!/bin/bash
# Скрипт для запуска бота и Web App на Railway

echo "Starting KAIF Bot and Web App..."

# Запускаем Web App в фоне
node webapp/server.js &
WEBAPP_PID=$!

# Даем время Web App запуститься
sleep 2

# Запускаем бота
node src/app.js &
BOT_PID=$!

echo "Web App started with PID: $WEBAPP_PID"
echo "Bot started with PID: $BOT_PID"

# Ожидаем завершения любого из процессов
wait $WEBAPP_PID $BOT_PID