// Контроллер для управления задачами
export class TasksController {
    constructor(api, view, eventBus) {
        this.api = api;
        this.view = view;
        this.eventBus = eventBus;
        this.currentUser = null;
        this.tasks = [];

        // Связываем обработчики
        this.view.onSubmit = this.handleCreateTask.bind(this);
    }

    setUser(user) {
        this.currentUser = user;
    }

    async loadTasks(filters = {}) {
        try {
            this.tasks = await this.api.getTasks(filters);
            return this.tasks;
        } catch (error) {
            console.error('Ошибка загрузки задач:', error);
            throw error;
        }
    }

    async getTasksStats() {
        try {
            const stats = await this.api.getTasksStats();
            return stats;
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
            return { active: 0, completed: 0, total: 0 };
        }
    }

    async createTask(taskData) {
        try {
            const task = await this.api.createTask(taskData);
            this.tasks.push(task);
            return task;
        } catch (error) {
            console.error('Ошибка создания задачи:', error);
            throw error;
        }
    }

    async updateTaskStatus(taskId, status) {
        try {
            await this.api.updateTaskStatus(taskId, status);

            // Обновляем локальный список
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                task.status = status;
            }
        } catch (error) {
            console.error('Ошибка обновления статуса:', error);
            throw error;
        }
    }

    async handleCreateTask(taskData) {
        try {
            const task = await this.createTask(taskData);
            this.eventBus.emit('task:created', task);
            return task;
        } catch (error) {
            this.eventBus.emit('task:error', error);
            throw error;
        }
    }

    async deleteTask(taskId) {
        try {
            await this.api.deleteTask(taskId);
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.eventBus.emit('task:deleted', taskId);
        } catch (error) {
            console.error('Ошибка удаления задачи:', error);
            throw error;
        }
    }

    getTaskById(taskId) {
        return this.tasks.find(t => t.id === taskId);
    }

    getTasksByStatus(status) {
        return this.tasks.filter(t => t.status === status);
    }

    getTasksByAssignee(assigneeId) {
        return this.tasks.filter(t => t.assigneeId === assigneeId);
    }
}