#!/bin/bash

echo "🔍 Проверка безопасности перед push..."

# Проверка на наличие токенов
if grep -r "AAE[a-zA-Z0-9_-]*" . --exclude-dir=node_modules --exclude-dir=.git --exclude="*.log" 2>/dev/null | grep -v ".env"; then
    echo "❌ ОШИБКА: Найден Telegram токен в коде!"
    echo "Удалите токены из кода перед push"
    exit 1
fi

if grep -r "ntn_[a-zA-Z0-9]*" . --exclude-dir=node_modules --exclude-dir=.git --exclude="*.log" 2>/dev/null | grep -v ".env"; then
    echo "❌ ОШИБКА: Найден Notion API ключ в коде!"
    echo "Удалите ключи из кода перед push"
    exit 1
fi

# Проверка .gitignore
if [ ! -f .gitignore ]; then
    echo "❌ ОШИБКА: Отсутствует .gitignore!"
    exit 1
fi

if ! grep -q "^\.env$" .gitignore; then
    echo "❌ ОШИБКА: .env не добавлен в .gitignore!"
    exit 1
fi

# Проверка на тестовые файлы
test_files=$(find . -name "test-*.js" -o -name "check-*.js" -o -name "fix-*.js" 2>/dev/null | grep -v node_modules)
if [ ! -z "$test_files" ]; then
    echo "⚠️  Предупреждение: Найдены тестовые файлы:"
    echo "$test_files"
    echo "Рекомендуется удалить их перед push"
fi

echo "✅ Базовая проверка пройдена!"
echo ""
echo "📋 Контрольный список:"
echo "- [ ] Удалены все токены и ключи из кода"
echo "- [ ] .env добавлен в .gitignore"
echo "- [ ] Удалены тестовые файлы"
echo "- [ ] Обновлен README.md"
echo ""
echo "Если все готово, выполните:"
echo "git add ."
echo "git commit -m 'ваше сообщение'"
echo "git push origin main"