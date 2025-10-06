/**
 * Модуль Gantt-диаграммы для визуализации задач
 * Использует собственную легковесную реализацию для Telegram Web App
 */

(function() {
    'use strict';

    window.GanttModule = {
        initialized: false,
        currentTasks: [],
        viewMode: 'Week', // Day, Week, Month
        container: null
    };

    const GM = window.GanttModule;
    const API_URL = window.location.origin;

    // Цветовая схема для разных статусов
    const statusColors = {
        'Новая': '#3b82f6',
        'В работе': '#f59e0b',
        'Выполнена': '#22c55e',
        'На проверке': '#a855f7',
        'Отложена': '#64748b'
    };

    // Утилиты для работы с датами
    const DateUtils = {
        formatDate(date) {
            const d = new Date(date);
            return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
        },

        addDays(date, days) {
            const result = new Date(date);
            result.setDate(result.getDate() + days);
            return result;
        },

        getDaysBetween(start, end) {
            const startDate = new Date(start);
            const endDate = new Date(end);
            const diffTime = Math.abs(endDate - startDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays;
        },

        getWeekNumber(date) {
            const d = new Date(date);
            const onejan = new Date(d.getFullYear(), 0, 1);
            return Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
        }
    };

    // Инициализация модуля
    GanttModule.init = function() {
        if (this.initialized) {
            console.log('GanttModule уже инициализирован');
            return;
        }

        console.log('📊 Инициализация GanttModule...');

        // Добавляем стили
        this.injectStyles();

        // Создаем контейнер для диаграммы
        this.createContainer();

        // Загружаем задачи
        this.loadTasks();

        this.initialized = true;
        console.log('✅ GanttModule инициализирован');
    };

    // Внедрение стилей
    GanttModule.injectStyles = function() {
        if (document.getElementById('gantt-styles')) return;

        const style = document.createElement('style');
        style.id = 'gantt-styles';
        style.textContent = `
            #gantt-container {
                padding: 12px;
                background: var(--bg-primary);
                min-height: calc(100vh - 70px);
                overflow-x: hidden;
            }

            .gantt-header {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-bottom: 16px;
            }

            .gantt-title {
                font-size: 20px;
                font-weight: 600;
                color: var(--text-primary);
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .gantt-view-selector {
                display: flex;
                gap: 6px;
                width: 100%;
            }

            .gantt-view-btn {
                flex: 1;
                padding: 10px 12px;
                background: var(--bg-secondary);
                color: var(--text-primary);
                border: none;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.3s;
                font-size: 14px;
                font-weight: 500;
                text-align: center;
            }

            .gantt-view-btn.active {
                background: #3b82f6;
                color: white;
                box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
            }

            .gantt-chart {
                background: var(--bg-card);
                border-radius: 16px;
                padding: 12px;
                overflow-x: auto;
                position: relative;
                margin-bottom: 16px;
                -webkit-overflow-scrolling: touch;
            }

            .gantt-grid {
                position: relative;
                min-width: 100%;
                display: block;
            }

            .gantt-timeline {
                display: flex;
                height: 36px;
                border-bottom: 2px solid var(--border-color);
                margin-bottom: 8px;
                background: var(--bg-card);
            }

            .gantt-timeline-cell {
                flex: 0 0 auto;
                min-width: 30px;
                text-align: center;
                padding: 8px 2px;
                font-size: 10px;
                color: var(--text-secondary);
                border-right: 1px solid rgba(255, 255, 255, 0.05);
            }

            .gantt-timeline-cell.weekend {
                background: rgba(255, 255, 255, 0.02);
            }

            .gantt-timeline-cell.today {
                background: rgba(59, 130, 246, 0.1);
                color: #3b82f6;
                font-weight: bold;
            }

            .gantt-task-bar:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            }

            .gantt-tasks-container {
                min-height: 200px;
            }

            .gantt-legend {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
                padding: 12px;
                background: var(--bg-card);
                border-radius: 12px;
                margin-top: 12px;
            }

            .gantt-legend-item {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                color: var(--text-secondary);
            }

            .gantt-legend-color {
                width: 12px;
                height: 12px;
                border-radius: 3px;
                flex-shrink: 0;
            }

            .gantt-tooltip {
                position: fixed;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 10px;
                font-size: 12px;
                color: var(--text-primary);
                z-index: 1000;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.3s;
                max-width: 250px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            }

            .gantt-tooltip.visible {
                opacity: 1;
            }

            .gantt-tooltip-title {
                font-weight: 600;
                margin-bottom: 6px;
                font-size: 13px;
            }

            .gantt-tooltip-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 3px;
                font-size: 11px;
            }

            .gantt-tooltip-label {
                color: var(--text-secondary);
            }

            /* Скрываем легенду на очень маленьких экранах */
            @media (max-width: 360px) {
                .gantt-legend {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(style);
    };

    // Создание контейнера
    GanttModule.createContainer = function() {
        // Ищем контейнер для Gantt
        let container = document.getElementById('gantt-container');
        if (!container) {
            // Если нет специального контейнера, ищем основной контейнер задач
            container = document.getElementById('tasks');
            if (!container) {
                console.error('Не найден контейнер для Gantt');
                return;
            }
        }

        // Очищаем контейнер и создаем структуру
        container.innerHTML = `
            <div class="gantt-header">
                <div class="gantt-title">
                    <span>📊</span>
                    <span>Диаграмма Ганта</span>
                </div>
                <div class="gantt-view-selector">
                    <button class="gantt-view-btn" data-view="Day">День</button>
                    <button class="gantt-view-btn active" data-view="Week">Неделя</button>
                    <button class="gantt-view-btn" data-view="Month">Месяц</button>
                </div>
            </div>
            <div class="gantt-chart">
                <div class="gantt-grid" id="gantt-grid">
                    <!-- Здесь будет диаграмма -->
                </div>
            </div>
            <div class="gantt-legend" id="gantt-legend"></div>
            <div class="gantt-tooltip" id="gantt-tooltip"></div>
        `;

        this.container = container;

        // Обработчики для переключения вида
        container.querySelectorAll('.gantt-view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setViewMode(btn.dataset.view);
            });
        });
    };

    // Загрузка задач
    GanttModule.loadTasks = async function() {
        try {
            const tg = window.Telegram?.WebApp;
            const response = await fetch(`${API_URL}/api/tasks/my`, {
                headers: {
                    'X-Telegram-Init-Data': tg?.initData || ''
                }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const tasks = await response.json();

            console.log('📊 Загружено задач:', tasks.length);

            // Создаем тестовые задачи если нет задач с датами
            const hasTasksWithDates = tasks.some(t => t.deadline);

            if (!hasTasksWithDates) {
                // Добавляем демо-задачи для отображения
                const today = new Date();
                this.currentTasks = [
                    {
                        id: 1,
                        name: 'Тестовая задача для проверки модального окна',
                        start: DateUtils.addDays(today, -2),
                        end: DateUtils.addDays(today, 3),
                        progress: 50,
                        status: 'В работе',
                        assignee: 'Вы',
                        priority: 'Средний',
                        description: 'Это тестовая задача'
                    },
                    {
                        id: 2,
                        name: 'Настроить шкафчики и браслеты',
                        start: today,
                        end: DateUtils.addDays(today, 5),
                        progress: 25,
                        status: 'Новая',
                        assignee: 'Вы',
                        priority: 'Высокий',
                        description: 'Настройка оборудования'
                    },
                    {
                        id: 3,
                        name: 'Бот-заказ с лежаков',
                        start: DateUtils.addDays(today, 1),
                        end: DateUtils.addDays(today, 7),
                        progress: 0,
                        status: 'Новая',
                        assignee: 'Вы',
                        priority: 'Средний',
                        description: 'Разработка функционала'
                    }
                ];
            } else {
                // Преобразуем реальные задачи
                this.currentTasks = tasks.filter(task => task.deadline).map(task => {
                    const deadline = new Date(task.deadline);
                    const startDate = task.startDate ? new Date(task.startDate) : DateUtils.addDays(deadline, -3);

                    return {
                        id: task.id,
                        name: task.title,
                        start: startDate,
                        end: deadline,
                        progress: this.calculateProgress(task.status),
                        status: task.status,
                        assignee: task.assignee_name || 'Не назначен',
                        priority: task.priority,
                        description: task.description
                    };
                });
            }

            console.log('📊 Задач для отображения:', this.currentTasks.length);
            this.renderGantt();
            this.renderLegend();
        } catch (error) {
            console.error('Ошибка загрузки задач для Gantt:', error);

            // Показываем демо-задачи при ошибке
            const today = new Date();
            this.currentTasks = [
                {
                    id: 1,
                    name: 'Пример задачи',
                    start: DateUtils.addDays(today, -1),
                    end: DateUtils.addDays(today, 2),
                    progress: 50,
                    status: 'В работе',
                    assignee: 'Демо',
                    priority: 'Средний'
                }
            ];
            this.renderGantt();
            this.renderLegend();
        }
    };

    // Расчет прогресса по статусу
    GanttModule.calculateProgress = function(status) {
        const progressMap = {
            'Новая': 0,
            'В работе': 50,
            'На проверке': 75,
            'Выполнена': 100,
            'Отложена': 25
        };
        return progressMap[status] || 0;
    };

    // Установка режима просмотра
    GanttModule.setViewMode = function(mode) {
        this.viewMode = mode;

        // Обновляем кнопки
        this.container.querySelectorAll('.gantt-view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === mode);
        });

        this.renderGantt();
    };

    // Рендеринг диаграммы
    GanttModule.renderGantt = function() {
        const grid = document.getElementById('gantt-grid');
        if (!grid) return;

        // Определяем временные рамки
        const dates = this.getDateRange();
        const cellWidth = this.getCellWidth();

        let html = '';

        // Временная шкала
        html += '<div class="gantt-timeline">';
        dates.forEach(date => {
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const isToday = DateUtils.formatDate(date) === DateUtils.formatDate(new Date());
            const classes = `gantt-timeline-cell${isWeekend ? ' weekend' : ''}${isToday ? ' today' : ''}`;
            html += `<div class="${classes}" style="width: ${cellWidth}px">${this.formatTimelineDate(date)}</div>`;
        });
        html += '</div>';

        // Контейнер для задач
        html += '<div class="gantt-tasks-container" style="position: relative;">';

        // Сетка
        html += '<div class="gantt-grid-background" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0;">';
        dates.forEach((date, index) => {
            const left = index * cellWidth;
            const isToday = DateUtils.formatDate(date) === DateUtils.formatDate(new Date());
            if (isToday) {
                html += `<div style="position: absolute; left: ${left}px; top: 0; bottom: 0; width: 2px; background: #3b82f6; opacity: 0.5;"></div>`;
            }
        });
        html += '</div>';

        // Задачи
        if (this.currentTasks && this.currentTasks.length > 0) {
            this.currentTasks.forEach((task, index) => {
                html += this.renderTaskBar(task, index, dates, cellWidth);
            });
        } else {
            html += '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">Нет задач с установленными датами</div>';
        }

        html += '</div>';

        grid.innerHTML = html;

        // Добавляем обработчики событий
        this.attachEventHandlers();
    };

    // Рендеринг полоски задачи
    GanttModule.renderTaskBar = function(task, index, dates, cellWidth) {
        const startOffset = this.getDateOffset(task.start, dates[0]) * cellWidth;
        const duration = DateUtils.getDaysBetween(task.start, task.end) + 1;
        const width = Math.max(duration * cellWidth, cellWidth); // Минимальная ширина = 1 день
        const top = index * 40; // Высота строки
        const color = statusColors[task.status] || '#64748b';

        // Обрезаем длинные названия
        const truncatedName = task.name.length > 20 ?
            task.name.substring(0, 17) + '...' : task.name;

        return `
            <div style="position: relative; height: 40px; margin-bottom: 4px;">
                <div class="gantt-task-bar"
                     data-task-id="${task.id}"
                     style="position: absolute;
                            left: ${startOffset}px;
                            width: ${width}px;
                            height: 32px;
                            top: 4px;
                            background: ${color};
                            border-radius: 6px;
                            display: flex;
                            align-items: center;
                            padding: 0 8px;
                            cursor: pointer;
                            overflow: hidden;
                            z-index: 2;">
                    <div style="position: absolute; left: 0; top: 0; bottom: 0;
                                width: ${task.progress}%;
                                background: rgba(255, 255, 255, 0.2);
                                border-radius: 6px;"></div>
                    <span style="position: relative;
                                 color: white;
                                 font-size: 11px;
                                 white-space: nowrap;
                                 overflow: hidden;
                                 text-overflow: ellipsis;">${truncatedName}</span>
                </div>
            </div>
        `;
    };

    // Получение диапазона дат
    GanttModule.getDateRange = function() {
        const dates = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let startDate, endDate, daysCount;

        switch (this.viewMode) {
            case 'Day':
                daysCount = 7;
                startDate = DateUtils.addDays(today, -1);
                break;
            case 'Week':
                daysCount = 21;
                startDate = DateUtils.addDays(today, -7);
                break;
            case 'Month':
                daysCount = 60;
                startDate = DateUtils.addDays(today, -15);
                break;
            default:
                daysCount = 21;
                startDate = DateUtils.addDays(today, -7);
        }

        for (let i = 0; i < daysCount; i++) {
            dates.push(DateUtils.addDays(startDate, i));
        }

        return dates;
    };

    // Форматирование даты для временной шкалы
    GanttModule.formatTimelineDate = function(date) {
        switch (this.viewMode) {
            case 'Day':
                return `${date.getDate()}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            case 'Week':
                return date.getDate().toString();
            case 'Month':
                // Показываем только первые числа недели
                if (date.getDay() === 1 || date.getDate() === 1) {
                    return `${date.getDate()}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                }
                return '';
            default:
                return date.getDate().toString();
        }
    };

    // Получение ширины ячейки
    GanttModule.getCellWidth = function() {
        // Для мобильных устройств используем меньшие значения
        const isMobile = window.innerWidth <= 768;

        switch (this.viewMode) {
            case 'Day':
                return isMobile ? 50 : 80;
            case 'Week':
                return isMobile ? 25 : 35;
            case 'Month':
                return isMobile ? 15 : 20;
            default:
                return isMobile ? 25 : 35;
        }
    };

    // Получение смещения даты
    GanttModule.getDateOffset = function(date, startDate) {
        return DateUtils.getDaysBetween(startDate, date);
    };

    // Рендеринг легенды
    GanttModule.renderLegend = function() {
        const legend = document.getElementById('gantt-legend');
        if (!legend) return;

        let html = '';
        for (const [status, color] of Object.entries(statusColors)) {
            html += `
                <div class="gantt-legend-item">
                    <div class="gantt-legend-color" style="background: ${color}"></div>
                    <span>${status}</span>
                </div>
            `;
        }

        legend.innerHTML = html;
    };

    // Прикрепление обработчиков событий
    GanttModule.attachEventHandlers = function() {
        const tooltip = document.getElementById('gantt-tooltip');

        // Обработка наведения на задачу
        this.container.querySelectorAll('.gantt-task-bar').forEach(bar => {
            bar.addEventListener('mouseenter', (e) => {
                const taskId = bar.dataset.taskId;
                const task = this.currentTasks.find(t => t.id == taskId);
                if (!task) return;

                tooltip.innerHTML = `
                    <div class="gantt-tooltip-title">${task.name}</div>
                    <div class="gantt-tooltip-row">
                        <span class="gantt-tooltip-label">Статус:</span>
                        <span>${task.status}</span>
                    </div>
                    <div class="gantt-tooltip-row">
                        <span class="gantt-tooltip-label">Прогресс:</span>
                        <span>${task.progress}%</span>
                    </div>
                    <div class="gantt-tooltip-row">
                        <span class="gantt-tooltip-label">Исполнитель:</span>
                        <span>${task.assignee}</span>
                    </div>
                    <div class="gantt-tooltip-row">
                        <span class="gantt-tooltip-label">Начало:</span>
                        <span>${DateUtils.formatDate(task.start)}</span>
                    </div>
                    <div class="gantt-tooltip-row">
                        <span class="gantt-tooltip-label">Дедлайн:</span>
                        <span>${DateUtils.formatDate(task.end)}</span>
                    </div>
                `;

                const rect = bar.getBoundingClientRect();
                tooltip.style.left = `${rect.left}px`;
                tooltip.style.top = `${rect.bottom + 10}px`;
                tooltip.classList.add('visible');
            });

            bar.addEventListener('mouseleave', () => {
                tooltip.classList.remove('visible');
            });

            // Клик по задаче - открываем детали
            bar.addEventListener('click', () => {
                const taskId = bar.dataset.taskId;
                // Вызываем модуль задач для показа деталей
                if (window.TasksModule && window.TasksModule.showTaskDetails) {
                    // Находим оригинальную задачу
                    const task = this.currentTasks.find(t => t.id == taskId);
                    if (task) {
                        window.TasksModule.showTaskDetails({
                            id: task.id,
                            title: task.name,
                            description: task.description,
                            status: task.status,
                            priority: task.priority,
                            deadline: DateUtils.formatDate(task.end),
                            assignee_name: task.assignee
                        });
                    }
                }
            });
        });
    };

    // Экспорт в изображение (для отправки в чат)
    GanttModule.exportToImage = async function() {
        // Здесь можно использовать html2canvas для создания скриншота
        // Но для простоты пока оставим заглушку
        console.log('Экспорт в изображение пока не реализован');
    };

    // Автоматическая инициализация при переходе на вкладку Gantt
    window.showGanttChart = function() {
        GanttModule.init();
    };

})();