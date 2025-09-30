// Главный класс приложения
import { Config } from './config';
import { Router } from './modules/router';
import { AuthModule } from './modules/auth';
import { TasksModule } from './modules/tasks';
import { ReportsModule } from './modules/reports';
import { EmployeesModule } from './modules/employees';
import { AttendanceModule } from './modules/attendance';
import { UIModule } from './modules/ui';
import { API } from './utils/api';
import { EventBus } from './utils/eventBus';

export class App {
    constructor() {
        this.config = Config;
        this.eventBus = new EventBus();
        this.api = new API(this.config.API_URL);
        this.ui = new UIModule(this.eventBus);
        this.router = new Router(this.eventBus);
        this.auth = new AuthModule(this.api, this.eventBus);

        // Модули приложения
        this.modules = {};
        this.modules.tasks = new TasksModule(this.api, this.eventBus, this.ui);
        this.modules.reports = new ReportsModule(this.api, this.eventBus, this.ui);
        this.modules.employees = new EmployeesModule(this.api, this.eventBus, this.ui, this.modules.tasks);
        this.modules.attendance = new AttendanceModule(this.api, this.eventBus, this.ui);

        // Состояние приложения
        this.state = {
            currentUser: null,
            isLoading: false,
            currentPage: 'home'
        };

        this.setupEventListeners();
    }

    async initialize() {
        try {
            // Показываем индикатор загрузки
            this.setLoading(true);

            // Инициализация UI
            await this.ui.initialize();

            // Аутентификация пользователя
            const user = await this.auth.initialize();
            this.state.currentUser = user;

            // Инициализация модулей
            await this.initializeModules();

            // Роутер уже инициализирован в конструкторе

            // Загрузка начальных данных
            await this.loadInitialData();

            // Скрываем индикатор загрузки
            this.setLoading(false);

            // Показываем главную страницу
            this.router.navigate('home');

            // Запуск периодических обновлений
            this.startPeriodicUpdates();

        } catch (error) {
            this.setLoading(false);
            throw error;
        }
    }

    async initializeModules() {
        const promises = Object.values(this.modules).map(module =>
            module.initialize(this.state.currentUser)
        );
        await Promise.all(promises);
    }

    async loadInitialData() {
        try {
            // Параллельная загрузка начальных данных
            await Promise.all([
                this.modules.reports.loadReports(),
                this.modules.tasks.loadTasksCount(),
                this.modules.attendance.checkCurrentSession()
            ]);
        } catch (error) {
            console.error('Ошибка загрузки начальных данных:', error);
        }
    }

    setupEventListeners() {
        // Навигация
        this.eventBus.on('navigate', (page) => {
            this.router.navigate(page);
            this.state.currentPage = page;
        });

        // Обновление пользователя
        this.eventBus.on('user:updated', (user) => {
            this.state.currentUser = user;
            this.updateUIForUser(user);
        });

        // Обработка ошибок
        this.eventBus.on('error', (error) => {
            this.handleError(error);
        });

        // Обновление данных
        this.eventBus.on('data:refresh', async (module) => {
            if (this.modules[module]) {
                await this.modules[module].refresh();
            }
        });
    }

    updateUIForUser(user) {
        // Обновление UI в зависимости от роли пользователя
        const isManager = user?.role === 'manager' ||
                         [385436658, 1734337242].includes(user?.telegramId);

        document.querySelectorAll('.manager-only').forEach(el => {
            el.style.display = isManager ? '' : 'none';
        });

        document.querySelectorAll('.employee-only').forEach(el => {
            el.style.display = !isManager ? '' : 'none';
        });
    }

    startPeriodicUpdates() {
        // Обновление задач каждые 30 секунд
        setInterval(() => {
            if (this.state.currentPage === 'tasks') {
                this.modules.tasks.refresh();
            }
        }, 30000);

        // Обновление статуса посещаемости каждую минуту
        setInterval(() => {
            this.modules.attendance.checkCurrentSession();
        }, 60000);
    }

    setLoading(isLoading) {
        this.state.isLoading = isLoading;
        // Показываем/скрываем глобальный индикатор загрузки
        if (isLoading) {
            this.ui.showLoading();
        } else {
            const loader = document.querySelector('.loader');
            if (loader) this.ui.hideLoading(loader);
        }
    }

    handleError(error) {
        console.error('Ошибка приложения:', error);
        this.ui.showNotification(error.message || 'Произошла ошибка', 'error');
    }

    // Публичные методы для обратной совместимости
    showPage(pageId) {
        this.router.navigate(pageId);
    }

    async refreshData() {
        await this.loadInitialData();
    }
}