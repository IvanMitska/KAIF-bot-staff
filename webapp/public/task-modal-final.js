// Финальное модальное окно задач - загружается последним
console.log('🚀 Загружается task-modal-final.js');

// Защищенная версия showTaskDetails
(function() {
    'use strict';

    // Сохраняем оригинальные функции
    const originalShowTaskDetails = window.showTaskDetails;
    const originalCreateTaskDetailModal = window.createTaskDetailModal;
    const originalCloseTaskDetailModal = window.closeTaskDetailModal;

    console.log('🔍 Оригинальные функции:', {
        showTaskDetails: typeof originalShowTaskDetails,
        createTaskDetailModal: typeof originalCreateTaskDetailModal,
        closeTaskDetailModal: typeof originalCloseTaskDetailModal
    });

    // Кеш модального окна
    let taskDetailModalCache = null;
    let currentTaskDetails = null;

    // Создание модального окна
    function createTaskDetailModal() {
        if (taskDetailModalCache) {
            return taskDetailModalCache;
        }

        const modalHTML = `
            <div id="taskDetailModal" class="modal-overlay hidden" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(8px);
                z-index: 10000;
                display: none;
                justify-content: center;
                align-items: center;
                padding: 20px;
                box-sizing: border-box;
            ">
                <div class="modal-container task-detail-container" style="
                    width: 90%;
                    max-width: 600px;
                    max-height: 90vh;
                    overflow-y: auto;
                    background: var(--bg-card, #1a1a2e);
                    border-radius: 20px;
                    padding: 0;
                    position: relative;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                ">
                    <div class="modal-header" style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 24px 24px 0 24px;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                        margin-bottom: 0;
                    ">
                        <div class="modal-title-section">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div class="modal-icon" style="
                                    width: 40px;
                                    height: 40px;
                                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                    border-radius: 12px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    color: white;
                                ">📋</div>
                                <h2 class="modal-title" style="
                                    margin: 0;
                                    color: var(--text-primary, #ffffff);
                                    font-size: 20px;
                                    font-weight: 600;
                                ">Детали задачи</h2>
                            </div>
                        </div>
                        <button class="modal-close" onclick="closeTaskDetailModal()" style="
                            background: rgba(255, 255, 255, 0.1);
                            border: none;
                            border-radius: 12px;
                            width: 40px;
                            height: 40px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            cursor: pointer;
                            color: var(--text-secondary, #cccccc);
                            transition: all 0.3s ease;
                        " onmouseover="this.style.background='rgba(255, 255, 255, 0.2)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.1)'">✕</button>
                    </div>

                    <div class="task-detail-content" style="padding: 24px;">
                        <!-- Заголовок и статус -->
                        <div class="task-detail-header" style="margin-bottom: 24px;">
                            <h3 id="detailTaskTitle" class="task-title" style="
                                font-size: 20px;
                                font-weight: 600;
                                color: var(--text-primary, #ffffff);
                                margin-bottom: 12px;
                                line-height: 1.4;
                            "></h3>
                            <div class="task-badges" style="display: flex; gap: 12px; flex-wrap: wrap;">
                                <span id="detailTaskStatus" class="task-status"></span>
                                <span id="detailTaskPriority" class="task-priority"></span>
                            </div>
                        </div>

                        <!-- Описание -->
                        <div class="task-detail-section" style="margin-bottom: 24px;">
                            <div class="section-label" style="
                                display: flex;
                                align-items: center;
                                gap: 8px;
                                margin-bottom: 12px;
                                color: var(--text-secondary, #cccccc);
                                font-size: 14px;
                                font-weight: 500;
                            ">
                                <span>📄</span>
                                <span>Описание</span>
                            </div>
                            <div id="detailTaskDescription" class="task-description" style="
                                background: rgba(255, 255, 255, 0.05);
                                padding: 16px;
                                border-radius: 12px;
                                color: var(--text-primary, #ffffff);
                                line-height: 1.6;
                                white-space: pre-wrap;
                                word-wrap: break-word;
                                min-height: 60px;
                            "></div>
                        </div>

                        <!-- Информация о задаче -->
                        <div class="task-detail-grid" style="
                            display: grid;
                            grid-template-columns: repeat(2, 1fr);
                            gap: 20px;
                            margin-bottom: 24px;
                        ">
                            <div class="detail-item" style="
                                background: rgba(255, 255, 255, 0.05);
                                padding: 14px;
                                border-radius: 12px;
                            ">
                                <div class="detail-label" style="
                                    display: flex;
                                    align-items: center;
                                    gap: 6px;
                                    margin-bottom: 8px;
                                    color: var(--text-secondary, #cccccc);
                                    font-size: 12px;
                                    font-weight: 500;
                                    text-transform: uppercase;
                                ">
                                    <span>👤</span>
                                    <span>Исполнитель</span>
                                </div>
                                <div id="detailTaskEmployee" class="detail-value" style="
                                    color: var(--text-primary, #ffffff);
                                    font-size: 15px;
                                    font-weight: 500;
                                "></div>
                            </div>

                            <div class="detail-item" style="
                                background: rgba(255, 255, 255, 0.05);
                                padding: 14px;
                                border-radius: 12px;
                            ">
                                <div class="detail-label" style="
                                    display: flex;
                                    align-items: center;
                                    gap: 6px;
                                    margin-bottom: 8px;
                                    color: var(--text-secondary, #cccccc);
                                    font-size: 12px;
                                    font-weight: 500;
                                    text-transform: uppercase;
                                ">
                                    <span>➕</span>
                                    <span>Поставил</span>
                                </div>
                                <div id="detailTaskCreator" class="detail-value" style="
                                    color: var(--text-primary, #ffffff);
                                    font-size: 15px;
                                    font-weight: 500;
                                "></div>
                            </div>

                            <div class="detail-item" style="
                                background: rgba(255, 255, 255, 0.05);
                                padding: 14px;
                                border-radius: 12px;
                            ">
                                <div class="detail-label" style="
                                    display: flex;
                                    align-items: center;
                                    gap: 6px;
                                    margin-bottom: 8px;
                                    color: var(--text-secondary, #cccccc);
                                    font-size: 12px;
                                    font-weight: 500;
                                    text-transform: uppercase;
                                ">
                                    <span>📅</span>
                                    <span>Дедлайн</span>
                                </div>
                                <div id="detailTaskDeadline" class="detail-value" style="
                                    color: var(--text-primary, #ffffff);
                                    font-size: 15px;
                                    font-weight: 500;
                                "></div>
                            </div>

                            <div class="detail-item" style="
                                background: rgba(255, 255, 255, 0.05);
                                padding: 14px;
                                border-radius: 12px;
                            ">
                                <div class="detail-label" style="
                                    display: flex;
                                    align-items: center;
                                    gap: 6px;
                                    margin-bottom: 8px;
                                    color: var(--text-secondary, #cccccc);
                                    font-size: 12px;
                                    font-weight: 500;
                                    text-transform: uppercase;
                                ">
                                    <span>⏰</span>
                                    <span>Создана</span>
                                </div>
                                <div id="detailTaskCreatedAt" class="detail-value" style="
                                    color: var(--text-primary, #ffffff);
                                    font-size: 15px;
                                    font-weight: 500;
                                "></div>
                            </div>
                        </div>

                        <!-- Кнопки действий -->
                        <div class="task-detail-actions" style="
                            display: flex;
                            flex-wrap: wrap;
                            gap: 12px;
                            padding-top: 20px;
                            border-top: 1px solid rgba(255, 255, 255, 0.1);
                        ">
                            <button id="btnStartTask" class="action-btn btn-primary" onclick="startTask()" style="
                                flex: 1;
                                min-width: 150px;
                                padding: 12px 20px;
                                border: none;
                                border-radius: 12px;
                                font-size: 14px;
                                font-weight: 500;
                                cursor: pointer;
                                transition: all 0.3s ease;
                                display: none;
                                align-items: center;
                                justify-content: center;
                                gap: 8px;
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                color: white;
                            ">
                                <span>▶️</span>
                                <span>Начать выполнение</span>
                            </button>

                            <button id="btnCompleteTask" class="action-btn btn-success" onclick="completeTask()" style="
                                flex: 1;
                                min-width: 150px;
                                padding: 12px 20px;
                                border: none;
                                border-radius: 12px;
                                font-size: 14px;
                                font-weight: 500;
                                cursor: pointer;
                                transition: all 0.3s ease;
                                display: none;
                                align-items: center;
                                justify-content: center;
                                gap: 8px;
                                background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                                color: white;
                            ">
                                <span>✅</span>
                                <span>Завершить</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Добавляем модальное окно в DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        taskDetailModalCache = document.getElementById('taskDetailModal');

        // Добавляем обработчик клика по фону
        taskDetailModalCache.addEventListener('click', function(e) {
            if (e.target === taskDetailModalCache) {
                closeTaskDetailModal();
            }
        });

        console.log('✅ Модальное окно создано');
        return taskDetailModalCache;
    }

    // Закрытие модального окна
    function closeTaskDetailModal() {
        const modal = document.getElementById('taskDetailModal');
        if (!modal) return;

        modal.style.display = 'none';
        modal.classList.add('hidden');
        currentTaskDetails = null;
        console.log('🚪 Модальное окно закрыто');
    }

    // Показ деталей задачи
    function showTaskDetails(taskId) {
        console.log('🔍 showTaskDetails вызвана с taskId:', taskId);

        // Создаем модальное окно если его нет
        let modal = document.getElementById('taskDetailModal');
        if (!modal) {
            createTaskDetailModal();
            modal = document.getElementById('taskDetailModal');
        }

        // Показываем модальное окно
        modal.style.display = 'flex';
        modal.classList.remove('hidden');

        // Ищем задачу в кеше
        let task = null;
        if (window.currentTasks && Array.isArray(window.currentTasks)) {
            task = window.currentTasks.find(t => String(t.id) === String(taskId));
            console.log('🔍 Поиск в currentTasks:', task ? 'найдена' : 'не найдена');
        }

        if (task) {
            displayTaskDetails(task);
        } else {
            // Если не найдена в кеше, загружаем с сервера
            fetchTaskFromServer(taskId);
        }
    }

    // Загрузка задачи с сервера
    function fetchTaskFromServer(taskId) {
        console.log('🌐 Загрузка задачи с сервера:', taskId);

        const modal = document.getElementById('taskDetailModal');
        const content = modal.querySelector('.task-detail-content');

        content.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                <div style="width: 40px; height: 40px; border: 3px solid rgba(255, 255, 255, 0.1); border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
                <h3>Загрузка задачи...</h3>
            </div>
        `;

        // Эмуляция загрузки (заменить на реальный API вызов)
        setTimeout(() => {
            content.innerHTML = `
                <div style="text-align: center; padding: 40px; color: red;">
                    <h3>Задача не найдена</h3>
                    <p>ID: ${taskId}</p>
                </div>
            `;
        }, 1000);
    }

    // Отображение деталей задачи
    function displayTaskDetails(task) {
        console.log('📄 Отображение деталей задачи:', task);
        currentTaskDetails = task;

        // Заполняем данные
        const setElementText = (id, text) => {
            const element = document.getElementById(id);
            if (element) element.textContent = text || 'Не указано';
        };

        setElementText('detailTaskTitle', task.title);
        setElementText('detailTaskDescription', task.description || 'Описание отсутствует');
        setElementText('detailTaskEmployee', task.employeeName || task.employee || 'Не назначен');
        setElementText('detailTaskCreator', task.creatorName || task.creator || 'Неизвестно');
        setElementText('detailTaskDeadline', formatTaskDate(task.deadline));
        setElementText('detailTaskCreatedAt', formatTaskDate(task.createdAt || task.created_at));

        // Устанавливаем статус
        const statusElement = document.getElementById('detailTaskStatus');
        if (statusElement) {
            statusElement.textContent = getStatusText(task.status);
            statusElement.style.cssText = getStatusStyles(task.status);
        }

        // Устанавливаем приоритет
        const priorityElement = document.getElementById('detailTaskPriority');
        if (priorityElement) {
            priorityElement.textContent = getPriorityText(task.priority);
            priorityElement.style.cssText = getPriorityStyles(task.priority);
        }

        // Показываем кнопки действий
        updateActionButtons(task);
    }

    // Обновление кнопок действий
    function updateActionButtons(task) {
        const btnStart = document.getElementById('btnStartTask');
        const btnComplete = document.getElementById('btnCompleteTask');

        // Скрываем все кнопки
        if (btnStart) btnStart.style.display = 'none';
        if (btnComplete) btnComplete.style.display = 'none';

        // Показываем нужные кнопки
        if (task.status === 'Новая' || task.status === 'new') {
            if (btnStart) btnStart.style.display = 'flex';
        } else if (task.status === 'В работе' || task.status === 'in-progress') {
            if (btnComplete) btnComplete.style.display = 'flex';
        }
    }

    // Форматирование даты
    function formatTaskDate(dateString) {
        if (!dateString) return 'Не указано';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        } catch (e) {
            return 'Неверная дата';
        }
    }

    // Получение текста статуса
    function getStatusText(status) {
        const statuses = {
            'new': '🔵 Новая',
            'in-progress': '🟡 В работе',
            'completed': '🟢 Выполнена',
            'Новая': '🔵 Новая',
            'В работе': '🟡 В работе',
            'Выполнена': '🟢 Выполнена'
        };
        return statuses[status] || '🔵 Новая';
    }

    // Получение стилей статуса
    function getStatusStyles(status) {
        const styles = {
            'new': 'background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500;',
            'in-progress': 'background: rgba(251, 191, 36, 0.2); color: #fbbf24; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500;',
            'completed': 'background: rgba(34, 197, 94, 0.2); color: #4ade80; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500;',
            'Новая': 'background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500;',
            'В работе': 'background: rgba(251, 191, 36, 0.2); color: #fbbf24; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500;',
            'Выполнена': 'background: rgba(34, 197, 94, 0.2); color: #4ade80; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500;'
        };
        return styles[status] || styles['new'];
    }

    // Получение текста приоритета
    function getPriorityText(priority) {
        const priorities = {
            'high': '🔴 Высокий',
            'medium': '🟡 Средний',
            'low': '🟢 Низкий',
            'Высокий': '🔴 Высокий',
            'Средний': '🟡 Средний',
            'Низкий': '🟢 Низкий'
        };
        return priorities[priority] || '🟡 Средний';
    }

    // Получение стилей приоритета
    function getPriorityStyles(priority) {
        const styles = {
            'high': 'background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500;',
            'medium': 'background: rgba(251, 191, 36, 0.2); color: #fbbf24; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500;',
            'low': 'background: rgba(34, 197, 94, 0.2); color: #4ade80; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500;',
            'Высокий': 'background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500;',
            'Средний': 'background: rgba(251, 191, 36, 0.2); color: #fbbf24; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500;',
            'Низкий': 'background: rgba(34, 197, 94, 0.2); color: #4ade80; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500;'
        };
        return styles[priority] || styles['medium'];
    }

    // Принудительная регистрация функций (только один раз)
    function forceRegisterFunctions() {
        if (!window._taskModalFunctionsRegistered) {
            window.showTaskDetails = showTaskDetails;
            window.closeTaskDetailModal = closeTaskDetailModal;
            window.createTaskDetailModal = createTaskDetailModal;
            window._taskModalFunctionsRegistered = true;

            console.log('🔧 Функции зарегистрированы:', {
                showTaskDetails: typeof window.showTaskDetails,
                closeTaskDetailModal: typeof window.closeTaskDetailModal
            });
        }
    }

    // Немедленная регистрация
    forceRegisterFunctions();

    // Убираем периодическую перерегистрацию - она не нужна

    // Регистрация при загрузке DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', forceRegisterFunctions);
    } else {
        setTimeout(forceRegisterFunctions, 100);
    }

    console.log('✅ task-modal-final.js инициализирован');

})();