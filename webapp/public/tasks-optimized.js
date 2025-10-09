/**
 * Оптимизированный модуль задач
 * Исправляет проблемы с мерцанием и дерганием страницы
 */

(function() {
    'use strict';

    // Namespace для модуля задач
    window.TasksOptimized = {
        initialized: false,
        currentTasks: [],
        tasksCache: new Map(),
        currentFilter: 'all',
        currentTaskType: 'my',
        selectedTask: null,
        isLoading: false,
        lastLoadTime: 0,
        CACHE_TIME: 30000 // 30 секунд кэша
    };

    const TO = window.TasksOptimized;
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
                'Высокий': 'background: linear-gradient(135deg, #ef4444, #dc2626); color: white;',
                'Средний': 'background: linear-gradient(135deg, #f59e0b, #d97706); color: white;',
                'Низкий': 'background: linear-gradient(135deg, #22c55e, #16a34a); color: white;'
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
        },

        // Оптимизированное обновление DOM без полной перерисовки
        updateElement(selector, content, attributes = {}) {
            const element = document.querySelector(selector);
            if (element) {
                if (content !== undefined) {
                    if (element.innerHTML !== content) {
                        element.innerHTML = content;
                    }
                }
                Object.keys(attributes).forEach(key => {
                    if (element.getAttribute(key) !== attributes[key]) {
                        element.setAttribute(key, attributes[key]);
                    }
                });
            }
            return element;
        },

        // Предотвращение множественных кликов
        debounce(func, wait) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        }
    };

    // API методы с кэшированием
    const API = {
        async getTasks(forceRefresh = false) {
            const now = Date.now();

            // Используем кэш если он свежий и не требуется обновление
            if (!forceRefresh &&
                TO.tasksCache.has(TO.currentTaskType) &&
                (now - TO.lastLoadTime) < TO.CACHE_TIME) {
                return TO.tasksCache.get(TO.currentTaskType);
            }

            try {
                const tg = window.Telegram?.WebApp;
                const endpoint = TO.currentTaskType === 'created' ?
                    '/api/tasks/created' : '/api/tasks/my';

                const response = await fetch(`${API_URL}${endpoint}`, {
                    headers: {
                        'X-Telegram-Init-Data': tg?.initData || ''
                    }
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const tasks = await response.json();

                // Сохраняем в кэш
                TO.tasksCache.set(TO.currentTaskType, tasks);
                TO.lastLoadTime = now;

                return tasks;
            } catch (error) {
                console.error('Error loading tasks:', error);
                // Возвращаем кэш если есть, даже если устарел
                return TO.tasksCache.get(TO.currentTaskType) || [];
            }
        },

        async updateTaskStatus(taskId, status) {
            try {
                const tg = window.Telegram?.WebApp;
                const response = await fetch(`${API_URL}/api/tasks/${taskId}/status`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Telegram-Init-Data': tg?.initData || ''
                    },
                    body: JSON.stringify({ status })
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                // Обновляем кэш локально
                TO.currentTasks = TO.currentTasks.map(task =>
                    task.id === parseInt(taskId) ? {...task, status} : task
                );
                TO.tasksCache.set(TO.currentTaskType, TO.currentTasks);

                return await response.json();
            } catch (error) {
                console.error('Error updating task status:', error);
                throw error;
            }
        }
    };

    // Оптимизированный рендеринг интерфейса
    const Render = {
        // Виртуальный DOM для минимизации перерисовок
        tasksList(tasks, forceRender = false) {
            const container = document.getElementById('tasksList');
            if (!container) return;

            // Проверяем, изменились ли задачи
            const tasksHash = JSON.stringify(tasks.map(t => t.id + t.status));
            if (!forceRender && container.dataset.tasksHash === tasksHash) {
                return; // Ничего не изменилось, не перерисовываем
            }
            container.dataset.tasksHash = tasksHash;

            // Оптимизация для плавного скролла
            container.style.cssText = `
                transform: translateZ(0);
                -webkit-transform: translateZ(0);
                will-change: scroll-position;
                -webkit-overflow-scrolling: touch;
                backface-visibility: hidden;
                -webkit-backface-visibility: hidden;
            `;

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
            if (TO.currentFilter !== 'all') {
                const filterMap = {
                    'new': 'Новая',
                    'in-progress': 'В работе',
                    'completed': 'Выполнена'
                };
                filteredTasks = tasks.filter(t => t.status === filterMap[TO.currentFilter]);
            }

            // Используем DocumentFragment для оптимизации
            const fragment = document.createDocumentFragment();
            const tempDiv = document.createElement('div');

            tempDiv.innerHTML = filteredTasks.map(task => this.renderTaskItem(task)).join('');

            while (tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild);
            }

            // Одна операция DOM вместо множественных
            container.innerHTML = '';
            container.appendChild(fragment);

            // Добавляем обработчики событий через делегирование
            this.attachEventListeners();
        },

        renderTaskItem(task) {
            return `
                <div class="task-item-optimized"
                     data-task-id="${task.id}"
                     style="background: var(--bg-card);
                            border-radius: 16px;
                            padding: 20px;
                            margin-bottom: 12px;
                            cursor: pointer;
                            transition: transform 0.2s ease, box-shadow 0.2s ease;
                            transform: translateZ(0);
                            will-change: transform;">

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
                            ${this.renderTaskActions(task)}
                        </div>
                    </div>
                </div>
            `;
        },

        renderTaskActions(task) {
            if (task.status === 'Новая') {
                return `
                    <button data-action="start" data-task-id="${task.id}"
                            class="task-action-btn"
                            style="background: linear-gradient(135deg, #3b82f6, #2563eb);
                                   color: white; border: none; padding: 6px 12px;
                                   border-radius: 8px; font-size: 13px; cursor: pointer;">
                        ▶️ Начать
                    </button>
                `;
            }

            if (task.status === 'В работе') {
                return `
                    <button data-action="complete" data-task-id="${task.id}"
                            class="task-action-btn"
                            style="background: linear-gradient(135deg, #22c55e, #16a34a);
                                   color: white; border: none; padding: 6px 12px;
                                   border-radius: 8px; font-size: 13px; cursor: pointer;">
                        ✅ Завершить
                    </button>
                `;
            }

            return '';
        },

        attachEventListeners() {
            const container = document.getElementById('tasksList');
            if (!container) return;

            // Удаляем старые обработчики
            container.removeEventListener('click', this.handleTaskClick);

            // Добавляем новый обработчик с делегированием
            container.addEventListener('click', this.handleTaskClick);
        },

        handleTaskClick(event) {
            event.stopPropagation();

            const actionBtn = event.target.closest('.task-action-btn');
            if (actionBtn) {
                const action = actionBtn.dataset.action;
                const taskId = actionBtn.dataset.taskId;

                if (action === 'start') {
                    TO.updateStatus(taskId, 'В работе', event);
                } else if (action === 'complete') {
                    TO.updateStatus(taskId, 'Выполнена', event);
                }
                return;
            }

            const taskItem = event.target.closest('.task-item-optimized');
            if (taskItem) {
                const taskId = parseInt(taskItem.dataset.taskId);
                TO.showTaskDetails(taskId);
            }
        }
    };

    // Основные методы модуля
    TasksOptimized.init = function() {
        if (this.initialized) return;

        console.log('🚀 Инициализация оптимизированного модуля задач');

        // Настройка CSS для предотвращения дерганий
        const style = document.createElement('style');
        style.textContent = `
            .task-item-optimized {
                backface-visibility: hidden;
                -webkit-backface-visibility: hidden;
                perspective: 1000px;
                -webkit-perspective: 1000px;
            }

            .task-item-optimized:hover {
                transform: translateY(-2px) translateZ(0);
                box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            }

            .task-action-btn {
                transform: translateZ(0);
                transition: transform 0.15s ease;
            }

            .task-action-btn:active {
                transform: scale(0.95) translateZ(0);
            }

            #tasksList {
                scroll-behavior: smooth;
                overscroll-behavior: contain;
            }
        `;
        document.head.appendChild(style);

        this.initialized = true;
    };

    TasksOptimized.loadTasks = async function(forceRefresh = false) {
        // Предотвращаем множественные загрузки
        if (this.isLoading && !forceRefresh) return;
        this.isLoading = true;

        const container = document.getElementById('tasksList');

        // Показываем загрузку только если нет кэшированных данных
        if (!this.tasksCache.has(this.currentTaskType)) {
            if (container) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <div class="loading-spinner"></div>
                        <p style="margin-top: 16px; color: #999;">Загрузка задач...</p>
                    </div>
                `;
            }
        }

        try {
            const tasks = await API.getTasks(forceRefresh);
            this.currentTasks = tasks;

            // Рендерим с проверкой изменений
            Render.tasksList(tasks);
            this.updateTaskCounts(tasks);

        } catch (error) {
            console.error('Ошибка загрузки задач:', error);
            if (container) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #f44336;">
                        <p>Ошибка загрузки задач</p>
                        <button onclick="TasksOptimized.loadTasks(true)"
                                style="margin-top: 16px; padding: 8px 16px;
                                       background: #667eea; color: white;
                                       border: none; border-radius: 8px; cursor: pointer;">
                            Повторить
                        </button>
                    </div>
                `;
            }
        } finally {
            this.isLoading = false;
        }
    };

    TasksOptimized.switchTaskType = function(type) {
        if (this.currentTaskType === type) return;

        this.currentTaskType = type;

        // Обновляем UI переключателей
        document.querySelectorAll('.task-type-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        const activeBtn = type === 'created' ?
            document.getElementById('createdTasksBtn') :
            document.getElementById('myTasksBtn');

        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Загружаем задачи нового типа
        this.loadTasks();
    };

    TasksOptimized.filterTasks = function(filter, event) {
        this.currentFilter = filter;

        // Обновляем UI фильтров
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Если передано событие, используем его, иначе ищем кнопку по фильтру
        if (event && event.target) {
            const filterBtn = event.target.closest('.filter-btn');
            if (filterBtn) {
                filterBtn.classList.add('active');
            }
        } else {
            // Ищем кнопку по атрибуту onclick
            document.querySelectorAll('.filter-btn').forEach(btn => {
                const btnFilter = btn.onclick?.toString().match(/filterTasks\('([^']+)'/)?.[1];
                if (btnFilter === filter) {
                    btn.classList.add('active');
                }
            });
        }

        // Перерисовываем список с новым фильтром
        Render.tasksList(this.currentTasks);
    };

    TasksOptimized.updateTaskCounts = function(tasks) {
        const counts = {
            all: tasks.length,
            new: tasks.filter(t => t.status === 'Новая').length,
            'in-progress': tasks.filter(t => t.status === 'В работе').length,
            completed: tasks.filter(t => t.status === 'Выполнена').length
        };

        document.querySelectorAll('.filter-btn').forEach(btn => {
            const filter = btn.onclick?.toString().match(/filterTasks\('([^']+)'/)?.[1];
            if (filter && counts[filter] !== undefined) {
                const countEl = btn.querySelector('.count');
                if (countEl) {
                    countEl.textContent = counts[filter];
                }
            }
        });
    };

    TasksOptimized.updateStatus = async function(taskId, newStatus, event) {
        if (event) {
            event.stopPropagation();
        }

        try {
            // Оптимистичное обновление UI
            const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
            if (taskElement) {
                // Добавляем индикатор загрузки
                taskElement.style.opacity = '0.7';
                taskElement.style.pointerEvents = 'none';
            }

            await API.updateTaskStatus(taskId, newStatus);

            // Обновляем только измененную задачу в DOM
            const task = this.currentTasks.find(t => t.id === parseInt(taskId));
            if (task && taskElement) {
                task.status = newStatus;
                taskElement.outerHTML = Render.renderTaskItem(task);
            }

            // Обновляем счетчики
            this.updateTaskCounts(this.currentTasks);

            // Показываем уведомление
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }

        } catch (error) {
            console.error('Ошибка обновления статуса:', error);
            // Восстанавливаем состояние элемента
            const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
            if (taskElement) {
                taskElement.style.opacity = '1';
                taskElement.style.pointerEvents = 'auto';
            }
        }
    };

    TasksOptimized.showTaskDetails = function(taskId) {
        const task = this.currentTasks.find(t => t.id === taskId);
        if (!task) return;

        // Здесь можно добавить показ модального окна с деталями задачи
        console.log('Показ деталей задачи:', task);

        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
    };

    // Экспортируем методы для глобального доступа
    window.TasksOptimized = TasksOptimized;

    // Экспортируем функции для вызова из HTML
    window.filterTasks = function(filter, event) {
        TasksOptimized.filterTasks(filter, event);
    };

    window.switchTaskType = function(type) {
        TasksOptimized.switchTaskType(type);
    };

    // Автоматическая инициализация при загрузке
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => TasksOptimized.init());
    } else {
        TasksOptimized.init();
    }

})();