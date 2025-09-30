// Модуль управления задачами
import { Config } from './config.js';
import { UI } from './ui.js';

export const Tasks = {
    // Состояние
    currentTasks: [],
    currentTaskType: 'my',
    isSubmittingTask: false,

    // Загрузка задач
    async loadTasks() {
        const tg = window.Telegram.WebApp;
        const container = document.getElementById('tasksList');

        if (!container) {
            console.error('Контейнер tasksList не найден');
            return;
        }

        container.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>Загрузка задач...</p>
            </div>
        `;

        try {
            const endpoint = this.currentTaskType === 'created' ?
                '/api/tasks/created' : '/api/tasks';

            const response = await fetch(Config.getApiUrl(endpoint), {
                headers: {
                    'X-Telegram-Init-Data': tg.initData || ''
                }
            });

            if (!response.ok) {
                throw new Error('Ошибка загрузки задач');
            }

            const tasks = await response.json();
            this.currentTasks = tasks;
            this.displayTasks(tasks);

        } catch (error) {
            console.error('Error loading tasks:', error);
            container.innerHTML = `
                <div class="error-message">
                    <p>Ошибка загрузки задач</p>
                    <button onclick="KaifApp.Tasks.loadTasks()">Повторить</button>
                </div>
            `;
        }
    },

    // Отображение задач
    displayTasks(tasks) {
        const container = document.getElementById('tasksList');

        if (!tasks || tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Нет задач для отображения</p>
                </div>
            `;
            return;
        }

        let html = '<div class="tasks-list">';

        tasks.forEach(task => {
            const statusClass = task.status === 'Новая' ? 'new' :
                              task.status === 'В работе' ? 'in-progress' : 'completed';

            html += `
                <div class="task-card ${statusClass}" onclick="KaifApp.Tasks.openTaskDetail(${task.id})">
                    <div class="task-header">
                        <h3>${task.title}</h3>
                        <span class="task-status">${task.status}</span>
                    </div>
                    <div class="task-meta">
                        <span class="task-deadline">До: ${new Date(task.deadline).toLocaleDateString('ru')}</span>
                        <span class="task-priority priority-${task.priority.toLowerCase()}">${task.priority}</span>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    // Открыть детали задачи
    openTaskDetail(taskId) {
        const task = this.currentTasks.find(t => t.id === taskId);
        if (!task) {
            console.error('Задача не найдена:', taskId);
            return;
        }

        // Показать детали задачи
        console.log('Открыть детали задачи:', task);
        // TODO: Реализовать показ деталей
    },

    // Показать модальное окно создания задачи
    showCreateTaskModal(employeeId = null, employeeName = null) {
        const modal = document.getElementById('taskModal');
        if (!modal) {
            console.error('Модальное окно taskModal не найдено');
            return;
        }

        // Сброс флага и очистка состояния
        this.isSubmittingTask = false;
        modal.className = 'modal-overlay show';
        modal.removeAttribute('style');

        // Открытие модального окна
        requestAnimationFrame(() => {
            modal.style.display = 'flex';
            modal.style.opacity = '1';
            modal.style.visibility = 'visible';
            document.body.style.overflow = 'hidden';
        });

        // Загрузить список сотрудников если нужно
        if (employeeId) {
            const select = document.getElementById('taskEmployee');
            if (select) {
                select.value = employeeId;
            }
        }
    },

    // Закрыть модальное окно
    closeTaskModal() {
        const modal = document.getElementById('taskModal');
        if (!modal) return;

        modal.className = 'modal-overlay hidden';
        modal.removeAttribute('style');
        document.body.style.overflow = '';

        const form = document.getElementById('taskForm');
        if (form) form.reset();
        this.isSubmittingTask = false;
    },

    // Отправить задачу
    async submitTask(event) {
        event.preventDefault();

        if (this.isSubmittingTask) {
            console.log('Задача уже отправляется');
            return;
        }

        this.isSubmittingTask = true;
        const tg = window.Telegram.WebApp;
        const formData = new FormData(event.target);

        const task = {
            title: formData.get('title'),
            description: formData.get('description') || '',
            deadline: formData.get('deadline'),
            priority: formData.get('priority'),
            assigneeId: parseInt(formData.get('employee'))
        };

        const submitBtn = event.target.querySelector('.submit-btn');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Создание...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(Config.getApiUrl('/api/tasks'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Init-Data': tg.initData || ''
                },
                body: JSON.stringify(task)
            });

            if (response.ok) {
                this.closeTaskModal();
                UI.showNotification('Задача успешно создана! ✅', 'success');
                await this.loadTasks();
            } else {
                throw new Error('Ошибка создания задачи');
            }
        } catch (error) {
            console.error('Error creating task:', error);
            UI.showNotification('Ошибка при создании задачи', 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            this.isSubmittingTask = false;
        }
    },

    // Обновить статус задачи
    async updateTaskStatus(taskId, newStatus) {
        const tg = window.Telegram.WebApp;

        try {
            const response = await fetch(Config.getApiUrl(`/api/tasks/${taskId}/status`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Init-Data': tg.initData || ''
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                UI.showNotification('Статус задачи обновлен', 'success');
                await this.loadTasks();
            } else {
                throw new Error('Ошибка обновления статуса');
            }
        } catch (error) {
            console.error('Error updating task status:', error);
            UI.showNotification('Ошибка обновления статуса', 'error');
        }
    }
};