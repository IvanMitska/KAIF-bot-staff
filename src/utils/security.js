const crypto = require('crypto');

// Whitelist пользователей из переменной окружения
const ALLOWED_USERS = process.env.ALLOWED_USER_IDS 
  ? process.env.ALLOWED_USER_IDS.split(',').map(id => parseInt(id.trim()))
  : [];

// Rate limiter хранилище
const rateLimiter = new Map();

// Максимальные размеры полей
const FIELD_LIMITS = {
  name: 100,
  position: 100,
  report: 1000,
  default: 500
};

const security = {
  /**
   * Проверка авторизации пользователя
   */
  isUserAuthorized(userId) {
    // Если whitelist не настроен, разрешаем всем (для обратной совместимости)
    if (ALLOWED_USERS.length === 0) {
      console.warn('SECURITY WARNING: No user whitelist configured. All users allowed.');
      return true;
    }
    
    return ALLOWED_USERS.includes(userId);
  },

  /**
   * Санитизация пользовательского ввода
   */
  sanitizeInput(text, maxLength = FIELD_LIMITS.default) {
    if (!text || typeof text !== 'string') return '';
    
    // Удаляем потенциально опасные символы для Telegram/Markdown
    let sanitized = text
      .replace(/[<>]/g, '') // HTML теги
      .replace(/```/g, '\'\'\'') // Code blocks
      .trim();
    
    // Ограничиваем длину
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength - 3) + '...';
    }
    
    return sanitized;
  },

  /**
   * Экранирование специальных символов для Markdown
   */
  escapeMarkdown(text) {
    if (!text) return '';
    
    // Экранируем специальные символы Markdown
    return text.replace(/[*_`\[\]()~>#+=|{}.!-]/g, '\\$&');
  },

  /**
   * Проверка rate limit
   */
  checkRateLimit(userId, action = 'default', limit = 10, windowMs = 60000) {
    const now = Date.now();
    const key = `${userId}:${action}`;
    const userLimits = rateLimiter.get(key) || [];
    
    // Удаляем старые записи
    const recentRequests = userLimits.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= limit) {
      const resetTime = Math.ceil((recentRequests[0] + windowMs - now) / 1000);
      return { 
        allowed: false, 
        resetIn: resetTime,
        remaining: 0 
      };
    }
    
    recentRequests.push(now);
    rateLimiter.set(key, recentRequests);
    
    return { 
      allowed: true, 
      remaining: limit - recentRequests.length - 1,
      resetIn: Math.ceil(windowMs / 1000)
    };
  },

  /**
   * Очистка rate limiter (для запуска по расписанию)
   */
  cleanupRateLimiter() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, requests] of rateLimiter.entries()) {
      const recentRequests = requests.filter(time => now - time < 3600000); // Храним час
      
      if (recentRequests.length === 0) {
        rateLimiter.delete(key);
        cleaned++;
      } else {
        rateLimiter.set(key, recentRequests);
      }
    }
    
    return cleaned;
  },

  /**
   * Безопасное логирование (скрывает чувствительные данные)
   */
  secureLog(message, data = {}) {
    const sanitized = { ...data };
    
    // Скрываем чувствительные данные
    if (sanitized.userId) {
      sanitized.userId = `USER_${crypto.createHash('sha256')
        .update(sanitized.userId.toString())
        .digest('hex')
        .substring(0, 8)}`;
    }
    
    if (sanitized.telegramId) {
      sanitized.telegramId = `TG_${crypto.createHash('sha256')
        .update(sanitized.telegramId.toString())
        .digest('hex')
        .substring(0, 8)}`;
    }
    
    if (sanitized.text && sanitized.text.length > 50) {
      sanitized.text = sanitized.text.substring(0, 47) + '...';
    }
    
    if (sanitized.token) {
      sanitized.token = sanitized.token.substring(0, 10) + '...';
    }
    
    console.log(`[${new Date().toISOString()}] ${message}`, sanitized);
  },

  /**
   * Валидация полей отчета
   */
  validateReportField(field, value, fieldName) {
    const errors = [];
    
    if (!value || typeof value !== 'string') {
      errors.push(`${fieldName} не может быть пустым`);
      return { valid: false, errors };
    }
    
    const trimmed = value.trim();
    
    if (trimmed.length < 3) {
      errors.push(`${fieldName} слишком короткое (минимум 3 символа)`);
    }
    
    if (trimmed.length > FIELD_LIMITS.report) {
      errors.push(`${fieldName} слишком длинное (максимум ${FIELD_LIMITS.report} символов)`);
    }
    
    // Проверка на спам (повторяющиеся символы)
    if (/(.)\1{10,}/.test(trimmed)) {
      errors.push(`${fieldName} содержит подозрительный контент`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      sanitized: this.sanitizeInput(trimmed, FIELD_LIMITS.report)
    };
  },

  /**
   * Генерация безопасного ID сессии
   */
  generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  },

  /**
   * Получение лимитов полей
   */
  getFieldLimits() {
    return { ...FIELD_LIMITS };
  }
};

// Очистка rate limiter каждый час
setInterval(() => {
  const cleaned = security.cleanupRateLimiter();
  if (cleaned > 0) {
    security.secureLog('Rate limiter cleanup', { cleaned });
  }
}, 3600000);

module.exports = security;