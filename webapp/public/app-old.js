// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Глобальные переменные
let currentUser = null;
let isManager = false;
const MANAGER_IDS = [385436658, 1734337242];

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Получаем данные пользователя из Telegram
        const initData = tg.initDataUnsafe;
        if (initData.user) {
            currentUser = initData.user;
            isManager = MANAGER_IDS.includes(currentUser.id);
            
            // Обновляем UI
            updateUserInterface();
            
            // Загружаем данные
            await loadDashboard();
            
            // Скрываем загрузчик
            hideLoader();
        } else {
            showError('Не удалось получить данные пользователя');
        }
    } catch (error) {
        console.error('Init error:', error);
        showError('Ошибка инициализации');
    }
});

// Обновление интерфейса пользователя
function updateUserInterface() {
    // Обновляем имя пользователя
    document.getElementById('userName').textContent = currentUser.first_name;
    
    // Показываем элементы для менеджеров
    if (isManager) {
        document.getElementById('createTaskBtn').style.display = 'block';
        document.getElementById('employeesBtn').style.display = 'block';
    }
    
    // Настраиваем тему
    applyTheme();
}

// Применение темы Telegram
function applyTheme() {
    const root = document.documentElement;
    const theme = tg.themeParams;
    
    root.style.setProperty('--tg-theme-bg-color', theme.bg_color || '#ffffff');
    root.style.setProperty('--tg-theme-text-color', theme.text_color || '#000000');
    root.style.setProperty('--tg-theme-hint-color', theme.hint_color || '#999999');
    root.style.setProperty('--tg-theme-link-color', theme.link_color || '#2481cc');
    root.style.setProperty('--tg-theme-button-color', theme.button_color || '#2481cc');
    root.style.setProperty('--tg-theme-button-text-color', theme.button_text_color || '#ffffff');
    root.style.setProperty('--tg-theme-secondary-bg-color', theme.secondary_bg_color || '#f1f1f1');
}

// Навигация
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const section = btn.dataset.section;
        showSection(section);
    });
});

function showSection(sectionId) {
    // Скрываем все секции
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    // Показываем выбранную секцию
    document.getElementById(sectionId).classList.add('active');
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
    
    // Загружаем данные для секции
    loadSectionData(sectionId);
}

// Загрузка данных для секций
async function loadSectionData(section) {
    showLoader();
    
    try {
        switch(section) {
            case 'dashboard':
                await loadDashboard();
                break;
            case 'reports':
                await loadReports();
                break;
            case 'tasks':
                await loadTasks();
                break;
            case 'stats':
                await loadStats();
                break;
            case 'profile':
                await loadProfile();
                break;
        }
    } catch (error) {
        console.error(`Error loading ${section}:`, error);
        showError(`Ошибка загрузки данных`);
    } finally {
        hideLoader();
    }
}

// Загрузка главной страницы
async function loadDashboard() {
    try {
        // Проверяем статус отчета за сегодня
        const todayStatus = await apiRequest('/api/reports/today-status');
        updateTodayStatus(todayStatus);
        
        // Получаем количество активных задач
        const tasks = await apiRequest('/api/tasks/my');
        const activeTasks = tasks.filter(t => t.status !== 'Выполнена').length;
        document.getElementById('activeTasksCount').textContent = activeTasks;
    } catch (error) {
        console.error('Dashboard error:', error);
    }
}

// Обработка формы отчета
document.getElementById('reportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const report = {
        whatDone: formData.get('whatDone'),
        problems: formData.get('problems') || 'Нет',
        goals: formData.get('goals')
    };
    
    try {
        showLoader();
        await apiRequest('/api/reports', 'POST', report);
        
        tg.showAlert('Отчет успешно отправлен!');
        e.target.reset();
        
        // Обновляем статус
        await loadDashboard();
        
        // Возвращаемся на главную
        showSection('dashboard');
    } catch (error) {
        showError('Ошибка при отправке отчета');
    } finally {
        hideLoader();
    }
});

