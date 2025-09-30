// Представление для задач
export class TasksView {
    constructor(ui) {
        this.ui = ui;
        this.container = null;
        this.modal = null;
    }

    initialize() {
        this.container = document.getElementById('tasks');
        this.modal = document.getElementById('taskModal');
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Закрытие модального окна
        const closeBtn = this.modal?.querySelector('.close');
        if (closeBtn) {
            closeBtn.onclick = () => this.closeModal();
        }

        // Отправка формы
        const form = this.modal?.querySelector('#taskForm');
        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                this.handleSubmit();
            };
        }
    }

    renderTasks(tasks) {
        if (!this.container) return;

        const tasksList = this.container.querySelector('.tasks-list');
        if (!tasksList) return;

        tasksList.innerHTML = '';

        if (tasks.length === 0) {
            tasksList.innerHTML = `
                <div class="empty-state">
                    <p>Нет активных задач</p>
                </div>
            `;
            return;
        }

        tasks.forEach(task => {
            const taskCard = this.createTaskCard(task);
            tasksList.appendChild(taskCard);
        });
    }

    createTaskCard(task) {
        const card = document.createElement('div');
        card.className = 'task-card';
        card.dataset.taskId = task.id;

        card.innerHTML = `
            <div class="task-header">
                <h3>${task.title}</h3>
                <span class="task-priority priority-${task.priority || 'normal'}">
                    ${this.getPriorityLabel(task.priority)}
                </span>
            </div>
            <p class="task-description">${task.description || ''}</p>
            <div class="task-meta">
                <span class="task-assignee">
                    <i class="icon-user"></i> ${task.assigneeName || 'Не назначено'}
                </span>
                <span class="task-deadline">
                    <i class="icon-clock"></i> ${this.formatDate(task.deadline)}
                </span>
            </div>
            <div class="task-actions">
                <button class="btn-status" data-status="${task.status}">
                    ${this.getStatusLabel(task.status)}
                </button>
            </div>
        `;

        return card;
    }

    showCreateModal(employeeId, employeeName) {
        if (!this.modal) return;

        // Устанавливаем значения для сотрудника
        const employeeSelect = this.modal.querySelector('#taskAssignee');
        if (employeeSelect && employeeId) {
            employeeSelect.value = employeeId;
        }

        // Очищаем форму
        const form = this.modal.querySelector('#taskForm');
        if (form) {
            form.reset();
            if (employeeId) {
                employeeSelect.value = employeeId;
            }
        }

        // Показываем модальное окно
        this.modal.classList.remove('hidden');
        this.modal.style.display = 'flex';
    }

    closeModal() {
        if (!this.modal) return;

        this.modal.classList.add('hidden');
        this.modal.style.display = 'none';

        // Очищаем форму
        const form = this.modal.querySelector('#taskForm');
        if (form) form.reset();
    }

    showLoading() {
        if (!this.container) return;

        const tasksList = this.container.querySelector('.tasks-list');
        if (tasksList) {
            tasksList.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <p>Загрузка задач...</p>
                </div>
            `;
        }
    }

    showError(message) {
        if (!this.container) return;

        const tasksList = this.container.querySelector('.tasks-list');
        if (tasksList) {
            tasksList.innerHTML = `
                <div class="error-state">
                    <p>${message}</p>
                </div>
            `;
        }
    }

    setSubmitting(isSubmitting) {
        const submitBtn = this.modal?.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = isSubmitting;
            submitBtn.textContent = isSubmitting ? 'Создание...' : 'Создать';
        }
    }

    updateTasksCount(stats) {
        const countElement = document.querySelector('.tasks-count');
        if (countElement && stats.active !== undefined) {
            countElement.textContent = stats.active;
        }
    }

    handleSubmit() {
        const form = this.modal?.querySelector('#taskForm');
        if (!form) return;

        const formData = new FormData(form);
        const taskData = {
            title: formData.get('title'),
            description: formData.get('description'),
            assigneeId: formData.get('assignee'),
            priority: formData.get('priority'),
            deadline: formData.get('deadline')
        };

        // Генерируем событие отправки
        if (this.onSubmit) {
            this.onSubmit(taskData);
        }
    }

    getPriorityLabel(priority) {
        const labels = {
            high: 'Высокий',
            normal: 'Обычный',
            low: 'Низкий'
        };
        return labels[priority] || labels.normal;
    }

    getStatusLabel(status) {
        const labels = {
            pending: 'В ожидании',
            in_progress: 'В работе',
            completed: 'Завершено',
            cancelled: 'Отменено'
        };
        return labels[status] || status;
    }

    formatDate(dateString) {
        if (!dateString) return 'Без срока';

        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }
}