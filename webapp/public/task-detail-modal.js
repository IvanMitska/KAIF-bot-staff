// Модальное окно для просмотра деталей задачи
console.log('📋 Загружен task-detail-modal.js');
console.log('🔍 Проверка window.showTaskDetails:', typeof window.showTaskDetails);

// Глобальная переменная для текущей задачи
let currentTaskDetails = null;

// Функция для открытия модального окна с деталями задачи
window.showTaskDetails = function(taskId) {
    // Преобразуем taskId в число для надежности
    taskId = parseInt(taskId);

    console.log('🔍 Открытие деталей задачи:', taskId, typeof taskId);

    // Сначала показываем модальное окно с загрузкой
    let modal = document.getElementById('taskDetailModal');

    if (!modal) {
        // Создаем модальное окно если его нет
        console.log('📦 Создаем новое модальное окно');
        createTaskDetailModal();
        modal = document.getElementById('taskDetailModal');

        if (!modal) {
            console.error('❌ Не удалось создать модальное окно!');
            return;
        }
    }

    console.log('✅ Модальное окно найдено/создано');

    // Показываем окно с индикатором загрузки
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';

    console.log('🔍 Ищем задачу в кеше, всего задач:', window.currentTasks?.length);

    // Находим задачу в currentTasks если она есть
    if (window.currentTasks && Array.isArray(window.currentTasks)) {
        const task = window.currentTasks.find(t => parseInt(t.id) === taskId);
        if (task) {
            console.log('✅ Задача найдена в кеше:', task);
            currentTaskDetails = task;
            displayTaskDetails(task);
            return;
        }
    }

    console.log('⚠️ Задача не найдена в кеше, загружаем с сервера...');

    // Если задачи нет в кеше, получаем с сервера
    const endpoint = typeof getApiUrl === 'function' ? getApiUrl(`/api/tasks/${taskId}`) : `/api/tasks/${taskId}`;

    fetch(endpoint)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load task');
            }
            return response.json();
        })
        .then(task => {
            console.log('✅ Задача загружена с сервера:', task);
            currentTaskDetails = task;
            displayTaskDetails(task);
        })
        .catch(error => {
            console.error('❌ Ошибка загрузки задачи:', error);
            // Показываем сообщение об ошибке в модальном окне
            const modalContent = modal.querySelector('.task-detail-content');
            if (modalContent) {
                modalContent.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        <i data-lucide="alert-circle" style="width: 48px; height: 48px; margin-bottom: 16px; color: red;"></i>
                        <h3>Не удалось загрузить задачу</h3>
                        <p style="margin-top: 10px;">Попробуйте обновить страницу</p>
                    </div>
                `;
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }
        });
};

// Функция для отображения деталей задачи
function displayTaskDetails(task) {
    // Проверяем наличие модального окна
    let modal = document.getElementById('taskDetailModal');

    if (!modal) {
        // Создаем модальное окно если его нет
        createTaskDetailModal();
        modal = document.getElementById('taskDetailModal');
    }

    // Безопасное получение элементов
    const safeSetText = (id, text) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        }
    };

    // Заполняем данные
    safeSetText('detailTaskTitle', task.title || 'Без названия');
    safeSetText('detailTaskDescription', task.description || 'Описание отсутствует');
    safeSetText('detailTaskEmployee', task.employeeName || task.employee || 'Не назначен');
    safeSetText('detailTaskCreator', task.creatorName || task.creator || 'Неизвестно');
    safeSetText('detailTaskDeadline', formatDate(task.deadline));
    safeSetText('detailTaskCreatedAt', formatDate(task.createdAt || task.created_at));

    // Устанавливаем приоритет
    const priorityElement = document.getElementById('detailTaskPriority');
    if (priorityElement) {
        priorityElement.textContent = getPriorityText(task.priority);
        priorityElement.className = `task-priority priority-${(task.priority || 'Средний').toLowerCase()}`;
    }

    // Устанавливаем статус
    const statusElement = document.getElementById('detailTaskStatus');
    if (statusElement) {
        statusElement.textContent = getStatusText(task.status);
        statusElement.className = `task-status status-${(task.status || 'Новая').toLowerCase().replace(' ', '-')}`;
    }

    // Показываем кнопки действий в зависимости от прав
    updateActionButtons(task);

    // Показываем модальное окно
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    // Добавляем анимацию появления
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

// Создание модального окна
function createTaskDetailModal() {
    const modalHTML = `
        <div id="taskDetailModal" class="modal-overlay hidden">
            <div class="modal-container task-detail-container">
                <div class="modal-header">
                    <div class="modal-title-section">
                        <div class="modal-icon">
                            <i data-lucide="clipboard-list"></i>
                        </div>
                        <h2 class="modal-title">Детали задачи</h2>
                    </div>
                    <button class="modal-close" onclick="closeTaskDetailModal()">
                        <i data-lucide="x"></i>
                    </button>
                </div>

                <div class="task-detail-content">
                    <!-- Заголовок и статус -->
                    <div class="task-detail-header">
                        <h3 id="detailTaskTitle" class="task-title"></h3>
                        <div class="task-badges">
                            <span id="detailTaskStatus" class="task-status"></span>
                            <span id="detailTaskPriority" class="task-priority"></span>
                        </div>
                    </div>

                    <!-- Описание -->
                    <div class="task-detail-section">
                        <div class="section-label">
                            <i data-lucide="file-text"></i>
                            <span>Описание</span>
                        </div>
                        <div id="detailTaskDescription" class="task-description"></div>
                    </div>

                    <!-- Информация о задаче -->
                    <div class="task-detail-grid">
                        <div class="detail-item">
                            <div class="detail-label">
                                <i data-lucide="user"></i>
                                <span>Исполнитель</span>
                            </div>
                            <div id="detailTaskEmployee" class="detail-value"></div>
                        </div>

                        <div class="detail-item">
                            <div class="detail-label">
                                <i data-lucide="user-plus"></i>
                                <span>Поставил</span>
                            </div>
                            <div id="detailTaskCreator" class="detail-value"></div>
                        </div>

                        <div class="detail-item">
                            <div class="detail-label">
                                <i data-lucide="calendar"></i>
                                <span>Дедлайн</span>
                            </div>
                            <div id="detailTaskDeadline" class="detail-value"></div>
                        </div>

                        <div class="detail-item">
                            <div class="detail-label">
                                <i data-lucide="clock"></i>
                                <span>Создана</span>
                            </div>
                            <div id="detailTaskCreatedAt" class="detail-value"></div>
                        </div>
                    </div>

                    <!-- Кнопки действий -->
                    <div class="task-detail-actions">
                        <button id="btnStartTask" class="action-btn btn-primary" onclick="startTask()">
                            <i data-lucide="play"></i>
                            <span>Начать выполнение</span>
                        </button>

                        <button id="btnCompleteTask" class="action-btn btn-success" onclick="completeTask()">
                            <i data-lucide="check-circle"></i>
                            <span>Завершить</span>
                        </button>

                        <button id="btnEditTask" class="action-btn btn-secondary" onclick="editTaskFromDetail()">
                            <i data-lucide="edit"></i>
                            <span>Редактировать</span>
                        </button>

                        <button id="btnDeleteTask" class="action-btn btn-danger" onclick="deleteTaskFromDetail()">
                            <i data-lucide="trash"></i>
                            <span>Удалить</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Добавляем модальное окно в DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Инициализируем иконки
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Добавляем обработчик клика по фону
    const modal = document.getElementById('taskDetailModal');
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeTaskDetailModal();
        }
    });
}

