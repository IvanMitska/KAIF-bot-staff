// ===== ИСПРАВЛЕНИЕ ВСЕХ ПРОБЛЕМ =====

// Ждем загрузки основного app.js
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Applying critical fixes...');
    
    // Проверяем Telegram WebApp
    const tg = window.Telegram?.WebApp;
    if (!tg) {
        console.error('❌ Telegram WebApp not available');
        return;
    }
    
    // Исправляем загрузку профиля
    const originalLoadProfile = window.loadProfile;
    window.loadProfile = async function() {
        console.log('Loading profile with fix...');
        try {
            const response = await fetch(`${API_URL}/api/profile`, {
                headers: {
                    'X-Telegram-Init-Data': tg.initData || ''
                }
            });
            
            if (response.ok) {
                const userData = await response.json();
                console.log('Profile loaded:', userData);
                
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
        console.log('Loading tasks with fix...');
        const tasksList = document.getElementById('tasksList');
        if (!tasksList) return;
        
        tasksList.innerHTML = '<div class="loading">Загрузка задач...</div>';
        
        try {
            const response = await fetch(`${API_URL}/api/tasks`, {
                headers: {
                    'X-Telegram-Init-Data': tg.initData || ''
                }
            });
            
            if (response.ok) {
                const tasks = await response.json();
                console.log(`Loaded ${tasks.length} tasks`);
                
                // Сохраняем задачи глобально
                window.currentTasks = tasks;
                
                // Обновляем счетчик
                const activeTasks = tasks.filter(t => t.status !== 'completed');
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
            pending: tasks.filter(t => t.status === 'pending'),
            in_progress: tasks.filter(t => t.status === 'in_progress'),
            completed: tasks.filter(t => t.status === 'completed')
        };
        
        let html = '';
        
        // Активные задачи
        if (tasksByStatus.pending.length > 0 || tasksByStatus.in_progress.length > 0) {
            html += '<div class="tasks-section">';
            html += '<h3 class="tasks-section-title">Активные задачи</h3>';
            
            [...tasksByStatus.in_progress, ...tasksByStatus.pending].forEach(task => {
                const statusClass = task.status === 'in_progress' ? 'in-progress' : 'pending';
                const statusText = task.status === 'in_progress' ? 'В работе' : 'Ожидает';
                
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
                            ${task.status === 'pending' ? 
                                `<button onclick="event.stopPropagation(); updateTaskStatus('${task.id}', 'in_progress')" class="btn-action">
                                    <i data-lucide="play"></i> Начать
                                </button>` : ''
                            }
                            ${task.status === 'in_progress' ? 
                                `<button onclick="event.stopPropagation(); updateTaskStatus('${task.id}', 'completed')" class="btn-action btn-complete">
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
        console.log(`Updating task ${taskId} to ${newStatus}`);
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
        
        console.log('Showing task details:', task);
        
        // Здесь можно показать модальное окно с деталями задачи
        // Пока просто логируем
    };
    
    // Исправляем загрузку сотрудников
    const originalLoadEmployees = window.loadEmployees;
    window.loadEmployees = async function() {
        console.log('Loading employees with fix...');
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
                console.log(`Loaded ${employees.length} employees`);
                
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
            console.log('Auto-loading profile...');
            loadProfile();
        }, 100);
    }
    
    // Автоматически загружаем задачи если на странице задач
    if (document.getElementById('tasks')?.classList.contains('active')) {
        setTimeout(() => {
            console.log('Auto-loading tasks...');
            loadTasks();
        }, 200);
    }
    
    console.log('✅ All fixes applied successfully');
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
`;
document.head.appendChild(fixStyles);

console.log('Fix-all script loaded');