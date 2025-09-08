// ===== ИСПРАВЛЕНИЕ ВСЕХ ПРОБЛЕМ =====

// Ждем загрузки основного app.js
document.addEventListener('DOMContentLoaded', function() {
    
    // Проверяем Telegram WebApp
    const tg = window.Telegram?.WebApp;
    if (!tg) {
        console.error('❌ Telegram WebApp not available');
        return;
    }
    
    // Исправляем загрузку профиля
    const originalLoadProfile = window.loadProfile;
    window.loadProfile = async function() {
        try {
            const response = await fetch(`${API_URL}/api/profile`, {
                headers: {
                    'X-Telegram-Init-Data': tg.initData || ''
                }
            });
            
            if (response.ok) {
                const userData = await response.json();
                
                // Обновляем UI
                document.getElementById('profileName').textContent = userData.name || 'Не указано';
                document.getElementById('profilePosition').textContent = userData.position || 'Не указано';
                document.getElementById('profilePhone').textContent = userData.phone || 'Не указано';
                
                // Сохраняем глобально
                window.currentUser = userData;
                
                // Проверяем админ права
                if (userData.isAdmin) {
                    document.getElementById('adminSection').style.display = 'block';
                }
            } else {
                console.error('Failed to load profile:', response.status);
                // Показываем форму регистрации если нужно
                if (response.status === 404) {
                    document.getElementById('profileInfo').style.display = 'none';
                    document.getElementById('registrationForm').style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    };
    
    // Исправляем загрузку задач
    const originalLoadTasks = window.loadTasks;
    window.loadTasks = async function() {
        const tasksList = document.getElementById('tasksList');
        if (!tasksList) return;
        
        tasksList.innerHTML = '<div class="loading">Загрузка задач...</div>';
        
        try {
            // Используем правильный endpoint и добавляем test=1 если нет initData
            let url = `${API_URL}/api/tasks/my`;
            if (!tg.initData) {
                url += '?test=1';
            }
            
            const response = await fetch(url, {
                headers: tg.initData ? {
                    'X-Telegram-Init-Data': tg.initData
                } : {}
            });
            
            if (response.ok) {
                const tasks = await response.json();
                
                // Сохраняем задачи глобально
                window.currentTasks = tasks;
                
                // Обновляем счетчик
                const activeTasks = tasks.filter(t => t.status !== 'Выполнена');
                const badge = document.getElementById('tasksBadge');
                if (badge) {
                    if (activeTasks.length > 0) {
                        badge.textContent = activeTasks.length;
                        badge.style.display = 'block';
                    } else {
                        badge.style.display = 'none';
                    }
                }
                
                // Отображаем задачи
                if (tasks.length === 0) {
                    tasksList.innerHTML = `
                        <div class="empty-state">
                            <i data-lucide="check-circle"></i>
                            <p>У вас нет активных задач</p>
                        </div>
                    `;
                } else {
                    displayTasks(tasks);
                }
                
                // Обновляем иконки
                if (window.lucide) {
                    lucide.createIcons();
                }
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
            tasksList.innerHTML = `
                <div class="error-state">
                    <p>Не удалось загрузить задачи</p>
                    <button onclick="loadTasks()" class="btn-retry">Попробовать снова</button>
                </div>
            `;
        }
    };
    
    // Функция отображения задач
    function displayTasks(tasks) {
        const tasksList = document.getElementById('tasksList');
        if (!tasksList) return;
        
        const tasksByStatus = {
            pending: tasks.filter(t => t.status === 'Новая'),
            in_progress: tasks.filter(t => t.status === 'В работе'),
            completed: tasks.filter(t => t.status === 'Выполнена')
        };
        
        let html = '';
        
        // Активные задачи
        if (tasksByStatus.pending.length > 0 || tasksByStatus.in_progress.length > 0) {
            html += '<div class="tasks-section">';
            html += '<h3 class="tasks-section-title">Активные задачи</h3>';
            
            [...tasksByStatus.in_progress, ...tasksByStatus.pending].forEach(task => {
                const statusClass = task.status === 'В работе' ? 'in-progress' : 'pending';
                const statusText = task.status === 'В работе' ? 'В работе' : 'Новая';
                
                html += `
                    <div class="task-card glass-card ${statusClass}" onclick="showTaskDetails('${task.id}')">
                        <div class="task-header">
                            <h3 class="task-title">${task.title}</h3>
                            <span class="task-status ${statusClass}">${statusText}</span>
                        </div>
                        <p class="task-description">${task.description || ''}</p>
                        <div class="task-meta">
                            <span class="task-deadline">
                                <i data-lucide="calendar"></i>
                                ${formatDate(task.deadline)}
                            </span>
                            <span class="task-priority priority-${task.priority || 'medium'}">
                                ${getPriorityText(task.priority)}
                            </span>
                        </div>
                        <div class="task-actions">
                            ${task.status === 'Новая' ? 
                                `<button onclick="event.stopPropagation(); updateTaskStatus('${task.id}', 'В работе')" class="btn-action">
                                    <i data-lucide="play"></i> Начать
                                </button>` : ''
                            }
                            ${task.status === 'В работе' ? 
                                `<button onclick="event.stopPropagation(); updateTaskStatus('${task.id}', 'Выполнена')" class="btn-action btn-complete">
                                    <i data-lucide="check"></i> Завершить
                                </button>` : ''
                            }
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        // Выполненные задачи
        if (tasksByStatus.completed.length > 0) {
            html += '<div class="tasks-section">';
            html += '<h3 class="tasks-section-title">Выполненные задачи</h3>';
            
            tasksByStatus.completed.forEach(task => {
                html += `
                    <div class="task-card glass-card completed" onclick="showTaskDetails('${task.id}')">
                        <div class="task-header">
                            <h3 class="task-title">${task.title}</h3>
                            <span class="task-status completed">Выполнено</span>
                        </div>
                        <p class="task-description">${task.description || ''}</p>
                        <div class="task-meta">
                            <span class="task-completed">
                                <i data-lucide="check-circle"></i>
                                Выполнено ${formatDate(task.completedAt)}
                            </span>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        tasksList.innerHTML = html;
        
        // Обновляем иконки
        if (window.lucide) {
            lucide.createIcons();
        }
    }
    
    // Вспомогательные функции
    function formatDate(dateString) {
        if (!dateString) return 'Без срока';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
    }
    
    function getPriorityText(priority) {
        const priorities = {
            low: 'Низкий',
            medium: 'Средний',
            high: 'Высокий',
            urgent: 'Срочно'
        };
        return priorities[priority] || 'Средний';
    }
    
    // Обновление статуса задачи
    window.updateTaskStatus = async function(taskId, newStatus) {
        try {
            const response = await fetch(`${API_URL}/api/tasks/${taskId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Init-Data': tg.initData || ''
                },
                body: JSON.stringify({ status: newStatus })
            });
            
            if (response.ok) {
                // Перезагружаем задачи
                loadTasks();
                
                // Показываем уведомление
                if (tg.showAlert) {
                    tg.showAlert('Статус задачи обновлен');
                }
            } else {
                throw new Error('Failed to update task status');
            }
        } catch (error) {
            console.error('Error updating task:', error);
            if (tg.showAlert) {
                tg.showAlert('Не удалось обновить статус задачи');
            }
        }
    };
    
    // Показ деталей задачи
    window.showTaskDetails = function(taskId) {
        const task = currentTasks.find(t => t.id === taskId);
        if (!task) return;
        
        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.id = 'taskModal';
        modal.className = 'task-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="closeTaskModal()"></div>
            <div class="modal-content glass-card">
                <div class="modal-header">
                    <h2 class="modal-title">${task.title}</h2>
                    <button class="modal-close" onclick="closeTaskModal()">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                
                <div class="modal-body">
                    <div class="task-detail-status">
                        <span class="task-status ${getStatusClass(task.status)}">${task.status}</span>
                        <span class="task-priority priority-${task.priority || 'medium'}">
                            ${getPriorityText(task.priority)}
                        </span>
                    </div>
                    
                    ${task.description ? `
                        <div class="task-detail-section">
                            <h3>Описание</h3>
                            <p>${task.description}</p>
                        </div>
                    ` : ''}
                    
                    <div class="task-detail-section">
                        <h3>Информация</h3>
                        <div class="task-detail-info">
                            <div class="info-item">
                                <i data-lucide="calendar"></i>
                                <span>Дедлайн: ${formatDate(task.deadline)}</span>
                            </div>
                            <div class="info-item">
                                <i data-lucide="user"></i>
                                <span>Создал: ${task.creatorName || 'Неизвестно'}</span>
                            </div>
                            <div class="info-item">
                                <i data-lucide="clock"></i>
                                <span>Создана: ${formatDate(task.createdDate)}</span>
                            </div>
                            ${task.completedDate ? `
                                <div class="info-item">
                                    <i data-lucide="check-circle"></i>
                                    <span>Выполнена: ${formatDate(task.completedDate)}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    ${task.status === 'Новая' ? `
                        <button class="btn-primary" onclick="updateTaskStatusFromModal('${task.id}', 'В работе')">
                            <i data-lucide="play"></i>
                            Начать выполнение
                        </button>
                    ` : ''}
                    ${task.status === 'В работе' ? `
                        <button class="btn-success" onclick="updateTaskStatusFromModal('${task.id}', 'Выполнена')">
                            <i data-lucide="check"></i>
                            Завершить задачу
                        </button>
                    ` : ''}
                    <button class="btn-secondary" onclick="closeTaskModal()">
                        Закрыть
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Обновляем иконки
        if (window.lucide) {
            lucide.createIcons();
        }
        
        // Анимация появления
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
    };
    
    // Закрытие модального окна
    window.closeTaskModal = function() {
        const modal = document.getElementById('taskModal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.remove();
            }, 300);
        }
    };
    
    // Обновление статуса из модального окна
    window.updateTaskStatusFromModal = async function(taskId, newStatus) {
        await updateTaskStatus(taskId, newStatus);
        closeTaskModal();
    };
    
    // Вспомогательная функция для определения класса статуса
    function getStatusClass(status) {
        switch(status) {
            case 'Новая': return 'pending';
            case 'В работе': return 'in-progress';
            case 'Выполнена': return 'completed';
            default: return '';
        }
    }
    
    // Исправляем загрузку сотрудников
    const originalLoadEmployees = window.loadEmployees;
    window.loadEmployees = async function() {
        const employeesList = document.getElementById('employeesList');
        
        if (!employeesList) {
            if (typeof createEmployeesPage === 'function') {
                createEmployeesPage();
            }
            return;
        }
        
        employeesList.innerHTML = '<div class="loading">Загрузка сотрудников...</div>';
        
        try {
            const response = await fetch(`${API_URL}/api/employees`, {
                headers: {
                    'X-Telegram-Init-Data': tg.initData || ''
                }
            });
            
            if (response.ok) {
                const employees = await response.json();
                
                if (employees.length === 0) {
                    employeesList.innerHTML = `
                        <div class="empty-state">
                            <i data-lucide="users"></i>
                            <p>Нет сотрудников</p>
                        </div>
                    `;
                } else {
                    let html = '<div class="employees-grid">';
                    employees.forEach(emp => {
                        const initials = emp.name ? 
                            emp.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'НН';
                        
                        html += `
                            <div class="employee-card glass-card" onclick="selectEmployee('${emp.telegramId}', '${emp.name}')">
                                <div class="employee-avatar">
                                    <span>${initials}</span>
                                </div>
                                <div class="employee-info">
                                    <h3>${emp.name}</h3>
                                    <p>${emp.position || 'Сотрудник'}</p>
                                    <span class="employee-status ${emp.isOnline ? 'online' : 'offline'}">
                                        ${emp.isOnline ? 'В сети' : 'Не в сети'}
                                    </span>
                                </div>
                            </div>
                        `;
                    });
                    html += '</div>';
                    employeesList.innerHTML = html;
                }
                
                // Обновляем иконки
                if (window.lucide) {
                    lucide.createIcons();
                }
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Error loading employees:', error);
            employeesList.innerHTML = `
                <div class="error-state">
                    <p>Не удалось загрузить список сотрудников</p>
                    <button onclick="loadEmployees()" class="btn-retry">Попробовать снова</button>
                </div>
            `;
        }
    };
    
    // Автоматически загружаем профиль при старте
    if (typeof loadProfile === 'function') {
        setTimeout(() => {
            loadProfile();
        }, 100);
    }
    
    // Автоматически загружаем задачи если на странице задач
    if (document.getElementById('tasks')?.classList.contains('active')) {
        setTimeout(() => {
            loadTasks();
        }, 200);
    }
    
});

// CSS для исправлений
const fixStyles = document.createElement('style');
fixStyles.textContent = `
    .loading {
        text-align: center;
        padding: 40px;
        color: rgba(255, 255, 255, 0.7);
    }
    
    .empty-state, .error-state {
        text-align: center;
        padding: 60px 20px;
        color: rgba(255, 255, 255, 0.7);
    }
    
    .empty-state i, .error-state i {
        font-size: 48px;
        margin-bottom: 20px;
        opacity: 0.5;
    }
    
    .btn-retry {
        margin-top: 20px;
        padding: 10px 24px;
        background: linear-gradient(135deg, #8b5cf6, #ec4899);
        color: white;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        font-weight: 600;
    }
    
    .btn-retry:hover {
        transform: scale(1.05);
    }
    
    .tasks-section {
        margin-bottom: 30px;
    }
    
    .tasks-section-title {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 16px;
        color: rgba(255, 255, 255, 0.9);
    }
    
    .task-card {
        margin-bottom: 16px;
        padding: 20px;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    
    .task-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(139, 92, 246, 0.3);
    }
    
    .task-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
    }
    
    .task-title {
        font-size: 16px;
        font-weight: 600;
        color: white;
        margin: 0;
    }
    
    .task-status {
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
    }
    
    .task-status.pending {
        background: rgba(251, 191, 36, 0.2);
        color: #fbbf24;
    }
    
    .task-status.in-progress {
        background: rgba(59, 130, 246, 0.2);
        color: #3b82f6;
    }
    
    .task-status.completed {
        background: rgba(16, 185, 129, 0.2);
        color: #10b981;
    }
    
    .task-description {
        color: rgba(255, 255, 255, 0.7);
        margin-bottom: 12px;
        font-size: 14px;
    }
    
    .task-meta {
        display: flex;
        gap: 16px;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.6);
        margin-bottom: 16px;
    }
    
    .task-meta span {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    
    .task-meta i {
        width: 14px;
        height: 14px;
    }
    
    .task-actions {
        display: flex;
        gap: 12px;
    }
    
    .btn-action {
        padding: 8px 16px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.3s ease;
    }
    
    .btn-action:hover {
        background: rgba(255, 255, 255, 0.2);
    }
    
    .btn-action.btn-complete {
        background: rgba(16, 185, 129, 0.2);
        border-color: rgba(16, 185, 129, 0.3);
        color: #10b981;
    }
    
    .btn-action.btn-complete:hover {
        background: rgba(16, 185, 129, 0.3);
    }
    
    .employee-status.online {
        color: #10b981;
    }
    
    .employee-status.offline {
        color: #6b7280;
    }
    
    /* Модальное окно для задачи */
    .task-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    
    .task-modal.active {
        opacity: 1;
    }
    
    .modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(5px);
    }
    
    .modal-content {
        position: relative;
        width: 90%;
        max-width: 500px;
        max-height: 85vh;
        overflow-y: auto;
        background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1));
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        padding: 0;
        transform: scale(0.9);
        transition: transform 0.3s ease;
    }
    
    .task-modal.active .modal-content {
        transform: scale(1);
    }
    
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 24px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .modal-title {
        font-size: 20px;
        font-weight: 700;
        color: white;
        margin: 0;
        padding-right: 20px;
    }
    
    .modal-close {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: white;
        transition: all 0.3s ease;
        flex-shrink: 0;
    }
    
    .modal-close:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.1);
    }
    
    .modal-body {
        padding: 24px;
    }
    
    .task-detail-status {
        display: flex;
        gap: 12px;
        margin-bottom: 24px;
    }
    
    .task-detail-section {
        margin-bottom: 24px;
    }
    
    .task-detail-section h3 {
        font-size: 14px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.7);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 12px;
    }
    
    .task-detail-section p {
        color: white;
        line-height: 1.6;
        margin: 0;
    }
    
    .task-detail-info {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    
    .info-item {
        display: flex;
        align-items: center;
        gap: 12px;
        color: rgba(255, 255, 255, 0.8);
        font-size: 14px;
    }
    
    .info-item i {
        width: 18px;
        height: 18px;
        color: rgba(255, 255, 255, 0.5);
    }
    
    .modal-footer {
        padding: 24px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
    }
    
    .modal-footer button {
        flex: 1;
        min-width: 120px;
        padding: 12px 20px;
        border: none;
        border-radius: 12px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }
    
    .modal-footer button i {
        width: 16px;
        height: 16px;
    }
    
    .btn-primary {
        background: linear-gradient(135deg, #3b82f6, #6366f1);
        color: white;
    }
    
    .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
    }
    
    .btn-success {
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
    }
    
    .btn-success:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
    }
    
    .btn-secondary {
        background: rgba(255, 255, 255, 0.1);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
    }
    
    .btn-secondary:hover {
        background: rgba(255, 255, 255, 0.2);
    }
`;
document.head.appendChild(fixStyles);