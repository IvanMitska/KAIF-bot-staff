#!/bin/bash

# Скрипт для активации пользователей через API Railway

echo "🔄 Activating users on Railway..."

# Вызываем специальный эндпоинт для активации пользователей
curl -X GET "https://telegram-report-bot-production.up.railway.app/api/debug/activate-users"

echo ""
echo "✅ Done!"