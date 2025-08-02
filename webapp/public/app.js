// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Установка темы
document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#0F0F14');
document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#FFFFFF');

// API URL
const API_URL = window.location.origin;

// Глобальные переменные
let currentUser = null;
let currentFilter = 'all';
let lastNewTasksCount = 0;

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    // Показываем имя пользователя из Telegram
    if (tg.initDataUnsafe.user) {
        document.getElementById('userName').textContent = tg.initDataUnsafe.user.first_name;
    }
    
    // Загружаем профиль
    await loadProfile();
    
    // Проверяем статус отчета
    await checkReportStatus();
    
    // Загружаем количество задач
    await loadTasksCount();
    
    // Устанавливаем текущую дату
    setCurrentDate();
    
    // Обработчик формы отчета
    document.getElementById('reportForm').addEventListener('submit', submitReport);
    
    // Автоматическое обновление задач каждые 30 секунд
    setInterval(async () => {
        await loadTasksCount();
        // Если открыта страница задач, обновляем список
        if (document.getElementById('tasks').classList.contains('active')) {
            loadTasks();
        }
    }, 30000);
});

// Навигация между страницами
function showPage(pageId) {
    // Скрываем все страницы
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Показываем выбранную страницу
    document.getElementById(pageId).classList.add('active');
    
    // Обновляем навигацию
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Находим соответствующую кнопку навигации
    const navButtons = document.querySelectorAll('.nav-btn');
    const pageIndex = ['home', 'report', 'tasks', 'stats', 'profile'].indexOf(pageId);
    if (pageIndex !== -1 && navButtons[pageIndex]) {
        navButtons[pageIndex].classList.add('active');
    }
    
    // Загружаем данные для страницы
    switch(pageId) {
        case 'tasks':
            loadTasks();
            break;
        case 'stats':
            loadStats();
            break;
        case 'profile':
            loadFullProfile();
            break;
    }
    
    // Вибрация при переключении
    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
}

