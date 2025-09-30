// Модуль управления задачами
import { TasksAPI } from './api';
import { TasksView } from './view';
import { TasksController } from './controller';

export class TasksModule {
    constructor(api, eventBus, ui) {
        this.api = new TasksAPI(api);
        this.view = new TasksView(ui);
        this.controller = new TasksController(this.api, this.view, eventBus);

        this.eventBus = eventBus;
        this.setupEventListeners();
    }

    async initialize(currentUser) {
        this.currentUser = currentUser;
        this.controller.setUser(currentUser);

        // Инициализация представления
        this.view.initialize();

        // Загрузка начальных данных
        await this.loadTasksCount();
    }

    setupEventListeners() {
        // Обновление при изменении задач
        this.eventBus.on('tasks:updated', () => {
            this.refresh();
        });

        // Обработка навигации на страницу задач
        this.eventBus.on('page:tasks', () => {
            this.loadTasks();
        });
    }

    async loadTasks() {
        try {
            this.view.showLoading();
            const tasks = await this.controller.loadTasks();
            this.view.renderTasks(tasks);
        } catch (error) {
            this.view.showError('Ошибка загрузки задач');
            throw error;
        }
    }

    async loadTasksCount() {
        try {
            const stats = await this.controller.getTasksStats();
            this.view.updateTasksCount(stats);
        } catch (error) {
            console.error('Ошибка загрузки статистики задач:', error);
        }
    }

    async createTask(taskData) {
        try {
            this.view.setSubmitting(true);
            const task = await this.controller.createTask(taskData);
            this.view.closeModal();
            this.view.setSubmitting(false); // Сбрасываем состояние после успеха
            this.eventBus.emit('notification', 'Задача создана успешно', 'success');
            this.eventBus.emit('tasks:updated');
            await this.refresh(); // Обновляем список задач
            return task;
        } catch (error) {
            console.error('Error creating task:', error);
            this.view.setSubmitting(false); // Разблокируем кнопку при ошибке
            this.eventBus.emit('notification', error.message || 'Ошибка создания задачи', 'error');
            throw error;
        }
    }

    async updateTaskStatus(taskId, status) {
        try {
            await this.controller.updateTaskStatus(taskId, status);
            this.eventBus.emit('notification', 'Статус обновлен', 'success');
            this.eventBus.emit('tasks:updated');
        } catch (error) {
            this.eventBus.emit('notification', 'Ошибка обновления статуса', 'error');
            throw error;
        }
    }

    async refresh() {
        await Promise.all([
            this.loadTasksCount(),
            this.loadTasks()
        ]);
    }

    // Методы для обратной совместимости
    showCreateTaskModal(employeeId, employeeName) {
        this.view.showCreateModal(employeeId, employeeName);
    }

    closeTaskModal() {
        this.view.closeModal();
    }
}