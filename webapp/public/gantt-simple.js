/**
 * Простая версия Gantt-диаграммы для мобильных устройств
 */

(function() {
    'use strict';

    window.SimpleGantt = {
        initialized: false,
        tasks: []
    };

    const SG = window.SimpleGantt;

    // Цвета статусов
    const statusColors = {
        'Новая': '#3b82f6',
        'В работе': '#f59e0b',
        'Выполнена': '#22c55e',
        'На проверке': '#a855f7',
        'Отложена': '#64748b'
    };

    // Инициализация
    SimpleGantt.init = function() {
        console.log('📊 Инициализация Simple Gantt');

        const container = document.getElementById('gantt-container');
        if (!container) {
            console.error('Не найден контейнер gantt-container');
            return;
        }

        // Очищаем контейнер
        container.innerHTML = `
            <style>
                #gantt-container {
                    padding: 12px;
                    background: var(--bg-primary, #1a1a2e);
                    min-height: calc(100vh - 120px);
                }

                .gantt-header {
                    margin-bottom: 16px;
                }

                .gantt-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: var(--text-primary, #fff);
                    margin-bottom: 12px;
                }

                .gantt-controls {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 16px;
                }

                .gantt-btn {
                    flex: 1;
                    padding: 10px;
                    background: var(--bg-secondary, #2d2d44);
                    color: var(--text-primary, #fff);
                    border: none;
                    border-radius: 12px;
                    font-size: 14px;
                    cursor: pointer;
                }

                .gantt-btn.active {
                    background: #3b82f6;
                    color: white;
                }

                .gantt-timeline-container {
                    background: var(--bg-card, #2d2d44);
                    border-radius: 16px;
                    padding: 12px;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }

                .gantt-month-header {
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--text-primary, #fff);
                    margin-bottom: 8px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }

                .gantt-task-row {
                    margin-bottom: 12px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                    padding: 8px;
                }

                .gantt-task-name {
                    font-size: 13px;
                    color: var(--text-primary, #fff);
                    margin-bottom: 6px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .gantt-task-status {
                    display: inline-block;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 10px;
                    color: white;
                    font-weight: 500;
                }

                .gantt-task-timeline {
                    position: relative;
                    height: 24px;
                    background: rgba(255,255,255,0.03);
                    border-radius: 4px;
                    overflow: hidden;
                }

                .gantt-task-bar {
                    position: absolute;
                    height: 100%;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    padding: 0 6px;
                    font-size: 10px;
                    color: white;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .gantt-task-dates {
                    font-size: 11px;
                    color: var(--text-secondary, #aaa);
                    margin-top: 4px;
                    display: flex;
                    justify-content: space-between;
                }

                .gantt-empty {
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--text-secondary, #aaa);
                }

                .gantt-empty-icon {
                    font-size: 48px;
                    margin-bottom: 12px;
                }

                .gantt-legend {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                    margin-top: 16px;
                    padding: 12px;
                    background: var(--bg-card, #2d2d44);
                    border-radius: 12px;
                }

                .gantt-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 12px;
                    color: var(--text-secondary, #aaa);
                }

                .gantt-legend-color {
                    width: 12px;
                    height: 12px;
                    border-radius: 3px;
                }
            </style>

            <div class="gantt-header">
                <h2 class="gantt-title">📊 График задач</h2>
            </div>

            <div class="gantt-controls">
                <button class="gantt-btn active" onclick="SimpleGantt.setView('week')">Неделя</button>
                <button class="gantt-btn" onclick="SimpleGantt.setView('month')">Месяц</button>
            </div>

            <div class="gantt-timeline-container" id="gantt-timeline">
                <div class="gantt-empty">
                    <div class="gantt-empty-icon">📊</div>
                    <div>Загрузка задач...</div>
                </div>
            </div>

            <div class="gantt-legend">
                ${Object.entries(statusColors).map(([status, color]) => `
                    <div class="gantt-legend-item">
                        <div class="gantt-legend-color" style="background: ${color}"></div>
                        <span>${status}</span>
                    </div>
                `).join('')}
            </div>
        `;

        this.initialized = true;
        this.loadTasks();
    };

    // Загрузка задач
    SimpleGantt.loadTasks = async function() {
        try {
            const tg = window.Telegram?.WebApp;
            const response = await fetch(`${window.location.origin}/api/tasks/my`, {
                headers: {
                    'X-Telegram-Init-Data': tg?.initData || ''
                }
            });

            if (!response.ok) throw new Error('Ошибка загрузки');
            const tasks = await response.json();

            // Фильтруем задачи с дедлайнами
            this.tasks = tasks.filter(t => t.deadline);

            // Если нет задач с датами, показываем демо
            if (this.tasks.length === 0) {
                this.showDemoTasks();
            } else {
                this.renderTasks();
            }
        } catch (error) {
            console.error('Ошибка загрузки задач:', error);
            this.showDemoTasks();
        }
    };

    // Показ демо-задач
    SimpleGantt.showDemoTasks = function() {
        const today = new Date();
        this.tasks = [
            {
                title: 'Пример задачи 1',
                status: 'В работе',
                deadline: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                created_at: today.toISOString()
            },
            {
                title: 'Пример задачи 2',
                status: 'Новая',
                deadline: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                created_at: today.toISOString()
            }
        ];
        this.renderTasks();
    };

    // Отображение задач
    SimpleGantt.renderTasks = function() {
        const container = document.getElementById('gantt-timeline');
        if (!container) return;

        if (this.tasks.length === 0) {
            container.innerHTML = `
                <div class="gantt-empty">
                    <div class="gantt-empty-icon">📭</div>
                    <div>Нет задач с установленными сроками</div>
                </div>
            `;
            return;
        }

        // Группируем по месяцам
        const tasksByMonth = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        this.tasks.forEach(task => {
            const deadline = new Date(task.deadline);
            const monthKey = `${deadline.getFullYear()}-${deadline.getMonth() + 1}`;

            if (!tasksByMonth[monthKey]) {
                tasksByMonth[monthKey] = {
                    month: deadline.toLocaleDateString('ru', { month: 'long', year: 'numeric' }),
                    tasks: []
                };
            }

            // Рассчитываем позицию на временной шкале
            const startDate = task.created_at ? new Date(task.created_at) : new Date(deadline.getTime() - 3 * 24 * 60 * 60 * 1000);
            const totalDays = 30; // Упрощенно - 30 дней в месяце
            const startDay = startDate.getDate();
            const endDay = deadline.getDate();

            const startPercent = (startDay / totalDays) * 100;
            const widthPercent = ((endDay - startDay + 1) / totalDays) * 100;

            tasksByMonth[monthKey].tasks.push({
                ...task,
                startPercent: Math.max(0, startPercent),
                widthPercent: Math.max(10, Math.min(100, widthPercent))
            });
        });

        // Рендерим
        let html = '';
        Object.values(tasksByMonth).forEach(group => {
            html += `
                <div class="gantt-month-section">
                    <div class="gantt-month-header">${group.month}</div>
                    ${group.tasks.map(task => `
                        <div class="gantt-task-row">
                            <div class="gantt-task-name">
                                <span class="gantt-task-status" style="background: ${statusColors[task.status] || '#64748b'}">
                                    ${task.status}
                                </span>
                                <span>${task.title}</span>
                            </div>
                            <div class="gantt-task-timeline">
                                <div class="gantt-task-bar"
                                     style="left: ${task.startPercent}%;
                                            width: ${task.widthPercent}%;
                                            background: ${statusColors[task.status] || '#64748b'}">
                                    ${Math.round(task.widthPercent * 30 / 100)} дн.
                                </div>
                            </div>
                            <div class="gantt-task-dates">
                                <span>Создана: ${new Date(task.created_at || task.deadline).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}</span>
                                <span>Срок: ${new Date(task.deadline).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        });

        container.innerHTML = html || `
            <div class="gantt-empty">
                <div class="gantt-empty-icon">📊</div>
                <div>Нет активных задач</div>
            </div>
        `;
    };

    // Переключение вида
    SimpleGantt.setView = function(view) {
        // Обновляем кнопки
        document.querySelectorAll('.gantt-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');

        // В упрощенной версии просто перерисовываем
        this.renderTasks();
    };

})();