// Закрытие модального окна
window.closeTaskDetailModal = function() {
    const modal = document.getElementById('taskDetailModal');
    if (!modal) return;

    modal.classList.remove('show');

    setTimeout(() => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        currentTaskDetails = null;
    }, 300);
};

// Обновление кнопок действий
function updateActionButtons(task) {
    const btnStart = document.getElementById('btnStartTask');
    const btnComplete = document.getElementById('btnCompleteTask');
    const btnEdit = document.getElementById('btnEditTask');
    const btnDelete = document.getElementById('btnDeleteTask');

    // Скрываем все кнопки по умолчанию
    [btnStart, btnComplete, btnEdit, btnDelete].forEach(btn => {
        if (btn) btn.style.display = 'none';
    });

    // Показываем кнопки в зависимости от статуса и прав
    if (task.status === 'Новая' || task.status === 'new') {
        if (btnStart) btnStart.style.display = 'flex';
    } else if (task.status === 'В работе' || task.status === 'in-progress') {
        if (btnComplete) btnComplete.style.display = 'flex';
    }

    // Проверяем права на редактирование (создатель или админ)
    const currentUser = window.currentUser || {};
    if (task.creatorId === currentUser.id || currentUser.isManager) {
        if (btnEdit) btnEdit.style.display = 'flex';
        if (btnDelete) btnDelete.style.display = 'flex';
    }
}

// Начать выполнение задачи
window.startTask = function() {
    if (!currentTaskDetails) return;

    updateTaskStatus(currentTaskDetails.id, 'В работе');
};

// Завершить задачу
window.completeTask = function() {
    if (!currentTaskDetails) return;

    updateTaskStatus(currentTaskDetails.id, 'Выполнена');
};

