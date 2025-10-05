/**
 * Изолированный модуль задач
 * Полностью независимый от остального кода
 */

(function() {
    'use strict';

    // Namespace для модуля задач
    window.TasksModule = {
        initialized: false,
        currentTasks: [],
        currentFilter: 'all',
        currentTaskType: 'my',
        selectedTask: null
    };

    const TM = window.TasksModule;
    const API_URL = window.location.origin;

    // Утилиты
    const Utils = {
        formatDate(dateStr) {
            if (!dateStr) return 'Не указан';
            const date = new Date(dateStr);
            const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                          'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
            return `${date.getDate()} ${months[date.getMonth()]}`;
        },

        getPriorityStyle(priority) {
            const styles = {
                'Высокий': 'background: #ef4444; color: white;',
                'Средний': 'background: #f59e0b; color: white;',
                'Низкий': 'background: #22c55e; color: white;'
            };
            return styles[priority] || styles['Средний'];
        },

        getStatusClass(status) {
            const classes = {
                'Новая': 'status-new',
                'В работе': 'status-in-progress',
                'Выполнена': 'status-completed'
            };
            return classes[status] || 'status-new';
        }
    };

    // API методы
    const API = {
        async getTasks() {
            try {
                const tg = window.Telegram?.WebApp;
                const response = await fetch(`${API_URL}/api/tasks/my`, {
                    headers: {
                        'X-Telegram-Init-Data': tg?.initData || ''
                    }
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                console.error('Error loading tasks:', error);
                return [];
            }
        },

        async updateTaskStatus(taskId, status) {
            try {
                const tg = window.Telegram?.WebApp;
                const response = await fetch(`${API_URL}/api/tasks/${taskId}/status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Telegram-Init-Data': tg?.initData || ''
                    },
                    body: JSON.stringify({ status })
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                console.error('Error updating task status:', error);
                throw error;
            }
        },

        async createTask(taskData) {
            try {
                const tg = window.Telegram?.WebApp;
                const response = await fetch(`${API_URL}/api/tasks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Telegram-Init-Data': tg?.initData || ''
                    },
                    body: JSON.stringify(taskData)
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                console.error('Error creating task:', error);
                throw error;
            }
        }
    };

    // Рендеринг интерфейса
    const Render = {
        tasksList(tasks) {
            const container = document.getElementById('tasksList');
            if (!container) return;

            // Оптимизация для плавного скролла
            container.style.transform = 'translateZ(0)';
            container.style.webkitTransform = 'translateZ(0)';
            container.style.willChange = 'scroll-position';
            container.style.webkitOverflowScrolling = 'touch';

            if (!tasks || tasks.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #999;">
                        <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
                        <p>У вас нет задач</p>
                    </div>
                `;
                return;
            }

            // Фильтрация задач
            let filteredTasks = tasks;
            if (TM.currentFilter !== 'all') {
                const filterMap = {
                    'new': 'Новая',
                    'in-progress': 'В работе',
                    'completed': 'Выполнена'
                };
                filteredTasks = tasks.filter(t => t.status === filterMap[TM.currentFilter]);
            }

            // Рендерим задачи
            container.innerHTML = filteredTasks.map(task => `
                <div class="task-item-modern"
                     data-task-id="${task.id}"
                     style="background: var(--bg-card);
                            border-radius: 16px;
                            padding: 20px;
                            margin-bottom: 12px;
                            cursor: pointer;
                            transition: all 0.3s ease;">

                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: var(--text-primary);">
                            ${task.title}
                        </h3>
                        <span class="${Utils.getStatusClass(task.status)}"
                              style="padding: 4px 12px; border-radius: 20px; font-size: 12px; ${Utils.getPriorityStyle(task.priority)}">
                            ${task.status}
                        </span>
                    </div>

                    ${task.description ? `
                        <p style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 14px;">
                            ${task.description}
                        </p>
                    ` : ''}

                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; gap: 16px; color: var(--text-secondary); font-size: 13px;">
                            <span>📅 ${Utils.formatDate(task.deadline)}</span>
                            <span style="padding: 2px 8px; border-radius: 12px; ${Utils.getPriorityStyle(task.priority)}">
                                ${task.priority}
                            </span>
                        </div>

                        <div style="display: flex; gap: 8px;">
                            ${task.status === 'Новая' ? `
                                <button onclick="TasksModule.updateStatus('${task.id}', 'В работе', event)"
                                        class="task-action-btn"
                                        style="background: #3b82f6; color: white; border: none; padding: 6px 12px;
                                               border-radius: 8px; font-size: 13px; cursor: pointer;">
                                    ▶️ Начать
                                </button>
                            ` : ''}

                            ${task.status === 'В работе' ? `
                                <button onclick="TasksModule.updateStatus('${task.id}', 'Выполнена', event)"
                                        class="task-action-btn"
                                        style="background: #22c55e; color: white; border: none; padding: 6px 12px;
                                               border-radius: 8px; font-size: 13px; cursor: pointer;">
                                    ✅ Завершить
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('');

            // Добавляем обработчики кликов
            container.querySelectorAll('.task-item-modern').forEach(item => {
                item.addEventListener('click', function(e) {
                    // Не открываем детали если кликнули на кнопку
                    if (e.target.classList.contains('task-action-btn')) return;

                    const taskId = this.getAttribute('data-task-id');
                    TasksModule.showTaskDetails(taskId);
                });
            });
        },

        taskDetailModal(task) {
            // Удаляем старое модальное окно если есть
            const oldModal = document.getElementById('tm-task-detail-modal');
            if (oldModal) oldModal.remove();

            const modal = document.createElement('div');
            modal.id = 'tm-task-detail-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.2s ease;
            `;

            modal.innerHTML = `
                <div style="background: var(--bg-card);
                            border-radius: 20px;
                            padding: 24px;
                            width: 90%;
                            max-width: 450px;
                            max-height: 80vh;
                            overflow-y: auto;
                            animation: slideUp 0.3s ease;">

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2 style="margin: 0; font-size: 24px;">Детали задачи</h2>
                        <button onclick="TasksModule.closeTaskDetails()"
                                style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary);">
                            ✕
                        </button>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <h3 style="margin: 0 0 8px 0; font-size: 20px; color: var(--text-primary);">
                            ${task.title}
                        </h3>
                        <span style="padding: 6px 12px; border-radius: 20px; font-size: 13px; ${Utils.getPriorityStyle(task.priority)}">
                            ${task.status}
                        </span>
                    </div>

                    ${task.description ? `
                        <div style="margin-bottom: 20px;">
                            <h4 style="margin: 0 0 8px 0; color: var(--text-secondary); font-size: 14px;">Описание</h4>
                            <p style="margin: 0; color: var(--text-primary);">${task.description}</p>
                        </div>
                    ` : ''}

                    <div style="margin-bottom: 20px;">
                        <h4 style="margin: 0 0 8px 0; color: var(--text-secondary); font-size: 14px;">Информация</h4>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <div>📅 Дедлайн: ${Utils.formatDate(task.deadline)}</div>
                            <div>🎯 Приоритет: ${task.priority}</div>
                            <div>👤 Исполнитель: ${task.assigneeName || 'Не назначен'}</div>
                            <div>📝 Создана: ${Utils.formatDate(task.createdAt)}</div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 12px;">
                        ${task.status === 'Новая' ? `
                            <button onclick="TasksModule.updateStatusFromModal('${task.id}', 'В работе')"
                                    style="flex: 1; background: #3b82f6; color: white; border: none;
                                           padding: 12px; border-radius: 12px; font-size: 16px; cursor: pointer;">
                                ▶️ Начать работу
                            </button>
                        ` : ''}

                        ${task.status === 'В работе' ? `
                            <button onclick="TasksModule.updateStatusFromModal('${task.id}', 'Выполнена')"
                                    style="flex: 1; background: #22c55e; color: white; border: none;
                                           padding: 12px; border-radius: 12px; font-size: 16px; cursor: pointer;">
                                ✅ Завершить задачу
                            </button>
                        ` : ''}

                        <button onclick="TasksModule.closeTaskDetails()"
                                style="flex: 1; background: var(--bg-secondary); color: var(--text-primary);
                                       border: none; padding: 12px; border-radius: 12px; font-size: 16px; cursor: pointer;">
                            Закрыть
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Добавляем стили анимации если их нет
            if (!document.getElementById('tm-animations')) {
                const style = document.createElement('style');
                style.id = 'tm-animations';
                style.textContent = `
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes slideUp {
                        from { transform: translateY(20px); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                `;
                document.head.appendChild(style);
            }
        }
    };

    // Публичные методы модуля
    TasksModule.init = async function() {
        if (TM.initialized) return;
        TM.initialized = true;

        console.log('📋 Инициализация модуля задач...');

        // Полностью заменяем содержимое страницы задач
        const tasksPage = document.getElementById('tasks');
        if (tasksPage) {
            tasksPage.innerHTML = `
                <div class="page-header">
                    <button class="back-btn" onclick="showPage('home')">
                        <i data-lucide="arrow-left"></i> <span>Назад</span>
                    </button>
                    <div class="page-title-section">
                        <h1 class="page-title">
                            <i data-lucide="check-square" class="title-icon"></i> Мои задачи
                        </h1>
                        <button id="createTaskBtn" class="create-task-btn" onclick="window.TasksModule.showCreateTaskModal()" style="display: ${window.currentUser?.isManager ? 'flex' : 'none'};">
                            <i data-lucide="plus"></i> <span>Создать</span>
                        </button>
                    </div>
                </div>

                <div class="task-type-switcher">
                    <button id="myTasksBtn" class="task-type-btn active" onclick="window.TasksModule.switchTaskType('my')">
                        <i data-lucide="inbox" class="btn-icon"></i> <span>Мои задачи</span>
                    </button>
                    <button id="createdTasksBtn" class="task-type-btn" onclick="window.TasksModule.switchTaskType('created')" style="display: ${window.currentUser?.isManager ? 'block' : 'none'};">
                        <i data-lucide="send" class="btn-icon"></i> <span>Поставленные</span>
                    </button>
                </div>

                <div class="task-filters">
                    <button class="filter-btn active" onclick="window.TasksModule.filterTasks('all')">
                        <span class="filter-text">Все</span>
                        <span class="count">0</span>
                    </button>
                    <button class="filter-btn" onclick="window.TasksModule.filterTasks('new')">
                        <div class="filter-indicator new"></div>
                        <span class="filter-text">Новые</span>
                        <span class="count">0</span>
                    </button>
                    <button class="filter-btn" onclick="window.TasksModule.filterTasks('in-progress')">
                        <div class="filter-indicator in-progress"></div>
                        <span class="filter-text">В работе</span>
                        <span class="count">0</span>
                    </button>
                    <button class="filter-btn" onclick="window.TasksModule.filterTasks('completed')">
                        <div class="filter-indicator completed"></div>
                        <span class="filter-text">Выполнены</span>
                        <span class="count">0</span>
                    </button>
                </div>

                <div id="tasksList" class="tasks-container">
                    <div class="loading">
                        <div class="loading-spinner"></div>
                        <p class="loading-text">Загрузка задач...</p>
                    </div>
                </div>
            `;

            // Инициализируем иконки Lucide
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }

        await this.loadTasks();
    };

    TasksModule.loadTasks = async function() {
        // Если модуль еще не инициализирован, инициализируем
        if (!TM.initialized) {
            await this.init();
            return;
        }

        const tasks = await API.getTasks();
        TM.currentTasks = tasks;
        Render.tasksList(tasks);
        this.updateTaskCounts(tasks);
        console.log(`✅ Загружено ${tasks.length} задач`);
    };

    TasksModule.updateTaskCounts = function(tasks) {
        const counts = {
            all: tasks.length,
            new: tasks.filter(t => t.status === 'Новая').length,
            'in-progress': tasks.filter(t => t.status === 'В работе').length,
            completed: tasks.filter(t => t.status === 'Выполнена').length
        };

        // Обновляем счетчики на кнопках фильтров
        document.querySelectorAll('.filter-btn').forEach(btn => {
            const onclick = btn.getAttribute('onclick');
            if (onclick) {
                const match = onclick.match(/filterTasks\('(.+?)'/);
                if (match) {
                    const filter = match[1];
                    const countSpan = btn.querySelector('.count');
                    if (countSpan) {
                        countSpan.textContent = counts[filter] || 0;
                    }
                }
            }
        });

        // Обновляем бейдж в навигации
        const badge = document.getElementById('tasksBadge');
        if (badge) {
            const activeCount = counts['new'] + counts['in-progress'];
            if (activeCount > 0) {
                badge.textContent = activeCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    };

    TasksModule.renderTasks = function(tasks) {
        if (tasks) {
            TM.currentTasks = tasks;
        }
        Render.tasksList(TM.currentTasks);
        this.updateTaskCounts(TM.currentTasks);
    };

    TasksModule.filterTasks = function(filter) {
        TM.currentFilter = filter;
        Render.tasksList(TM.currentTasks);

        // Обновляем активную кнопку
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.closest('.filter-btn').classList.add('active');
    };

    TasksModule.showTaskDetails = function(taskId) {
        const task = TM.currentTasks.find(t => String(t.id) === String(taskId));
        if (task) {
            TM.selectedTask = task;
            Render.taskDetailModal(task);
        } else {
            console.error('Задача не найдена:', taskId);
        }
    };

    TasksModule.closeTaskDetails = function() {
        const modal = document.getElementById('tm-task-detail-modal');
        if (modal) {
            modal.style.animation = 'fadeOut 0.2s ease';
            setTimeout(() => modal.remove(), 200);
        }
        TM.selectedTask = null;
    };

    TasksModule.updateStatus = async function(taskId, newStatus, event) {
        if (event) {
            event.stopPropagation();
        }

        try {
            await API.updateTaskStatus(taskId, newStatus);

            // Обновляем локальный кэш
            const task = TM.currentTasks.find(t => String(t.id) === String(taskId));
            if (task) {
                task.status = newStatus;
            }

            // Перерисовываем список
            await this.loadTasks();

            // Уведомление
            const tg = window.Telegram?.WebApp;
            if (tg?.HapticFeedback) {
                tg.HapticFeedback.impactOccurred('light');
            }

            console.log(`✅ Статус задачи ${taskId} обновлен на ${newStatus}`);
        } catch (error) {
            alert('Ошибка при обновлении статуса задачи');
        }
    };

    TasksModule.updateStatusFromModal = async function(taskId, newStatus) {
        await this.updateStatus(taskId, newStatus);
        this.closeTaskDetails();
    };

    // Функция создания задачи
    TasksModule.showCreateTaskModal = function(employeeId = null) {
        const oldModal = document.getElementById('tm-create-task-modal');
        if (oldModal) oldModal.remove();

        const modal = document.createElement('div');
        modal.id = 'tm-create-task-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: var(--bg-card);
                        border-radius: 20px;
                        padding: 24px;
                        width: 90%;
                        max-width: 450px;
                        max-height: 80vh;
                        overflow-y: auto;">

                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;">Новая задача</h2>
                    <button onclick="TasksModule.closeCreateTaskModal()"
                            style="background: none; border: none; font-size: 24px; cursor: pointer;">
                        ✕
                    </button>
                </div>

                <form id="tm-create-task-form" onsubmit="TasksModule.submitNewTask(event)">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; font-size: 14px;">Название задачи *</label>
                        <input type="text" name="title" required
                               style="width: 100%; padding: 12px; border: 1px solid var(--border-color);
                                      border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary);">
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; font-size: 14px;">Описание</label>
                        <textarea name="description" rows="3"
                                  style="width: 100%; padding: 12px; border: 1px solid var(--border-color);
                                         border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary);"></textarea>
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; font-size: 14px;">Дедлайн *</label>
                        <input type="date" name="deadline" required
                               style="width: 100%; padding: 12px; border: 1px solid var(--border-color);
                                      border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary);">
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; font-size: 14px;">Приоритет</label>
                        <select name="priority"
                                style="width: 100%; padding: 12px; border: 1px solid var(--border-color);
                                       border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary);">
                            <option value="Низкий">🟢 Низкий</option>
                            <option value="Средний" selected>🟡 Средний</option>
                            <option value="Высокий">🔴 Высокий</option>
                        </select>
                    </div>

                    <div style="display: flex; gap: 12px;">
                        <button type="submit"
                                style="flex: 1; background: #3b82f6; color: white; border: none;
                                       padding: 12px; border-radius: 12px; font-size: 16px; cursor: pointer;">
                            Создать задачу
                        </button>
                        <button type="button" onclick="TasksModule.closeCreateTaskModal()"
                                style="flex: 1; background: var(--bg-secondary); color: var(--text-primary);
                                       border: none; padding: 12px; border-radius: 12px; font-size: 16px; cursor: pointer;">
                            Отмена
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
    };

    TasksModule.closeCreateTaskModal = function() {
        const modal = document.getElementById('tm-create-task-modal');
        if (modal) modal.remove();
    };

    TasksModule.submitNewTask = async function(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);

        const taskData = {
            title: formData.get('title'),
            description: formData.get('description'),
            deadline: formData.get('deadline'),
            priority: formData.get('priority'),
            assigneeId: window.Telegram?.WebApp?.initDataUnsafe?.user?.id
        };

        try {
            await API.createTask(taskData);
            this.closeCreateTaskModal();
            await this.loadTasks();

            const tg = window.Telegram?.WebApp;
            if (tg?.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('success');
            }

            alert('Задача успешно создана!');
        } catch (error) {
            alert('Ошибка при создании задачи');
        }
    };

    // Регистрируем глобальные функции для обратной совместимости
    window.filterTasks = function(filter, event) {
        TasksModule.currentFilter = filter;
        TasksModule.filterTasks(filter);
    };

    window.showTaskDetails = function(taskId) {
        TasksModule.showTaskDetails(taskId);
    };

    window.handleTaskClick = function(taskId) {
        TasksModule.showTaskDetails(taskId);
    };

    window.showCreateTaskModal = function(employeeId) {
        TasksModule.showCreateTaskModal(employeeId);
    };

    window.closeTaskModal = function() {
        TasksModule.closeCreateTaskModal();
    };

    // Автоматическая инициализация при переходе на страницу задач
    const originalShowPage = window.showPage;
    window.showPage = function(page) {
        if (originalShowPage) {
            originalShowPage(page);
        }

        if (page === 'tasks') {
            setTimeout(() => TasksModule.init(), 100);
        }
    };

    console.log('✅ Модуль задач загружен и готов к работе');

})();