// Конфигурация приложения
export const Config = {
    // API настройки
    API_URL: window.location.origin,
    API_TIMEOUT: 30000,

    // Telegram Web App
    TELEGRAM: window.Telegram?.WebApp,

    // ID менеджеров
    MANAGER_IDS: [385436658, 1734337242],

    // Интервалы обновления (мс)
    UPDATE_INTERVALS: {
        TASKS: 30000,        // 30 секунд
        ATTENDANCE: 60000,   // 1 минута
        REPORTS: 300000      // 5 минут
    },

    // Настройки UI
    UI: {
        ANIMATION_DURATION: 300,
        NOTIFICATION_DURATION: 3000,
        DEBOUNCE_DELAY: 300
    },

    // Feature flags
    FEATURES: {
        ENABLE_GEOLOCATION: true,
        ENABLE_NOTIFICATIONS: true,
        ENABLE_HAPTIC: true,
        ENABLE_DEBUG: process.env.NODE_ENV === 'development'
    },

    // Проверка тестового режима
    isTestMode() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.has('test') || !this.TELEGRAM?.initData;
    },

    // Получение URL для API запроса
    getApiUrl(endpoint) {
        if (this.isTestMode()) {
            const separator = endpoint.includes('?') ? '&' : '?';
            return `${this.API_URL}${endpoint}${separator}test=1`;
        }
        return `${this.API_URL}${endpoint}`;
    }
};