// Загрузка отчетов
async function loadReports() {
    try {
        // Устанавливаем текущую дату
        const today = new Date().toLocaleDateString('ru-RU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        document.getElementById('reportDate').textContent = today;
        
        // Загружаем историю отчетов
        const reports = await apiRequest('/api/reports/history');
        displayReportHistory(reports);
    } catch (error) {
        console.error('Reports error:', error);
    }
}

// Отображение истории отчетов
function displayReportHistory(reports) {
    const container = document.getElementById('reportHistory');
    
    if (reports.length === 0) {
        container.innerHTML = '<p class="empty-message">У вас пока нет отчетов</p>';
        return;
    }
    
    container.innerHTML = reports.map(report => `
        <div class="history-item">
            <div class="history-date">
                ${new Date(report.date).toLocaleDateString('ru-RU')}
            </div>
            <div class="history-content">
                <div class="history-field">
                    <strong>Что сделал:</strong>
                    <p>${report.whatDone}</p>
                </div>
                <div class="history-field">
                    <strong>Проблемы:</strong>
                    <p>${report.problems}</p>
                </div>
                <div class="history-field">
                    <strong>Планы:</strong>
                    <p>${report.goals}</p>
                </div>
            </div>
        </div>
    `).join('');
}

// Загрузка задач
async function loadTasks() {
    try {
        const tasks = await apiRequest('/api/tasks/my');
        displayTasks(tasks);
        updateTaskFilters(tasks);
    } catch (error) {
        console.error('Tasks error:', error);
    }
}

// Отображение задач
function displayTasks(tasks) {
    const container = document.getElementById('tasksList');
    
    if (tasks.length === 0) {
        container.innerHTML = '<p class="empty-message">У вас пока нет задач</p>';
        return;
    }
    
    container.innerHTML = tasks.map(task => `
        <div class="task-card ${task.status.toLowerCase().replace(' ', '-')}" data-task-id="${task.id}">
            <div class="task-header">
                <h3>${task.title}</h3>
                <span class="task-priority priority-${task.priority || 'medium'}">
                    ${getPriorityIcon(task.priority)}
                </span>
            </div>
            <p class="task-description">${task.description || ''}</p>
            <div class="task-meta">
                ${task.deadline ? `<span>📅 ${formatDate(task.deadline)}</span>` : ''}
                <span class="task-status">${getStatusIcon(task.status)} ${task.status}</span>
            </div>
            <div class="task-actions">
                ${getTaskActions(task)}
            </div>
        </div>
    `).join('');
    
    // Добавляем обработчики для действий
    attachTaskActionHandlers();
}

// Получение иконки приоритета
function getPriorityIcon(priority) {
    const icons = {
        high: '🔴',
        medium: '🟡',
        low: '🟢'
    };
    return icons[priority] || '🟡';
}

// Получение иконки статуса
function getStatusIcon(status) {
    const icons = {
        'Новая': '🔴',
        'В работе': '🟡',
        'Выполнена': '🟢'
    };
    return icons[status] || '⚪';
}

// Форматирование даты
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
}

// Получение действий для задачи
function getTaskActions(task) {
    if (task.status === 'Новая') {
        return `<button class="task-btn" onclick="updateTaskStatus('${task.id}', 'В работе')">Взять в работу</button>`;
    } else if (task.status === 'В работе') {
        return `<button class="task-btn success" onclick="updateTaskStatus('${task.id}', 'Выполнена')">Выполнено</button>`;
    }
    return '';
}

// Обновление статуса задачи
async function updateTaskStatus(taskId, newStatus) {
    try {
        showLoader();
        await apiRequest(`/api/tasks/${taskId}/status`, 'PUT', { status: newStatus });
        
        tg.showAlert('Статус обновлен!');
        await loadTasks();
    } catch (error) {
        showError('Ошибка при обновлении статуса');
    } finally {
        hideLoader();
    }
}

// Фильтрация задач
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        filterTasks(filter);
        
        // Обновляем активную кнопку
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

function filterTasks(filter) {
    const tasks = document.querySelectorAll('.task-card');
    
    tasks.forEach(task => {
        if (filter === 'all') {
            task.style.display = 'block';
        } else {
            const status = task.querySelector('.task-status').textContent.trim();
            if (filter === 'new' && status.includes('Новая')) {
                task.style.display = 'block';
            } else if (filter === 'in_progress' && status.includes('В работе')) {
                task.style.display = 'block';
            } else if (filter === 'completed' && status.includes('Выполнена')) {
                task.style.display = 'block';
            } else {
                task.style.display = 'none';
            }
        }
    });
}

// Обновление счетчиков фильтров
function updateTaskFilters(tasks) {
    const counts = {
        all: tasks.length,
        new: tasks.filter(t => t.status === 'Новая').length,
        in_progress: tasks.filter(t => t.status === 'В работе').length,
        completed: tasks.filter(t => t.status === 'Выполнена').length
    };
    
    Object.entries(counts).forEach(([filter, count]) => {
        const btn = document.querySelector(`.filter-btn[data-filter="${filter}"] .count`);
        if (btn) btn.textContent = count;
    });
}

