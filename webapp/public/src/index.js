// Главная точка входа приложения
import './styles/main.css';
import { App } from './app';
import { TelegramWebApp } from './utils/telegram';

// Инициализация приложения при загрузке DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

async function initApp() {
    try {
        console.log('🚀 Инициализация KAIF Staff App...');

        // Инициализация Telegram Web App
        TelegramWebApp.init();

        // Создание и запуск приложения
        const app = new App();
        await app.initialize();

        // Делаем app доступным глобально для отладки
        if (process.env.NODE_ENV === 'development') {
            window.KaifApp = app;
        }

        console.log('✅ Приложение успешно запущено');
    } catch (error) {
        console.error('❌ Ошибка инициализации приложения:', error);

        // Показываем пользователю сообщение об ошибке
        const errorContainer = document.getElementById('app-error');
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div class="error-message">
                    <h3>Ошибка загрузки приложения</h3>
                    <p>${error.message || 'Произошла неизвестная ошибка'}</p>
                    <button onclick="location.reload()">Перезагрузить</button>
                </div>
            `;
            errorContainer.style.display = 'block';
        }
    }
}