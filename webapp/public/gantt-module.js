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
                padding: 16px;
                background: var(--bg-primary);
                min-height: 100vh;
            }

            .gantt-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding: 0 4px;
            }

            .gantt-title {
                font-size: 24px;
                font-weight: 600;
                color: var(--text-primary);
            }

            .gantt-view-selector {
                display: flex;
                gap: 8px;
            }

            .gantt-view-btn {
                padding: 8px 16px;
                background: var(--bg-secondary);
                color: var(--text-primary);
                border: none;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s;
            }

            .gantt-view-btn.active {
                background: #3b82f6;
                color: white;
            }

            .gantt-chart {
                background: var(--bg-card);
                border-radius: 16px;
                padding: 20px;
                overflow-x: auto;
                position: relative;
            }

            .gantt-grid {
                position: relative;
                min-width: 100%;
                display: flex;
                flex-direction: column;
            }

            .gantt-timeline {
                display: flex;
                height: 40px;
                border-bottom: 2px solid var(--border-color);
                margin-bottom: 10px;
                position: sticky;
                top: 0;
                background: var(--bg-card);
                z-index: 10;
            }

            .gantt-timeline-cell {
                flex: 1;
                min-width: 40px;
                text-align: center;
                padding: 10px 4px;
                font-size: 12px;
                color: var(--text-secondary);
                border-right: 1px solid rgba(255, 255, 255, 0.1);
            }

            .gantt-timeline-cell.weekend {
                background: rgba(255, 255, 255, 0.02);
            }

            .gantt-timeline-cell.today {
                background: rgba(59, 130, 246, 0.1);
                color: #3b82f6;
                font-weight: bold;
            }

            .gantt-row {
                display: flex;
                height: 50px;
                position: relative;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }

            .gantt-row:hover {
                background: rgba(255, 255, 255, 0.02);
            }

            .gantt-task-info {
                position: absolute;
                left: 0;
                width: 200px;
                padding: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                color: var(--text-primary);
                background: var(--bg-card);
                z-index: 5;
            }

            .gantt-task-bar {
                position: absolute;
                height: 32px;
                top: 9px;
                border-radius: 6px;
                display: flex;
                align-items: center;
                padding: 0 12px;
                font-size: 12px;
                color: white;
                cursor: pointer;
                transition: all 0.3s;
                z-index: 3;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .gantt-task-bar:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }

            .gantt-task-progress {
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 6px;
            }

            .gantt-task-label {
                position: relative;
                z-index: 1;
            }

            .gantt-grid-lines {
                position: absolute;
                top: 0;
                bottom: 0;
                left: 200px;
                right: 0;
                pointer-events: none;
            }

            .gantt-grid-line {
                position: absolute;
                top: 0;
                bottom: 0;
                width: 1px;
                background: rgba(255, 255, 255, 0.05);
            }

            .gantt-today-line {
                position: absolute;
                top: 0;
                bottom: 0;
                width: 2px;
                background: #3b82f6;
                z-index: 2;
            }

            .gantt-legend {
                display: flex;
                gap: 20px;
                margin-top: 20px;
                padding: 16px;
                background: var(--bg-card);
                border-radius: 12px;
                flex-wrap: wrap;
            }

            .gantt-legend-item {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                color: var(--text-secondary);
            }

            .gantt-legend-color {
                width: 16px;
                height: 16px;
                border-radius: 4px;
            }

            .gantt-tooltip {
                position: fixed;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 12px;
                font-size: 14px;
                color: var(--text-primary);
                z-index: 1000;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.3s;
                max-width: 300px;
            }

            .gantt-tooltip.visible {
                opacity: 1;
            }

            .gantt-tooltip-title {
                font-weight: 600;
                margin-bottom: 8px;
            }

            .gantt-tooltip-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 4px;
            }

            .gantt-tooltip-label {
                color: var(--text-secondary);
            }

            @media (max-width: 768px) {
                .gantt-task-info {
                    width: 120px;
                    font-size: 12px;
                }

                .gantt-grid-lines {
                    left: 120px;
                }

                .gantt-timeline-cell {
                    min-width: 30px;
                    font-size: 10px;
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
                <h2 class="gantt-title">📊 Диаграмма Ганта</h2>
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

            // Фильтруем задачи с датами и преобразуем
            this.currentTasks = tasks.filter(task => task.deadline).map(task => {
                // Если нет даты начала, ставим за 3 дня до дедлайна
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

            this.renderGantt();
            this.renderLegend();
        } catch (error) {
            console.error('Ошибка загрузки задач для Gantt:', error);
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

        let html = '<div class="gantt-timeline">';

        // Рендерим временную шкалу
        dates.forEach(date => {
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const isToday = DateUtils.formatDate(date) === DateUtils.formatDate(new Date());
            const classes = `gantt-timeline-cell${isWeekend ? ' weekend' : ''}${isToday ? ' today' : ''}`;

            html += `<div class="${classes}" style="width: ${cellWidth}px">${this.formatTimelineDate(date)}</div>`;
        });
        html += '</div>';

        // Рендерим сетку и задачи
        html += '<div class="gantt-grid-lines">';
        dates.forEach((date, index) => {
            const left = index * cellWidth;
            html += `<div class="gantt-grid-line" style="left: ${left}px"></div>`;

            // Линия сегодняшнего дня
            if (DateUtils.formatDate(date) === DateUtils.formatDate(new Date())) {
                html += `<div class="gantt-today-line" style="left: ${left}px"></div>`;
            }
        });
        html += '</div>';

        // Рендерим задачи
        this.currentTasks.forEach((task, index) => {
            html += this.renderTaskBar(task, index, dates, cellWidth);
        });

        grid.innerHTML = html;
        grid.style.paddingLeft = '200px';

        // Добавляем обработчики событий
        this.attachEventHandlers();
    };

    // Рендеринг полоски задачи
    GanttModule.renderTaskBar = function(task, index, dates, cellWidth) {
        const startOffset = this.getDateOffset(task.start, dates[0]) * cellWidth;
        const duration = DateUtils.getDaysBetween(task.start, task.end) + 1;
        const width = duration * cellWidth;
        const top = index * 50;
        const color = statusColors[task.status] || '#64748b';

        return `
            <div class="gantt-row" style="top: ${top}px">
                <div class="gantt-task-info">
                    <span>${task.name}</span>
                </div>
                <div class="gantt-task-bar"
                     data-task-id="${task.id}"
                     style="left: ${200 + startOffset}px; width: ${width}px; background: ${color}">
                    <div class="gantt-task-progress" style="width: ${task.progress}%"></div>
                    <span class="gantt-task-label">${task.name}</span>
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
        switch (this.viewMode) {
            case 'Day':
                return 120;
            case 'Week':
                return 40;
            case 'Month':
                return 20;
            default:
                return 40;
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