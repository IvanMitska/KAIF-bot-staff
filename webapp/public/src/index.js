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

        // Экспортируем глобальные функции для обратной совместимости с HTML
        window.KaifApp = app;

        // Глобальные функции для onclick обработчиков в HTML
        window.showPage = (pageId) => app.showPage(pageId);
        window.showCreateTaskModal = (employeeId, employeeName) => {
            console.log('Вызов showCreateTaskModal:', { employeeId, employeeName });
            app.modules.tasks.showCreateTaskModal(employeeId, employeeName);
        };
        window.closeTaskModal = () => app.modules.tasks.closeTaskModal();
        window.showEmployees = () => app.showPage('employees');
        window.showAdminPanel = () => app.showPage('adminPanel');
        window.showHelp = () => console.log('Help page not implemented yet');

        // Функции для задач
        window.submitTask = (event) => {
            event.preventDefault();
            const form = event.target;
            const formData = new FormData(form);
            const taskData = {
                title: formData.get('title'),
                description: formData.get('description'),
                employeeId: formData.get('employee'),
                priority: formData.get('priority'),
                deadline: formData.get('deadline')
            };
            app.modules.tasks.createTask(taskData);
        };

        // Функции для FAB меню
        window.toggleFab = () => {
            const fabMain = document.getElementById('fabMain');
            const fabMenu = document.getElementById('fabMenu');

            if (fabMenu?.classList.contains('active')) {
                fabMain?.classList.remove('active');
                fabMenu?.classList.remove('active');
            } else {
                fabMain?.classList.add('active');
                fabMenu?.classList.add('active');
            }
        };

        // Функции для учета времени
        window.checkIn = () => {
            console.log('Check in');
            // TODO: Implement check in
        };

        window.checkOut = () => {
            console.log('Check out');
            // TODO: Implement check out
        };

        // Функции для админ панели
        window.switchAdminTab = (tab) => {
            console.log('Switch admin tab:', tab);
            // TODO: Implement admin tab switching
        };

        window.updateAdminPanel = () => {
            console.log('Update admin panel');
            // TODO: Implement admin panel update
        };

        window.showMissingReports = () => {
            console.log('Show missing reports');
            // TODO: Implement show missing reports
        };

        window.forceLoadTasks = () => {
            app.modules.tasks.loadTasks();
        };

        window.switchTaskType = (type) => {
            console.log('Switching task type to:', type);
            // TODO: Implement task type switching
        };

        window.filterTasks = (filter, event) => {
            if (event) event.preventDefault();
            console.log('Filtering tasks by:', filter);
            // TODO: Implement task filtering
        };

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