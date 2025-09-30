// Конфигурация приложения
export const Config = {
    API_URL: window.location.origin,

    // Проверка тестового режима
    isTestMode: () => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.has('test') || window.location.search.includes('test=');
    },

    // Получение URL для API
    getApiUrl: (endpoint) => {
        const tg = window.Telegram.WebApp;
        if (!tg.initData || Config.isTestMode()) {
            const separator = endpoint.includes('?') ? '&' : '?';
            return `${Config.API_URL}${endpoint}${separator}test=1`;
        }
        return `${Config.API_URL}${endpoint}`;
    }
};