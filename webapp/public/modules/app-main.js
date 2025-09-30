// Главный модуль приложения
import { Config } from './config.js';
import { Tasks } from './tasks.js';
import { UI } from './ui.js';
import { Reports } from './reports.js';
import { Employees } from './employees.js';
import { Attendance } from './attendance.js';

// Создаем глобальный namespace
window.KaifApp = {
    Config,
    Tasks,
    UI,
    Reports,
    Employees,
    Attendance,

    // Глобальные переменные
    currentUser: null,
    tg: window.Telegram.WebApp,

    // Инициализация приложения
    async init() {
        console.log('=== Инициализация KaifApp ===');

        // Настройка Telegram WebApp
        this.tg.ready();
        this.tg.expand();

        // Принудительно темная тема
        document.documentElement.style.setProperty('--tg-theme-bg-color', '#0F0F14');
        document.documentElement.style.setProperty('--tg-theme-text-color', '#FFFFFF');

        // Загрузка профиля пользователя
        await this.loadProfile();

        // Инициализация UI
        UI.initializeModernUI();

        // Настройка навигации
        this.setupNavigation();

        // Загрузка начальных данных
        await this.loadInitialData();

        // Настройка обработчиков форм
        this.setupFormHandlers();

        console.log('✅ KaifApp инициализирован');
    },

    // Загрузка профиля
    async loadProfile() {
        try {
            const response = await fetch(Config.getApiUrl('/api/profile'), {
                headers: {
                    'X-Telegram-Init-Data': this.tg.initData || ''
                }
            });

            if (response.ok) {
                this.currentUser = await response.json();
                console.log('Профиль загружен:', this.currentUser);

                // Обновление UI с данными пользователя
                if (this.currentUser) {
                    const nameElement = document.getElementById('userName');
                    if (nameElement) {
                        nameElement.textContent = this.currentUser.name;
                    }

                    // Показать/скрыть элементы для менеджеров
                    const isManager = this.currentUser.telegramId &&
                                     [385436658, 1734337242].includes(this.currentUser.telegramId);

                    document.querySelectorAll('.manager-only').forEach(el => {
                        el.style.display = isManager ? '' : 'none';
                    });
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки профиля:', error);
        }
    },

    // Загрузка начальных данных
    async loadInitialData() {
        // Проверка статуса отчета
        await Reports.checkReportStatus();

        // Загрузка количества задач
        await this.loadTasksCount();

        // Если на странице задач - загрузить их
        if (document.getElementById('tasks').classList.contains('active')) {
            await Tasks.loadTasks();
        }
    },

    // Загрузка количества задач
    async loadTasksCount() {
        try {
            const response = await fetch(Config.getApiUrl('/api/tasks/stats'), {
                headers: {
                    'X-Telegram-Init-Data': this.tg.initData || ''
                }
            });

            if (response.ok) {
                const stats = await response.json();

                // Обновление счетчиков
                const newTasksElement = document.getElementById('newTasksCount');
                const inProgressElement = document.getElementById('inProgressCount');

                if (newTasksElement && stats.new !== undefined) {
                    UI.animateNumber(newTasksElement, stats.new, { addPulse: true });
                }

                if (inProgressElement && stats.inProgress !== undefined) {
                    UI.animateNumber(inProgressElement, stats.inProgress);
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки статистики задач:', error);
        }
    },

    // Настройка навигации
    setupNavigation() {
        // Глобальная функция showPage
        window.showPage = (pageId) => {
            UI.showPage(pageId);

            // Загрузка данных для страницы
            switch(pageId) {
                case 'tasks':
                    Tasks.loadTasks();
                    break;
                case 'attendance':
                    Attendance.updateStatus();
                    break;
                case 'employees':
                    Employees.loadEmployees();
                    break;
                case 'adminPanel':
                    this.loadAdminPanel();
                    break;
            }
        };

        // Другие глобальные функции
        window.showTasks = () => {
            window.showPage('tasks');
        };

        window.showEmployees = () => {
            window.showPage('employees');
        };

        window.showReportForm = () => {
            window.showPage('report');
        };
    },

    // Настройка обработчиков форм
    setupFormHandlers() {
        // Форма отчета
        const reportForm = document.getElementById('reportForm');
        if (reportForm) {
            reportForm.addEventListener('submit', (e) => Reports.submitReport(e));
        }

        // Форма задачи
        const taskForm = document.getElementById('taskForm');
        if (taskForm) {
            taskForm.addEventListener('submit', (e) => Tasks.submitTask(e));
        }

        // Глобальные функции для модальных окон
        window.showCreateTaskModal = (employeeId, employeeName) => {
            Tasks.showCreateTaskModal(employeeId, employeeName);
        };

        window.closeTaskModal = () => {
            Tasks.closeTaskModal();
        };

        window.submitTask = (event) => {
            Tasks.submitTask(event);
        };
    },

    // Загрузка админ панели
    async loadAdminPanel() {
        // TODO: Реализовать загрузку админ панели
        console.log('Загрузка админ панели...');
    }
};

// Единственный обработчик DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    KaifApp.init();
});