// Загрузка статистики
async function loadStats() {
    try {
        const stats = await apiRequest('/api/stats');
        displayStats(stats);
    } catch (error) {
        console.error('Stats error:', error);
    }
}

// Отображение статистики
function displayStats(stats) {
    document.getElementById('totalReports').textContent = stats.totalReports || 0;
    document.getElementById('completedTasks').textContent = stats.completedTasks || 0;
    document.getElementById('currentStreak').textContent = stats.currentStreak || 0;
    document.getElementById('completionRate').textContent = `${stats.completionRate || 0}%`;
    
    // Можно добавить график активности
    // drawActivityChart(stats.weeklyActivity);
}

// Загрузка профиля
async function loadProfile() {
    try {
        const profile = await apiRequest('/api/profile');
        displayProfile(profile);
    } catch (error) {
        console.error('Profile error:', error);
    }
}

// Отображение профиля
function displayProfile(profile) {
    document.getElementById('profileName').textContent = profile.name;
    document.getElementById('profilePosition').textContent = profile.position;
    document.getElementById('profileId').textContent = profile.telegramId;
}

// Модальное окно создания задачи
document.getElementById('createTaskBtn').addEventListener('click', async () => {
    await loadEmployeesForTask();
    document.getElementById('taskModal').classList.add('active');
});

function closeTaskModal() {
    document.getElementById('taskModal').classList.remove('active');
    document.getElementById('taskForm').reset();
}

// Загрузка сотрудников для выбора
async function loadEmployeesForTask() {
    try {
        const employees = await apiRequest('/api/users');
        const select = document.getElementById('taskEmployee');
        
        select.innerHTML = '<option value="">Выберите сотрудника</option>' +
            employees
                .filter(e => e.telegramId !== currentUser.id)
                .map(e => `<option value="${e.telegramId}">${e.name} - ${e.position}</option>`)
                .join('');
    } catch (error) {
        console.error('Load employees error:', error);
    }
}

// Создание задачи
document.getElementById('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const task = {
        assigneeId: parseInt(formData.get('taskEmployee')),
        title: formData.get('taskTitle'),
        description: formData.get('taskDescription'),
        deadline: formData.get('taskDeadline'),
        priority: formData.get('taskPriority')
    };
    
    try {
        showLoader();
        await apiRequest('/api/tasks', 'POST', task);
        
        tg.showAlert('Задача создана!');
        closeTaskModal();
        await loadTasks();
    } catch (error) {
        showError('Ошибка при создании задачи');
    } finally {
        hideLoader();
    }
});

// Обновление статуса на главной
function updateTodayStatus(status) {
    const statusContainer = document.getElementById('todayStatus');
    
    if (status.reportSent) {
        statusContainer.innerHTML = `
            <div class="status-item success">
                <span class="status-icon">✅</span>
                <span class="status-text">Отчет отправлен</span>
            </div>
        `;
    } else {
        statusContainer.innerHTML = `
            <div class="status-item warning">
                <span class="status-icon">⚠️</span>
                <span class="status-text">Отчет не отправлен</span>
            </div>
        `;
    }
}

// API запросы
async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': tg.initData
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    const response = await fetch(endpoint, options);
    
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    
    return response.json();
}

// Утилиты
function showLoader() {
    document.getElementById('loader').classList.add('active');
}

function hideLoader() {
    document.getElementById('loader').classList.remove('active');
}

function showError(message) {
    tg.showAlert(message);
}

function showHelp() {
    tg.showAlert(
        'KAIF Staff Bot\n\n' +
        '📝 Отчеты - ежедневные отчеты о работе\n' +
        '✅ Задачи - управление задачами\n' +
        '📊 Статистика - ваши показатели\n\n' +
        'По вопросам обращайтесь к администратору'
    );
}

async function showEmployees() {
    try {
        showLoader();
        const employees = await apiRequest('/api/users');
        
        const list = employees.map(e => 
            `${e.name} - ${e.position}`
        ).join('\n');
        
        tg.showAlert('👥 Сотрудники:\n\n' + list);
    } catch (error) {
        showError('Ошибка загрузки списка сотрудников');
    } finally {
        hideLoader();
    }
}

// Закрытие модального окна по клику вне его
document.getElementById('taskModal').addEventListener('click', (e) => {
    if (e.target.id === 'taskModal') {
        closeTaskModal();
    }
});