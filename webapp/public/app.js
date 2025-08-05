// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Проверка initData
console.log('Telegram WebApp initialized:', {
    initData: tg.initData ? 'Present' : 'Missing',
    initDataLength: tg.initData?.length || 0,
    user: tg.initDataUnsafe?.user
});

// Установка темы
document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#0F0F14');
document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#FFFFFF');

// API URL
const API_URL = window.location.origin;

// Функция показа уведомлений
function showNotification(message, type = 'info') {
    console.log(`Notification [${type}]:`, message);
    if (tg.showAlert) {
        tg.showAlert(message);
    } else {
        alert(message);
    }
}

// Глобальные переменные
let currentUser = null;
let currentFilter = 'all';
let lastNewTasksCount = 0;
let currentTaskType = 'my'; // 'my' или 'created'
let currentTasks = []; // Хранение текущих задач

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
        // Проверяем, что приложение открыто через Telegram
        if (!tg.initData || tg.initData.length === 0) {
            console.error('No initData available. WebApp context:', {
                platform: tg.platform,
                version: tg.version,
                initDataUnsafe: tg.initDataUnsafe
            });
            
            // Показываем красивое сообщение об ошибке
            const errorHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; padding: 20px;">
                    <div style="background: var(--bg-card); border-radius: 20px; padding: 32px; text-align: center; max-width: 320px;">
                        <div style="font-size: 64px; margin-bottom: 24px;">🔒</div>
                        <h2 style="margin-bottom: 16px; color: var(--text-primary);">Требуется авторизация</h2>
                        <p style="color: var(--text-secondary); margin-bottom: 24px;">
                            Откройте приложение через Telegram бота @Report_KAIF_bot
                        </p>
                        <div style="background: var(--bg-secondary); border-radius: 12px; padding: 16px;">
                            <p style="color: var(--text-muted); font-size: 14px; margin: 0;">
                                Отправьте команду /start боту для доступа к приложению
                            </p>
                        </div>
                    </div>
                </div>
            `;
            document.body.innerHTML = errorHTML;
            return;
        }
        
        console.log('Loading profile with initData length:', tg.initData.length);
        
        const response = await fetch(`${API_URL}/api/profile`, {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        
        console.log('Profile response:', response.status);
        
        if (response.ok) {
            currentUser = await response.json();
            
            if (currentUser && !currentUser.needsRegistration) {
                document.getElementById('userName').textContent = currentUser.name.split(' ')[0];
                
                // Показываем кнопку создания задачи ВСЕМ пользователям
                const createTaskBtn = document.getElementById('createTaskBtn');
                if (createTaskBtn) {
                    createTaskBtn.style.display = 'inline-flex';
                }
                
                // Проверяем, является ли пользователь менеджером
                const MANAGER_IDS = [385436658, 1734337242]; // Boris, Ivan
                const isManager = MANAGER_IDS.includes(tg.initDataUnsafe.user?.id);
                
                if (isManager) {
                    document.getElementById('managerSection')?.style.setProperty('display', 'block');
                    // Показываем переключатель типа задач только менеджерам
                    const createdTasksBtn = document.getElementById('createdTasksBtn');
                    if (createdTasksBtn) {
                        createdTasksBtn.style.display = 'block';
                    }
                }
                
                // Сохраняем статус менеджера глобально
                window.isManager = isManager;
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
        if (!tg.initData) {
            console.error('No initData for tasks count');
            return;
        }
        
        const response = await fetch(`${API_URL}/api/tasks/my`, {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        
        console.log('Tasks count response:', response.status);
        
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

// Переключение типа задач
function switchTaskType(type) {
    currentTaskType = type;
    currentFilter = 'all';
    
    // Обновляем кнопки
    const myBtn = document.getElementById('myTasksBtn');
    const createdBtn = document.getElementById('createdTasksBtn');
    
    if (type === 'my') {
        myBtn.classList.add('active');
        myBtn.style.background = 'var(--bg-card)';
        myBtn.style.color = 'var(--text-primary)';
        createdBtn.classList.remove('active');
        createdBtn.style.background = 'transparent';
        createdBtn.style.color = 'var(--text-secondary)';
    } else {
        createdBtn.classList.add('active');
        createdBtn.style.background = 'var(--bg-card)';
        createdBtn.style.color = 'var(--text-primary)';
        myBtn.classList.remove('active');
        myBtn.style.background = 'transparent';
        myBtn.style.color = 'var(--text-secondary)';
    }
    
    // Сбрасываем фильтр
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector('.filter-btn[onclick*="all"]').classList.add('active');
    
    // Загружаем задачи
    loadTasks();
    
    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
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
        console.log('Loading tasks...');
        console.log('Task type:', currentTaskType);
        console.log('Init data available:', !!tg.initData);
        
        const endpoint = currentTaskType === 'my' ? '/api/tasks/my' : '/api/tasks/created';
        
        const response = await fetch(`${API_URL}${endpoint}`, {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
            const tasks = await response.json();
            console.log('Tasks loaded:', tasks.length);
            currentTasks = tasks; // Сохраняем задачи глобально
            displayTasks(tasks);
            updateTaskCounts(tasks);
        } else {
            const error = await response.text();
            console.error('Error response:', error);
            tasksList.innerHTML = `<p style="text-align: center; color: var(--text-muted);">Ошибка: ${response.status}</p>`;
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
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
            <div class="task-item" onclick="openTaskDetail('${task.id}')" style="cursor: pointer;">
                <div class="task-header">
                    <h3 class="task-title">${task.title}</h3>
                    <span class="task-status ${statusClass}">${task.status}</span>
                </div>
                ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
                <div class="task-meta">
                    <span>📅 ${formatDate(task.deadline)}</span>
                    <span>👤 ${currentTaskType === 'my' ? 
                        (task.creatorName === currentUser?.name ? 'Я' : (task.creatorName || 'Система')) : 
                        (task.assigneeName || 'Не назначен')}</span>
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

// Отладка задач
// Функции админ-панели
window.showAdminPanel = function() {
    const MANAGER_IDS = [385436658, 1734337242];
    
    if (!MANAGER_IDS.includes(currentUser?.telegramId)) {
        showNotification('У вас нет доступа к админ-панели', 'error');
        return;
    }
    
    showPage('adminPanel');
    // По умолчанию показываем dashboard
    switchAdminTab('dashboard');
}

// Переключение вкладок админ-панели
window.switchAdminTab = function(tab) {
    // Обновляем активную вкладку
    document.querySelectorAll('.admin-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    document.getElementById(`${tab}Tab`).classList.add('active');
    document.getElementById(`${tab}Content`).classList.add('active');
    
    // Загружаем контент в зависимости от вкладки
    if (tab === 'dashboard') {
        loadDashboard();
    } else if (tab === 'reports') {
        loadAdminPanel();
    }
}

// Загрузка dashboard
async function loadDashboard() {
    try {
        // Загружаем все необходимые данные параллельно
        const [employeesRes, todayReportsRes, tasksRes] = await Promise.all([
            fetch(`${API_URL}/api/employees`, {
                headers: { 'X-Telegram-Init-Data': tg.initData }
            }),
            fetch(`${API_URL}/api/admin/reports?startDate=${new Date().toISOString().split('T')[0]}&endDate=${new Date().toISOString().split('T')[0]}`, {
                headers: { 'X-Telegram-Init-Data': tg.initData }
            }),
            fetch(`${API_URL}/api/admin/dashboard/stats`, {
                headers: { 'X-Telegram-Init-Data': tg.initData }
            })
        ]);
        
        if (employeesRes.ok && todayReportsRes.ok && tasksRes.ok) {
            const employees = await employeesRes.json();
            const todayData = await todayReportsRes.json();
            const dashboardStats = await tasksRes.json();
            
            // Обновляем ключевые метрики
            document.getElementById('dashboardTodayReports').textContent = todayData.todayReports;
            document.getElementById('dashboardMissingReports').textContent = employees.length - todayData.todayReports;
            document.getElementById('dashboardActiveTasks').textContent = dashboardStats.activeTasks;
            document.getElementById('dashboardCompletedToday').textContent = dashboardStats.completedToday;
            
            // Загружаем дополнительные виджеты
            loadActivityChart(dashboardStats.weekActivity);
            loadTopEmployees(dashboardStats.topEmployees);
            loadTasksStatus(dashboardStats.tasksStatus);
            loadMissingReports(employees, todayData.reports);
        }
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showNotification('Ошибка загрузки dashboard', 'error');
    }
}

// График активности за неделю
function loadActivityChart(weekData) {
    const container = document.getElementById('activityChart');
    
    if (!weekData || weekData.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Нет данных</p>';
        return;
    }
    
    // Простая визуализация графика с помощью HTML/CSS
    let maxValue = Math.max(...weekData.map(d => d.count));
    if (maxValue === 0) maxValue = 1;
    
    let html = '<div style="display: flex; align-items: flex-end; justify-content: space-between; height: 160px; margin-bottom: 16px;">';
    
    weekData.forEach(day => {
        const height = (day.count / maxValue) * 140;
        const dayName = new Date(day.date).toLocaleDateString('ru-RU', { weekday: 'short' });
        
        html += `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                <div style="position: relative; width: 100%; max-width: 40px;">
                    <div style="background: var(--gradient-primary); height: ${height}px; border-radius: 8px 8px 0 0; transition: all 0.3s; cursor: pointer;"
                         onmouseover="this.style.transform='scaleY(1.05)'"
                         onmouseout="this.style.transform='scaleY(1)'">
                    </div>
                    <div style="position: absolute; top: -24px; left: 50%; transform: translateX(-50%); font-size: 12px; font-weight: 600; color: var(--text-primary);">
                        ${day.count}
                    </div>
                </div>
                <div style="font-size: 12px; color: var(--text-secondary);">${dayName}</div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Топ сотрудников
function loadTopEmployees(topEmployees) {
    const container = document.getElementById('topEmployees');
    
    if (!topEmployees || topEmployees.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Нет данных</p>';
        return;
    }
    
    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
    
    topEmployees.forEach((employee, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏆';
        
        html += `
            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-card); border-radius: 12px;">
                <span style="font-size: 24px;">${medal}</span>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: var(--text-primary);">${employee.name}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${employee.reportsCount} отчетов</div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Статус задач
function loadTasksStatus(tasksStatus) {
    const container = document.getElementById('tasksStatus');
    
    if (!tasksStatus) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Нет данных</p>';
        return;
    }
    
    const total = tasksStatus.new + tasksStatus.inProgress + tasksStatus.completed;
    
    let html = `
        <div style="margin-bottom: 20px;">
            <div style="display: flex; height: 20px; border-radius: 10px; overflow: hidden; background: var(--bg-primary);">
                ${tasksStatus.new > 0 ? `<div style="width: ${(tasksStatus.new / total) * 100}%; background: var(--danger);"></div>` : ''}
                ${tasksStatus.inProgress > 0 ? `<div style="width: ${(tasksStatus.inProgress / total) * 100}%; background: var(--warning);"></div>` : ''}
                ${tasksStatus.completed > 0 ? `<div style="width: ${(tasksStatus.completed / total) * 100}%; background: var(--success);"></div>` : ''}
            </div>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 12px; height: 12px; background: var(--danger); border-radius: 3px;"></div>
                    <span style="font-size: 14px; color: var(--text-secondary);">Новые</span>
                </div>
                <span style="font-weight: 600;">${tasksStatus.new}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 12px; height: 12px; background: var(--warning); border-radius: 3px;"></div>
                    <span style="font-size: 14px; color: var(--text-secondary);">В работе</span>
                </div>
                <span style="font-weight: 600;">${tasksStatus.inProgress}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 12px; height: 12px; background: var(--success); border-radius: 3px;"></div>
                    <span style="font-size: 14px; color: var(--text-secondary);">Выполнено</span>
                </div>
                <span style="font-weight: 600;">${tasksStatus.completed}</span>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// Сотрудники без отчетов
function loadMissingReports(allEmployees, todayReports) {
    const container = document.getElementById('missingReportsList');
    
    // Получаем ID сотрудников, которые отправили отчеты
    const reportedIds = todayReports.map(r => parseInt(r.telegramId));
    
    // Фильтруем тех, кто не отправил
    const missingEmployees = allEmployees.filter(emp => !reportedIds.includes(emp.telegramId));
    
    if (missingEmployees.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <p style="color: var(--success); font-size: 16px;">✅ Все сотрудники отправили отчеты!</p>
            </div>
        `;
        return;
    }
    
    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
    
    missingEmployees.forEach(employee => {
        html += `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--bg-card); border-radius: 12px; border: 1px solid rgba(255, 107, 107, 0.2);">
                <div>
                    <div style="font-weight: 600; color: var(--text-primary);">${employee.name}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${employee.position}</div>
                </div>
                <button onclick="sendReminderToEmployee(${employee.telegramId}, '${employee.name}')" 
                        style="padding: 8px 16px; background: var(--warning); border: none; border-radius: 8px; color: black; font-size: 12px; font-weight: 600; cursor: pointer;">
                    Напомнить
                </button>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Отправка напоминания сотруднику
window.sendReminderToEmployee = async function(employeeId, employeeName) {
    if (!confirm(`Отправить напоминание сотруднику ${employeeName}?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/admin/send-reminder`, {
            method: 'POST',
            headers: {
                'X-Telegram-Init-Data': tg.initData,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ employeeId })
        });
        
        if (response.ok) {
            showNotification('Напоминание отправлено', 'success');
        } else {
            showNotification('Ошибка отправки напоминания', 'error');
        }
    } catch (error) {
        console.error('Error sending reminder:', error);
        showNotification('Ошибка отправки напоминания', 'error');
    }
}

async function loadAdminPanel() {
    try {
        // Загружаем список сотрудников для фильтра
        const employeesResponse = await fetch(`${API_URL}/api/employees`, {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        
        if (employeesResponse.ok) {
            const employees = await employeesResponse.json();
            const employeeFilter = document.getElementById('employeeFilter');
            
            // Очищаем и заполняем select
            employeeFilter.innerHTML = '<option value="all">Все сотрудники</option>';
            employees.forEach(emp => {
                const option = document.createElement('option');
                option.value = emp.telegramId;
                option.textContent = emp.name;
                employeeFilter.appendChild(option);
            });
            
            // Обновляем количество активных сотрудников
            document.getElementById('adminActiveEmployees').textContent = employees.length;
        }
        
        // Загружаем отчеты
        updateAdminPanel();
        
    } catch (error) {
        console.error('Error loading admin panel:', error);
        showNotification('Ошибка загрузки админ-панели', 'error');
    }
}

window.updateAdminPanel = async function() {
    const period = document.getElementById('periodFilter').value;
    const employeeId = document.getElementById('employeeFilter').value;
    const customDateRange = document.getElementById('customDateRange');
    
    // Показываем/скрываем выбор дат
    if (period === 'custom') {
        customDateRange.style.display = 'flex';
    } else {
        customDateRange.style.display = 'none';
    }
    
    // Определяем даты
    let startDate, endDate;
    const today = new Date();
    
    switch(period) {
        case 'today':
            startDate = endDate = today.toISOString().split('T')[0];
            break;
        case 'week':
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay() + 1); // Понедельник
            startDate = weekStart.toISOString().split('T')[0];
            endDate = today.toISOString().split('T')[0];
            break;
        case 'month':
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            startDate = monthStart.toISOString().split('T')[0];
            endDate = today.toISOString().split('T')[0];
            break;
        case 'custom':
            startDate = document.getElementById('startDate').value;
            endDate = document.getElementById('endDate').value;
            if (!startDate || !endDate) return;
            break;
    }
    
    try {
        // Загружаем отчеты
        const params = new URLSearchParams({
            startDate,
            endDate,
            employeeId: employeeId === 'all' ? '' : employeeId
        });
        
        const response = await fetch(`${API_URL}/api/admin/reports?${params}`, {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Обновляем статистику
            document.getElementById('adminTotalReports').textContent = data.totalReports;
            document.getElementById('adminTodayReports').textContent = data.todayReports;
            document.getElementById('adminCompletedTasks').textContent = data.completedTasks;
            
            // Отображаем отчеты
            displayAdminReports(data.reports);
        }
        
    } catch (error) {
        console.error('Error updating admin panel:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

function displayAdminReports(reports) {
    const container = document.getElementById('adminReportsList');
    
    if (reports.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                <p>Нет отчетов за выбранный период</p>
            </div>
        `;
        return;
    }
    
    // Группируем отчеты по датам
    const groupedReports = {};
    reports.forEach(report => {
        const date = new Date(report.date).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        if (!groupedReports[date]) {
            groupedReports[date] = [];
        }
        groupedReports[date].push(report);
    });
    
    let html = '';
    Object.entries(groupedReports).forEach(([date, dayReports]) => {
        html += `
            <div style="margin-bottom: 24px;">
                <h4 style="color: var(--text-secondary); font-size: 14px; margin-bottom: 12px;">${date}</h4>
                <div style="display: flex; flex-direction: column; gap: 12px;">
        `;
        
        dayReports.forEach(report => {
            const time = new Date(report.timestamp).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            html += `
                <div style="background: var(--bg-card); border-radius: 12px; padding: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <div>
                            <h5 style="margin: 0; font-size: 16px; color: var(--text-primary);">${report.employeeName}</h5>
                            <p style="margin: 0; font-size: 12px; color: var(--text-secondary);">Отправлен в ${time}</p>
                        </div>
                        <span style="background: var(--success-light); color: var(--success); padding: 4px 8px; border-radius: 8px; font-size: 12px;">
                            ${report.status}
                        </span>
                    </div>
                    
                    <div style="margin-top: 12px;">
                        <p style="margin: 0 0 8px 0; font-size: 14px; color: var(--text-secondary);">Что сделано:</p>
                        <p style="margin: 0; font-size: 14px; color: var(--text-primary); white-space: pre-wrap;">${report.whatDone}</p>
                    </div>
                    
                    ${report.problems && report.problems !== 'Нет' ? `
                        <div style="margin-top: 12px;">
                            <p style="margin: 0 0 8px 0; font-size: 14px; color: var(--text-secondary);">Проблемы:</p>
                            <p style="margin: 0; font-size: 14px; color: var(--warning); white-space: pre-wrap;">${report.problems}</p>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function debugTasks() {
    try {
        console.log('Debug: Current user:', tg.initDataUnsafe.user);
        console.log('Debug: Init data:', tg.initData);
        
        const response = await fetch(`${API_URL}/api/debug/tasks`, {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        
        if (response.ok) {
            const debug = await response.json();
            console.log('Debug info:', debug);
            
            tg.showAlert(
                `Debug Info:\n\n` +
                `Your ID: ${debug.currentUserId}\n` +
                `Total tasks in DB: ${debug.totalTasksInDB}\n` +
                `Your tasks: ${debug.userTasksFound}\n\n` +
                `Check console for details`
            );
        } else {
            const error = await response.text();
            console.error('Debug error:', error);
            tg.showAlert(`Debug Error: ${response.status}`);
        }
    } catch (error) {
        console.error('Debug error:', error);
        tg.showAlert('Debug error: ' + error.message);
    }
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
    
    const select = document.getElementById('taskEmployee');
    
    // Если обычный пользователь - показываем только себя
    if (!window.isManager) {
        select.innerHTML = `<option value="${tg.initDataUnsafe.user.id}" selected>${currentUser.name} (Я)</option>`;
        select.disabled = true; // Блокируем выбор
        
        // Скрываем label или добавляем пояснение
        const formGroup = select.closest('.form-group');
        if (formGroup) {
            const label = formGroup.querySelector('label');
            if (label) {
                label.textContent = 'Исполнитель (только для себя)';
            }
        }
    } else {
        // Менеджер - показываем всех сотрудников
        select.disabled = false;
        const formGroup = select.closest('.form-group');
        if (formGroup) {
            const label = formGroup.querySelector('label');
            if (label) {
                label.textContent = 'Исполнитель';
            }
        }
        
        if (employeeId && employeeName) {
            select.innerHTML = `<option value="${employeeId}" selected>${employeeName}</option>`;
            loadEmployeesForSelect(employeeId);
        } else {
            loadEmployeesForSelect();
        }
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

// Открыть детальный просмотр задачи
window.openTaskDetail = async function(taskId) {
    console.log('Opening task detail for:', taskId);
    console.log('Current tasks:', currentTasks);
    
    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
    
    // Находим задачу в текущем списке
    const task = currentTasks.find(t => t.id === taskId);
    if (!task) {
        console.error('Task not found:', taskId);
        console.error('Available task IDs:', currentTasks.map(t => t.id));
        return;
    }
    
    console.log('Found task:', task);
    
    // Переходим на страницу детального просмотра
    showPage('taskDetail');
    
    // Отображаем детали задачи
    displayTaskDetail(task);
}

// Отобразить детали задачи
function displayTaskDetail(task) {
    const content = document.querySelector('.task-detail-content');
    
    const statusClass = task.status === 'Новая' ? 'new' : 
                      task.status === 'В работе' ? 'in-progress' : 'completed';
    
    const priorityText = task.priority === 'high' ? '🔴 Высокий' : 
                        task.priority === 'medium' ? '🟡 Средний' : '🟢 Низкий';
    
    const canComplete = task.status !== 'Выполнена' && currentTaskType === 'my';
    
    content.innerHTML = `
        <div class="task-detail-card">
            <div class="task-detail-header">
                <h1>${task.title}</h1>
                <span class="task-status ${statusClass}">${task.status}</span>
            </div>
            
            ${task.description ? `
                <div class="task-detail-section">
                    <h3>📝 Описание</h3>
                    <p>${task.description}</p>
                </div>
            ` : ''}
            
            <div class="task-detail-section">
                <h3>ℹ️ Информация</h3>
                <div class="task-detail-info">
                    <div class="info-row">
                        <span class="info-label">Приоритет:</span>
                        <span class="info-value">${priorityText}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Срок:</span>
                        <span class="info-value">📅 ${formatDate(task.deadline)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Создана:</span>
                        <span class="info-value">${formatDate(task.createdDate)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Постановщик:</span>
                        <span class="info-value">👤 ${task.creatorName === currentUser?.name ? 'Я' : (task.creatorName || 'Система')}</span>
                    </div>
                    ${currentTaskType === 'created' ? `
                        <div class="info-row">
                            <span class="info-label">Исполнитель:</span>
                            <span class="info-value">👤 ${task.assigneeName || 'Не назначен'}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            ${canComplete ? `
                <div class="task-detail-actions">
                    ${task.status === 'Новая' ? `
                        <button class="action-btn start-btn" onclick="updateTaskStatus('${task.id}', 'В работе')">
                            🚀 Взять в работу
                        </button>
                    ` : ''}
                    <button class="action-btn complete-btn" onclick="updateTaskStatus('${task.id}', 'Выполнена')">
                        ✅ Выполнить задачу
                    </button>
                </div>
            ` : ''}
            
            ${window.isManager && currentTaskType === 'created' ? `
                <div class="task-detail-actions" style="margin-top: 12px;">
                    <button class="action-btn edit-btn" onclick="editTask('${task.id}')">
                        ✏️ Редактировать задачу
                    </button>
                </div>
            ` : ''}
            
            ${task.status === 'Выполнена' ? `
                <div class="task-completed-badge">
                    ✅ Задача выполнена
                </div>
            ` : ''}
        </div>
    `;
}

// Обновить статус задачи
window.updateTaskStatus = async function(taskId, newStatus) {
    try {
        if (tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('medium');
        }
        
        const response = await fetch(`${API_URL}/api/tasks/${taskId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': tg.initData
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.ok) {
            if (tg.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('success');
            }
            
            const message = newStatus === 'В работе' ? 'Задача взята в работу!' : 'Задача выполнена! 🎉';
            
            tg.showAlert(message, () => {
                // Обновляем задачу в локальном списке
                const task = currentTasks.find(t => t.id === taskId);
                if (task) {
                    task.status = newStatus;
                    displayTaskDetail(task);
                }
                
                // Перезагружаем список задач
                loadTasks();
            });
        } else {
            throw new Error('Ошибка обновления');
        }
    } catch (error) {
        if (tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('error');
        }
        tg.showAlert('Ошибка при обновлении задачи');
    }
}

// Открыть модальное окно редактирования задачи
window.editTask = async function(taskId) {
    const task = currentTasks.find(t => t.id === taskId);
    if (!task) {
        console.error('Task not found for editing:', taskId);
        return;
    }
    
    // Заполняем форму данными задачи
    document.getElementById('editTaskId').value = task.id;
    document.getElementById('editTaskTitle').value = task.title;
    document.getElementById('editTaskDescription').value = task.description || '';
    document.getElementById('editTaskPriority').value = task.priority || 'medium';
    
    // Устанавливаем дату
    if (task.deadline) {
        const date = new Date(task.deadline);
        document.getElementById('editTaskDeadline').value = date.toISOString().split('T')[0];
    }
    
    // Загружаем список сотрудников
    await loadEmployeesForEditSelect(task.assigneeId);
    
    // Показываем модальное окно
    document.getElementById('editTaskModal').style.display = 'flex';
}

// Загрузить сотрудников для редактирования
async function loadEmployeesForEditSelect(selectedId = null) {
    try {
        const response = await fetch(`${API_URL}/api/employees`, {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        
        if (response.ok) {
            const employees = await response.json();
            const select = document.getElementById('editTaskEmployee');
            
            select.innerHTML = employees.map(emp => 
                `<option value="${emp.telegramId}" ${emp.telegramId == selectedId ? 'selected' : ''}>${emp.name}</option>`
            ).join('');
        }
    } catch (error) {
        console.error('Error loading employees for edit:', error);
    }
}

// Закрыть модальное окно редактирования
window.closeEditTaskModal = function() {
    document.getElementById('editTaskModal').style.display = 'none';
    document.getElementById('editTaskForm').reset();
}

// Отправить изменения задачи
window.submitEditTask = async function(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const taskId = formData.get('taskId');
    const updatedTask = {
        title: formData.get('title'),
        description: formData.get('description') || '',
        deadline: formData.get('deadline'),
        priority: formData.get('priority'),
        assigneeId: parseInt(formData.get('employee'))
    };
    
    const submitBtn = event.target.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Сохранение...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': tg.initData
            },
            body: JSON.stringify(updatedTask)
        });
        
        if (response.ok) {
            if (tg.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('success');
            }
            
            tg.showAlert('Задача успешно обновлена! ✅', () => {
                closeEditTaskModal();
                // Перезагружаем задачи
                loadTasks();
                // Закрываем детальный просмотр
                showPage('tasks');
            });
        } else {
            throw new Error('Ошибка обновления');
        }
    } catch (error) {
        if (tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('error');
        }
        tg.showAlert('Ошибка при обновлении задачи');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}