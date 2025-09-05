// ===== ИСПРАВЛЕНИЕ API ПОДКЛЮЧЕНИЙ =====

// Проверяем и исправляем API URL
const getCorrectApiUrl = () => {
    // Используем относительный путь для API
    const baseUrl = window.location.origin;
    console.log('Base URL:', baseUrl);
    return baseUrl;
};

// Переопределяем API_URL если нужно
if (typeof API_URL === 'undefined' || !API_URL) {
    window.API_URL = getCorrectApiUrl();
}

// Улучшенная функция для API запросов с обработкой ошибок
async function safeApiRequest(url, options = {}) {
    try {
        // Добавляем заголовки Telegram
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        // Добавляем initData если есть
        if (window.Telegram?.WebApp?.initData) {
            headers['X-Telegram-Init-Data'] = window.Telegram.WebApp.initData;
        }
        
        console.log('Making API request to:', url);
        
        const response = await fetch(url, {
            ...options,
            headers
        });
        
        if (!response.ok) {
            console.error('API request failed:', response.status, response.statusText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API response:', data);
        return { ok: true, data };
        
    } catch (error) {
        console.error('API request error:', error);
        return { ok: false, error: error.message };
    }
}

// Исправленная загрузка Dashboard с fallback данными
window.loadDashboardFixed = async function() {
    console.log('Loading dashboard with fixed API...');
    
    try {
        // Пробуем загрузить реальные данные
        const statsResult = await safeApiRequest(`${API_URL}/api/admin/stats`);
        
        if (statsResult.ok && statsResult.data) {
            const stats = statsResult.data;
            
            // Обновляем метрики
            updateDashboardMetrics({
                todayReports: stats.todayReports || 0,
                totalEmployees: stats.totalEmployees || 8,
                activeTasks: stats.activeTasks || 0,
                completedToday: stats.completedToday || 0
            });
        } else {
            // Если не удалось загрузить, показываем fallback данные
            console.log('Loading fallback dashboard data...');
            loadFallbackDashboardData();
        }
        
        // Загружаем дополнительные данные с обработкой ошибок
        await loadWeekActivitySafe();
        await loadEmployeeListSafe();
        
    } catch (error) {
        console.error('Dashboard loading error:', error);
        loadFallbackDashboardData();
    }
};

// Безопасная загрузка списка сотрудников
async function loadEmployeeListSafe() {
    const container = document.getElementById('employeesList');
    if (!container) return;
    
    try {
        const result = await safeApiRequest(`${API_URL}/api/employees`);
        
        if (result.ok && result.data && result.data.length > 0) {
            displayEmployeeList(result.data);
        } else {
            // Показываем заглушку если нет данных
            displayEmptyEmployeeList();
        }
    } catch (error) {
        console.error('Error loading employees:', error);
        displayEmptyEmployeeList();
    }
}

// Отображение списка сотрудников
function displayEmployeeList(employees) {
    const container = document.getElementById('employeesList');
    if (!container) return;
    
    let html = '<div class="employees-grid">';
    
    employees.forEach(employee => {
        const initials = getInitials(employee.name || 'Сотрудник');
        const status = employee.isOnline ? 'online' : 'offline';
        
        html += `
            <div class="employee-card" onclick="selectEmployee('${employee.telegramId}', '${employee.name}')">
                <div class="employee-avatar ${status}">
                    <span>${initials}</span>
                </div>
                <div class="employee-info">
                    <div class="employee-name">${employee.name}</div>
                    <div class="employee-position">${employee.position || 'Сотрудник'}</div>
                    <div class="employee-status">
                        <span class="status-dot ${status}"></span>
                        <span>${status === 'online' ? 'В сети' : 'Не в сети'}</span>
                    </div>
                </div>
                <div class="employee-actions">
                    <button class="btn-task" onclick="event.stopPropagation(); createTaskForEmployee('${employee.telegramId}', '${employee.name}')">
                        <i data-lucide="plus-circle"></i>
                        Задача
                    </button>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
    // Обновляем иконки
    if (window.lucide) {
        lucide.createIcons();
    }
}

// Отображение пустого списка
function displayEmptyEmployeeList() {
    const container = document.getElementById('employeesList');
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">
                <i data-lucide="users"></i>
            </div>
            <h3>Нет сотрудников</h3>
            <p>Список сотрудников пуст или не удалось загрузить данные</p>
            <button class="btn-retry" onclick="loadEmployeeListSafe()">
                <i data-lucide="refresh-cw"></i>
                Попробовать снова
            </button>
        </div>
    `;
    
    // Обновляем иконки
    if (window.lucide) {
        lucide.createIcons();
    }
}

// Получение инициалов
function getInitials(name) {
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return parts[0][0] + parts[1][0];
    }
    return name.substring(0, 2).toUpperCase();
}

// Обновление метрик Dashboard
function updateDashboardMetrics(data) {
    const { todayReports, totalEmployees, activeTasks, completedToday } = data;
    
    // Расчет процентов
    const reportsPercentage = totalEmployees > 0 ? Math.round((todayReports / totalEmployees) * 100) : 0;
    const missingReports = Math.max(0, totalEmployees - todayReports);
    
    // Обновляем элементы
    updateElementText('dashboardTodayReports', todayReports);
    updateElementText('dashboardMissingReports', missingReports);
    updateElementText('dashboardActiveTasks', activeTasks);
    updateElementText('dashboardCompletedToday', completedToday);
    
    // Обновляем проценты и прогресс бары
    const progressBar = document.querySelector('.metric-card.primary .progress-fill');
    if (progressBar) {
        progressBar.style.width = `${reportsPercentage}%`;
    }
    
    // Обновляем тренд
    const trendElement = document.querySelector('.metric-card.primary .trend-value');
    if (trendElement) {
        trendElement.textContent = `+${reportsPercentage}%`;
        const trend = trendElement.closest('.metric-trend');
        if (trend) {
            trend.classList.toggle('positive', reportsPercentage >= 50);
            trend.classList.toggle('negative', reportsPercentage < 50);
        }
    }
    
    // Обновляем подпись
    const sublabel = document.querySelector('.metric-card.primary .metric-sublabel');
    if (sublabel) {
        sublabel.textContent = `из ${totalEmployees} сотрудников`;
    }
}

// Безопасное обновление текста элемента
function updateElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

// Fallback данные для Dashboard
function loadFallbackDashboardData() {
    console.log('Loading fallback data...');
    
    // Показываем сообщение об ошибке
    showErrorNotification('Не удалось загрузить данные. Проверьте подключение к интернету.');
    
    // Устанавливаем дефолтные значения
    updateDashboardMetrics({
        todayReports: 0,
        totalEmployees: 8,
        activeTasks: 0,
        completedToday: 0
    });
    
    // Скрываем индикатор Online и показываем Offline
    const statusIndicator = document.querySelector('.admin-status-indicator');
    if (statusIndicator) {
        const statusDot = statusIndicator.querySelector('.status-dot');
        const statusText = statusIndicator.querySelector('.status-text');
        
        if (statusDot) {
            statusDot.classList.remove('active');
            statusDot.style.background = '#ef4444';
        }
        
        if (statusText) {
            statusText.textContent = 'Offline';
            statusText.style.color = '#ef4444';
        }
    }
}

// Безопасная загрузка графика активности
async function loadWeekActivitySafe() {
    try {
        const result = await safeApiRequest(`${API_URL}/api/admin/activity/week`);
        
        if (result.ok && result.data) {
            displayActivityChart(result.data);
        } else {
            // Показываем пустой график
            displayEmptyActivityChart();
        }
    } catch (error) {
        console.error('Error loading activity chart:', error);
        displayEmptyActivityChart();
    }
}

// Отображение графика активности
function displayActivityChart(data) {
    const container = document.getElementById('activityChart');
    if (!container) return;
    
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const maxValue = Math.max(...data.map(d => d.count || 0), 1);
    
    let html = '<div class="activity-chart-container">';
    
    data.forEach((day, index) => {
        const height = (day.count / maxValue) * 100;
        html += `
            <div class="chart-day">
                <div class="chart-bar" style="height: ${height}px;">
                    <span class="bar-value">${day.count}</span>
                </div>
                <span class="day-label">${days[index]}</span>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Пустой график активности
function displayEmptyActivityChart() {
    const container = document.getElementById('activityChart');
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-chart">
            <p>Нет данных для отображения</p>
        </div>
    `;
}

// Показ уведомления об ошибке
function showErrorNotification(message) {
    // Удаляем предыдущее уведомление если есть
    const existingNotification = document.querySelector('.error-notification-popup');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = 'error-notification-popup';
    notification.innerHTML = `
        <div class="notification-content">
            <i data-lucide="alert-triangle"></i>
            <span>${message}</span>
        </div>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 0.95) 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        z-index: 99999;
        box-shadow: 0 10px 30px rgba(239, 68, 68, 0.4);
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideDown 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Обновляем иконки
    if (window.lucide) {
        lucide.createIcons();
    }
    
    // Удаляем через 5 секунд
    setTimeout(() => {
        notification.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Переопределяем оригинальные функции
if (typeof loadDashboard !== 'undefined') {
    window.originalLoadDashboard = window.loadDashboard;
    window.loadDashboard = window.loadDashboardFixed;
}

if (typeof loadEmployees !== 'undefined') {
    window.originalLoadEmployees = window.loadEmployees;
    window.loadEmployees = window.loadEmployeeListSafe;
}

// CSS анимации для уведомлений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
        }
        to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    }
    
    @keyframes slideUp {
        from {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        to {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
        }
    }
    
    .error-notification-popup .notification-content {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: rgba(255, 255, 255, 0.7);
    }
    
    .empty-icon {
        width: 80px;
        height: 80px;
        margin: 0 auto 20px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .empty-icon svg {
        width: 40px;
        height: 40px;
        color: rgba(255, 255, 255, 0.5);
    }
    
    .btn-retry {
        margin-top: 20px;
        padding: 12px 24px;
        background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
        color: white;
        border: none;
        border-radius: 12px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }
    
    .btn-retry:hover {
        transform: scale(1.05);
    }
`;
document.head.appendChild(style);

// Автоматическая попытка переподключения
let retryCount = 0;
const maxRetries = 3;

async function autoRetryConnection() {
    if (retryCount >= maxRetries) {
        console.log('Max retries reached');
        return;
    }
    
    retryCount++;
    console.log(`Retry attempt ${retryCount}/${maxRetries}`);
    
    // Пробуем загрузить данные снова
    await loadDashboardFixed();
    await loadEmployeeListSafe();
}

// Запускаем автоматическую попытку через 3 секунды после загрузки
setTimeout(() => {
    if (document.querySelector('.error-notification-popup')) {
        autoRetryConnection();
    }
}, 3000);

console.log('API fixes loaded successfully');