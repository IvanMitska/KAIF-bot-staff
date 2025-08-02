#!/bin/bash

echo "🚀 Запуск Cloudflare Tunnel для Web App..."
echo ""
echo "Установка cloudflared если не установлен..."

# Проверяем установлен ли cloudflared
if ! command -v cloudflared &> /dev/null; then
    echo "cloudflared не найден. Установка..."
    
    # Для macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install cloudflare/cloudflare/cloudflared
    # Для Linux
    else
        wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
        sudo dpkg -i cloudflared-linux-amd64.deb
        rm cloudflared-linux-amd64.deb
    fi
fi

echo ""
echo "📡 Запуск туннеля..."
echo ""

# Запускаем туннель
cloudflared tunnel --url http://localhost:3001

# Альтернативный вариант с кастомным поддоменом (требует аккаунт Cloudflare)
# cloudflared tunnel --hostname your-bot.trycloudflare.com --url http://localhost:3001