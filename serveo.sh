#!/bin/bash

echo "🚀 Запуск Serveo туннеля для Web App..."
echo ""
echo "URL будет: https://kaifbot.serveo.net"
echo ""
echo "Нажмите Ctrl+C чтобы остановить"
echo ""

# Запускаем SSH туннель через Serveo
ssh -R kaifbot:80:localhost:3001 serveo.net