// Обновить статус задачи
function updateTaskStatus(taskId, newStatus) {
    fetch(`/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            showNotification(`Статус изменен на "${newStatus}"`, 'success');
            closeTaskDetailModal();
            // Обновляем список задач
            if (typeof loadTasks === 'function') {
                loadTasks();
            }
        } else {
            showNotification('Не удалось изменить статус', 'error');
        }
    })
    .catch(error => {
        console.error('❌ Ошибка обновления статуса:', error);
        showNotification('Ошибка при обновлении статуса', 'error');
    });
}

// Редактировать задачу
window.editTaskFromDetail = function() {
    if (!currentTaskDetails) return;

    closeTaskDetailModal();

    // Открываем модальное окно редактирования
    if (typeof showEditTaskModal === 'function') {
        showEditTaskModal(currentTaskDetails);
    }
};

// Удалить задачу
window.deleteTaskFromDetail = function() {
    if (!currentTaskDetails) return;

    if (!confirm('Вы уверены, что хотите удалить эту задачу?')) {
        return;
    }

    fetch(`/tasks/${currentTaskDetails.id}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            showNotification('Задача удалена', 'success');
            closeTaskDetailModal();
            // Обновляем список задач
            if (typeof loadTasks === 'function') {
                loadTasks();
            }
        } else {
            showNotification('Не удалось удалить задачу', 'error');
        }
    })
    .catch(error => {
        console.error('❌ Ошибка удаления задачи:', error);
        showNotification('Ошибка при удалении задачи', 'error');
    });
};

// Вспомогательные функции
function formatDate(dateString) {
    if (!dateString) return 'Не указано';

    const date = new Date(dateString);
    const options = {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    };

    return date.toLocaleDateString('ru-RU', options);
}

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

// Интеграция с существующими задачами
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 task-detail-modal.js: DOMContentLoaded');

    // Создаем модальное окно сразу при загрузке
    if (!document.getElementById('taskDetailModal')) {
        console.log('📦 Создаем модальное окно при загрузке');
        createTaskDetailModal();
    }

    // Добавляем обработчики на карточки задач
    setTimeout(() => {
        addTaskClickHandlers();
    }, 1000);

    // Финальная проверка
    setTimeout(() => {
        console.log('🔍 Финальная проверка window.showTaskDetails:', typeof window.showTaskDetails);
        if (typeof window.showTaskDetails !== 'function') {
            console.error('❌❌❌ КРИТИЧЕСКАЯ ОШИБКА: window.showTaskDetails не является функцией!');
        } else {
            console.log('✅✅✅ window.showTaskDetails доступна и готова к использованию');
        }
    }, 2000);
});

// Добавление обработчиков клика на задачи
function addTaskClickHandlers() {
    // Находим все карточки задач
    const taskCards = document.querySelectorAll('.task-card');

    taskCards.forEach(card => {
        // Проверяем, не добавлен ли уже обработчик
        if (!card.hasAttribute('data-clickable')) {
            card.setAttribute('data-clickable', 'true');
            card.style.cursor = 'pointer';

            card.addEventListener('click', function(e) {
                // Проверяем, что клик не по кнопке внутри карточки
                if (!e.target.closest('button')) {
                    const taskId = this.dataset.taskId;
                    if (taskId) {
                        showTaskDetails(taskId);
                    }
                }
            });
        }
    });
}

// Переопределяем функцию отрисовки задач для добавления data-task-id
const originalRenderTask = window.renderTask;
if (originalRenderTask) {
    window.renderTask = function(task) {
        const result = originalRenderTask.call(this, task);

        // Добавляем обработчики после отрисовки
        setTimeout(addTaskClickHandlers, 100);

        return result;
    };
}

console.log('✅ Модальное окно деталей задачи инициализировано');

// Принудительная регистрация функции каждые 500мс для защиты от перезаписи
setInterval(function() {
    if (typeof window.showTaskDetails !== 'function') {
        console.warn('⚠️ showTaskDetails была перезаписана, восстанавливаем...');
        registerTaskDetailFunctions();
    }
}, 500);

// Также регистрируем при загрузке DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerTaskDetailFunctions);
} else {
    registerTaskDetailFunctions();
}

// Функция для регистрации всех функций модального окна
function registerTaskDetailFunctions() {
    console.log('🔄 Регистрация функций модального окна задач...');

    // Проверяем, что функции доступны
    if (typeof window.showTaskDetails === 'function') {
        console.log('✅ showTaskDetails уже зарегистрирована');
    } else {
        console.log('❌ showTaskDetails не найдена, восстанавливаем...');
    }
}