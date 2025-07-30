# 🛡️ Рекомендации по безопасности

## 1. Авторизация пользователей

### Проблема
Любой пользователь Telegram может зарегистрироваться в боте.

### Решение
```javascript
// Добавить whitelist разрешенных Telegram ID
const ALLOWED_USERS = process.env.ALLOWED_USER_IDS?.split(',').map(id => parseInt(id)) || [];

// Проверка при регистрации
if (!ALLOWED_USERS.includes(userId)) {
  await bot.sendMessage(chatId, 'Извините, вы не авторизованы для использования этого бота.');
  return;
}
```

## 2. Защита токенов

### Проблема
API ключи хранятся в .env файле без дополнительной защиты.

### Решение
- Использовать переменные окружения сервера
- Шифровать токены в .env
- Использовать секретные хранилища (AWS Secrets Manager, HashiCorp Vault)

## 3. Валидация и санитизация ввода

### Проблема
Пользовательский ввод не проверяется и не очищается.

### Решение
```javascript
// Функция санитизации
function sanitizeInput(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Удаляем HTML/Markdown специальные символы
  return text
    .replace(/[<>]/g, '')
    .replace(/[*_`\[\]()~>#+=|{}.!-]/g, '\\$&')
    .trim()
    .substring(0, 1000); // Ограничение длины
}

// Использование
const sanitizedName = sanitizeInput(msg.text);
```

## 4. Защита от спама (Rate Limiting)

### Проблема
Нет ограничений на количество запросов.

### Решение
```javascript
const rateLimiter = new Map();

function checkRateLimit(userId, limit = 10, window = 60000) {
  const now = Date.now();
  const userLimits = rateLimiter.get(userId) || [];
  
  // Удаляем старые записи
  const recentRequests = userLimits.filter(time => now - time < window);
  
  if (recentRequests.length >= limit) {
    return false; // Превышен лимит
  }
  
  recentRequests.push(now);
  rateLimiter.set(userId, recentRequests);
  return true;
}

// Использование
if (!checkRateLimit(userId)) {
  await bot.sendMessage(chatId, 'Слишком много запросов. Попробуйте позже.');
  return;
}
```

## 5. Ограничение размера данных

### Проблема
Нет ограничений на размер отчетов.

### Решение
```javascript
const MAX_FIELD_LENGTH = 1000;

// В обработчике отчетов
if (text.length > MAX_FIELD_LENGTH) {
  await bot.sendMessage(chatId, 
    `Текст слишком длинный. Максимум ${MAX_FIELD_LENGTH} символов.`
  );
  return;
}
```

## 6. Безопасное логирование

### Проблема
Логируется чувствительная информация.

### Решение
```javascript
// Безопасный логгер
function secureLog(message, data = {}) {
  const sanitized = {
    ...data,
    userId: data.userId ? `USER_${crypto.createHash('sha256')
      .update(data.userId.toString())
      .digest('hex').substring(0, 8)}` : undefined,
    text: data.text ? '[REDACTED]' : undefined
  };
  
  console.log(message, sanitized);
}
```

## 7. Контроль доступа к данным

### Проблема
Нет разделения прав доступа.

### Решение
```javascript
// Добавить роли пользователей
const UserRoles = {
  EMPLOYEE: 'employee',
  MANAGER: 'manager',
  ADMIN: 'admin'
};

// Проверка прав
async function canViewReports(userId, targetUserId) {
  const user = await userService.getUserByTelegramId(userId);
  
  if (user.role === UserRoles.ADMIN) return true;
  if (user.role === UserRoles.MANAGER) return true;
  if (user.role === UserRoles.EMPLOYEE) return userId === targetUserId;
  
  return false;
}
```

## 8. Дополнительные меры

1. **HTTPS Only**: Использовать только защищенные соединения
2. **Audit Logs**: Логировать все действия пользователей
3. **Backup**: Регулярное резервное копирование данных
4. **Monitoring**: Мониторинг аномальной активности
5. **Updates**: Регулярное обновление зависимостей

## Приоритет внедрения

1. 🔴 **Срочно**: Whitelist пользователей, защита токенов
2. 🟠 **Важно**: Валидация ввода, rate limiting
3. 🟡 **Желательно**: Безопасное логирование, роли пользователей

## Контрольный список

- [ ] Внедрить whitelist разрешенных пользователей
- [ ] Перенести токены в защищенное хранилище
- [ ] Добавить валидацию всех пользовательских вводов
- [ ] Реализовать rate limiting
- [ ] Ограничить размер полей отчетов
- [ ] Удалить чувствительные данные из логов
- [ ] Добавить роли и права доступа
- [ ] Настроить мониторинг безопасности