// Загрузка профиля
async function loadProfile() {
    try {
        const response = await fetch(`${API_URL}/api/profile`, {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        
        if (response.ok) {
            currentUser = await response.json();
            
            if (currentUser && !currentUser.needsRegistration) {
                document.getElementById('userName').textContent = currentUser.name.split(' ')[0];
                
                // Проверяем, является ли пользователь менеджером
                const MANAGER_IDS = [385436658, 1734337242]; // Boris, Ivan
                if (MANAGER_IDS.includes(tg.initDataUnsafe.user?.id)) {
                    document.getElementById('managerSection')?.style.setProperty('display', 'block');
                    // Показываем кнопку создания задачи
                    const createTaskBtn = document.getElementById('createTaskBtn');
                    if (createTaskBtn) {
                        createTaskBtn.style.display = 'inline-flex';
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Проверка статуса отчета
async function checkReportStatus() {
    try {
        const response = await fetch(`${API_URL}/api/reports/today-status`, {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const statusItem = document.getElementById('reportStatusItem');
            
            if (data.reportSent) {
                statusItem.classList.remove('status-warning');
                statusItem.classList.add('status-success');
                statusItem.innerHTML = `
                    <span class="status-icon">✅</span>
                    <span class="status-text">Отчет отправлен</span>
                `;
            }
        }
    } catch (error) {
        console.error('Error checking report status:', error);
    }
}

// Загрузка количества задач
async function loadTasksCount() {
    try {
        const response = await fetch(`${API_URL}/api/tasks/my`, {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        
        if (response.ok) {
            const tasks = await response.json();
            const activeTasks = tasks.filter(t => t.status !== 'Выполнена').length;
            const newTasks = tasks.filter(t => t.status === 'Новая').length;
            
            document.getElementById('activeTasksCount').textContent = activeTasks;
            
            // Показываем бейдж с новыми задачами
            updateTaskBadge(newTasks);
            
            // Проверяем появились ли новые задачи
            if (newTasks > lastNewTasksCount) {
                // Вибрация и звук при новой задаче
                if (tg.HapticFeedback) {
                    tg.HapticFeedback.notificationOccurred('success');
                }
                
                // Показываем уведомление
                if (newTasks - lastNewTasksCount === 1) {
                    tg.showAlert('У вас новая задача! 📋');
                } else {
                    tg.showAlert(`У вас ${newTasks - lastNewTasksCount} новых задач! 📋`);
                }
            }
            
            lastNewTasksCount = newTasks;
        }
    } catch (error) {
        console.error('Error loading tasks count:', error);
    }
}

// Обновление бейджа с количеством новых задач
function updateTaskBadge(count) {
    // Обновляем бейдж на кнопке навигации
    const taskNavBtn = document.querySelector('.nav-btn[onclick*="tasks"]');
    if (taskNavBtn) {
        let badge = taskNavBtn.querySelector('.nav-badge');
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'nav-badge';
                taskNavBtn.appendChild(badge);
            }
            badge.textContent = count;
            badge.style.display = 'block';
        } else if (badge) {
            badge.style.display = 'none';
        }
    }
    
    // Обновляем бейдж на карточке задач
    const taskCard = document.querySelector('.action-card[onclick*="tasks"]');
    if (taskCard) {
        let badge = taskCard.querySelector('.card-badge');
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'card-badge';
                badge.style.cssText = 'position: absolute; top: 20px; right: 20px; background: var(--danger); color: white; border-radius: 12px; padding: 4px 8px; font-size: 12px; font-weight: 600;';
                taskCard.style.position = 'relative';
                taskCard.appendChild(badge);
            }
            badge.textContent = `${count} ${count === 1 ? 'новая' : 'новых'}`;
        } else if (badge) {
            badge.remove();
        }
    }
}

// Отправка отчета
async function submitReport(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const report = {
        whatDone: formData.get('whatDone'),
        problems: formData.get('problems') || 'Нет'
    };
    
    // Показываем индикатор загрузки
    const submitBtn = event.target.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Отправка...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_URL}/api/reports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': tg.initData
            },
            body: JSON.stringify(report)
        });
        
        if (response.ok) {
            // Успешная отправка
            if (tg.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('success');
            }
            
            tg.showAlert('Отчет успешно отправлен! ✅', () => {
                event.target.reset();
                showPage('home');
                checkReportStatus();
            });
        } else {
            throw new Error('Ошибка отправки');
        }
    } catch (error) {
        if (tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('error');
        }
        tg.showAlert('Ошибка при отправке отчета. Попробуйте еще раз.');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Загрузка задач
async function loadTasks() {
    const tasksList = document.getElementById('tasksList');
    tasksList.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p style="margin-top: 16px;">Загрузка задач...</p>
        </div>
    `;
    
    try {
        const response = await fetch(`${API_URL}/api/tasks/my`, {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        
        if (response.ok) {
            const tasks = await response.json();
            displayTasks(tasks);
            updateTaskCounts(tasks);
        }
    } catch (error) {
        tasksList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Ошибка загрузки задач</p>';
    }
}

// Отображение задач
function displayTasks(tasks) {
    const tasksList = document.getElementById('tasksList');
    
    // Фильтрация задач
    let filteredTasks = tasks;
    if (currentFilter !== 'all') {
        const statusMap = {
            'new': 'Новая',
            'in-progress': 'В работе',
            'completed': 'Выполнена'
        };
        filteredTasks = tasks.filter(task => task.status === statusMap[currentFilter]);
    }
    
    if (filteredTasks.length === 0) {
        tasksList.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">Нет задач</p>';
        return;
    }
    
    tasksList.innerHTML = filteredTasks.map(task => {
        const statusClass = task.status === 'Новая' ? 'new' : 
                          task.status === 'В работе' ? 'in-progress' : 'completed';
        
        return `
            <div class="task-item" onclick="toggleTask('${task.id}')">
                <div class="task-header">
                    <h3 class="task-title">${task.title}</h3>
                    <span class="task-status ${statusClass}">${task.status}</span>
                </div>
                ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
                <div class="task-meta">
                    <span>📅 ${formatDate(task.deadline)}</span>
                    <span>👤 ${task.createdBy || task.assignedBy || 'Система'}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Обновление счетчиков задач
function updateTaskCounts(tasks) {
    const counts = {
        all: tasks.length,
        new: tasks.filter(t => t.status === 'Новая').length,
        'in-progress': tasks.filter(t => t.status === 'В работе').length,
        completed: tasks.filter(t => t.status === 'Выполнена').length
    };
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        const filter = btn.getAttribute('onclick').match(/filterTasks\('(.+)'\)/)[1];
        const countSpan = btn.querySelector('.count');
        if (countSpan) {
            countSpan.textContent = counts[filter] || 0;
        }
    });
}

// Фильтрация задач
function filterTasks(filter) {
    currentFilter = filter;
    
    // Обновляем активную кнопку
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Перезагружаем задачи
    loadTasks();
    
    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
}

// Загрузка статистики
async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/api/stats`, {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        
        if (response.ok) {
            const stats = await response.json();
            
            document.getElementById('totalReports').textContent = stats.totalReports || 0;
            document.getElementById('completedTasks').textContent = stats.completedTasks || 0;
            document.getElementById('currentStreak').textContent = stats.currentStreak || 0;
            document.getElementById('completionRate').textContent = `${stats.completionRate || 0}%`;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Загрузка полного профиля
async function loadFullProfile() {
    if (currentUser) {
        document.getElementById('profileName').textContent = currentUser.name;
        document.getElementById('profilePosition').textContent = currentUser.position;
        document.getElementById('profileId').textContent = currentUser.telegramId;
    }
}

// Вспомогательные функции
function setCurrentDate() {
    const date = new Date();
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    const formattedDate = date.toLocaleDateString('ru-RU', options);
    document.getElementById('reportDate').textContent = formattedDate;
}

function formatDate(dateString) {
    if (!dateString) return 'Без срока';
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Сегодня';
    } else if (date.toDateString() === tomorrow.toDateString()) {
        return 'Завтра';
    } else {
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }
}

// Показ справки
function showHelp() {
    tg.showAlert(
        'KAIF App v1.0\n\n' +
        '📝 Отправляйте ежедневные отчеты\n' +
        '✅ Управляйте задачами\n' +
        '📊 Следите за статистикой\n\n' +
        'По вопросам обращайтесь к администратору'
    );
}

// Показ сотрудников (для менеджеров)
async function showEmployees() {
    showPage('employees');
    loadEmployees();
}

// Загрузка списка сотрудников
async function loadEmployees() {
    const employeesList = document.getElementById('employeesList');
    if (!employeesList) {
        // Создаем страницу сотрудников если её нет
        createEmployeesPage();
        return;
    }
    
    employeesList.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p style="margin-top: 16px;">Загрузка сотрудников...</p>
        </div>
    `;
    
    try {
        const response = await fetch(`${API_URL}/api/employees`, {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        
        if (response.ok) {
            const employees = await response.json();
            displayEmployees(employees);
        }
    } catch (error) {
        employeesList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Ошибка загрузки</p>';
    }
}

// Отображение сотрудников
function displayEmployees(employees) {
    const employeesList = document.getElementById('employeesList');
    
    if (employees.length === 0) {
        employeesList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Нет сотрудников</p>';
        return;
    }
    
    employeesList.innerHTML = employees.map(emp => `
        <div class="action-card" onclick="createTaskForEmployee('${emp.telegramId}', '${emp.name}')">
            <div style="display: flex; align-items: center; gap: 16px;">
                <div style="font-size: 40px;">👤</div>
                <div>
                    <h3 style="margin: 0; font-size: 18px;">${emp.name}</h3>
                    <p style="margin: 4px 0 0 0; color: var(--text-secondary);">${emp.position}</p>
                </div>
            </div>
        </div>
    `).join('');
}

// Создать задачу для сотрудника
function createTaskForEmployee(employeeId, employeeName) {
    showCreateTaskModal(employeeId, employeeName);
}

// Показать модальное окно создания задачи
function showCreateTaskModal(employeeId = null, employeeName = null) {
    const modal = document.getElementById('taskModal');
    if (!modal) {
        createTaskModal();
        return;
    }
    
    modal.style.display = 'flex';
    
    // Если передан сотрудник, выбираем его
    if (employeeId && employeeName) {
        const select = document.getElementById('taskEmployee');
        select.innerHTML = `<option value="${employeeId}" selected>${employeeName}</option>`;
        loadEmployeesForSelect(employeeId);
    } else {
        loadEmployeesForSelect();
    }
    
    // Устанавливаем минимальную дату - сегодня
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('taskDeadline').min = today;
}

// Загрузить сотрудников для выбора
async function loadEmployeesForSelect(selectedId = null) {
    try {
        const response = await fetch(`${API_URL}/api/employees`, {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        
        if (response.ok) {
            const employees = await response.json();
            const select = document.getElementById('taskEmployee');
            
            select.innerHTML = '<option value="">Выберите сотрудника</option>' +
                employees.map(emp => 
                    `<option value="${emp.telegramId}" ${emp.telegramId == selectedId ? 'selected' : ''}>${emp.name}</option>`
                ).join('');
        }
    } catch (error) {
        console.error('Error loading employees:', error);
    }
}

// Закрыть модальное окно
function closeTaskModal() {
    const modal = document.getElementById('taskModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('taskForm').reset();
    }
}

// Отправить задачу
async function submitTask(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const task = {
        assigneeId: parseInt(formData.get('employee')),
        title: formData.get('title'),
        description: formData.get('description') || '',
        deadline: formData.get('deadline'),
        priority: formData.get('priority')
    };
    
    const submitBtn = event.target.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Создание...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_URL}/api/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': tg.initData
            },
            body: JSON.stringify(task)
        });
        
        if (response.ok) {
            if (tg.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('success');
            }
            
            tg.showAlert('Задача успешно создана! ✅', () => {
                closeTaskModal();
                if (document.getElementById('tasks').classList.contains('active')) {
                    loadTasks();
                }
            });
        } else {
            throw new Error('Ошибка создания');
        }
    } catch (error) {
        if (tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('error');
        }
        tg.showAlert('Ошибка при создании задачи');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Переключение задачи
function toggleTask(taskId) {
    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
    // TODO: Реализовать изменение статуса задачи
}