// ===== ИСПРАВЛЕНИЕ ПОДКЛЮЧЕНИЯ К RAILWAY =====

// Определяем правильный API URL в зависимости от окружения
const getRailwayApiUrl = () => {
    // Проверяем, запущено ли приложение в Telegram WebApp
    const isInTelegram = window.Telegram?.WebApp?.initData;
    
    // Получаем текущий URL
    const currentUrl = window.location.origin;
    const hostname = window.location.hostname;
    
    // Проверяем различные Railway домены
    if (hostname.includes('railway.app') || 
        hostname.includes('up.railway.app') || 
        hostname.includes('rlwy.net')) {
        console.log('🚂 Running on Railway:', currentUrl);
        return currentUrl;
    }
    
    // Если это production домен вашего проекта
    if (hostname === 'tgbotkaifstaff-production.up.railway.app' ||
        hostname === 'tgbotkaifstaff.up.railway.app') {
        console.log('🚀 Production Railway domain detected');
        return currentUrl;
    }
    
    // Для локальной разработки
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168')) {
        console.log('💻 Local development mode');
        // В локальном режиме используем текущий origin
        return currentUrl;
    }
    
    // Fallback на текущий origin
    console.log('📍 Using current origin:', currentUrl);
    return currentUrl;
};

// Переопределяем глобальный API_URL
window.API_URL = getRailwayApiUrl();
console.log('✅ API URL configured:', window.API_URL);

// Улучшенная функция для API запросов с правильными заголовками
window.railwayApiRequest = async function(endpoint, options = {}) {
    const url = `${window.API_URL}${endpoint}`;
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    // Добавляем Telegram init data если есть
    if (window.Telegram?.WebApp?.initData) {
        headers['X-Telegram-Init-Data'] = window.Telegram.WebApp.initData;
    }
    
    console.log(`🔄 API Request: ${options.method || 'GET'} ${url}`);
    
    try {
        const response = await fetch(url, {
            ...options,
            headers,
            credentials: 'same-origin', // Важно для работы с Railway
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ API Response:', data);
        return data;
        
    } catch (error) {
        console.error('❌ API Error:', error);
        throw error;
    }
};

// Переопределяем функцию загрузки списка сотрудников
window.loadEmployeesFixed = async function() {
    const employeesList = document.getElementById('employeesList');
    if (!employeesList) {
        console.log('Creating employees page...');
        createEmployeesPage();
        return;
    }
    
    employeesList.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Загрузка сотрудников из базы данных Railway...</p>
        </div>
    `;
    
    try {
        const employees = await railwayApiRequest('/api/employees');
        
        if (employees && employees.length > 0) {
            displayEmployeesFromDatabase(employees);
        } else {
            displayNoEmployees();
        }
    } catch (error) {
        console.error('Failed to load employees:', error);
        displayConnectionError(error);
    }
};

// Отображение сотрудников из базы данных
function displayEmployeesFromDatabase(employees) {
    const container = document.getElementById('employeesList');
    if (!container) return;
    
    console.log(`📋 Displaying ${employees.length} employees from database`);
    
    let html = '<div class="employees-grid">';
    
    employees.forEach(employee => {
        const initials = getInitials(employee.name || 'НН');
        const isOnline = employee.isOnline || false;
        const statusClass = isOnline ? 'online' : 'offline';
        const statusText = isOnline ? 'В сети' : 'Не в сети';
        
        html += `
            <div class="employee-card glass-card" onclick="selectEmployee('${employee.telegramId}', '${employee.name}')">
                <div class="employee-avatar ${statusClass}">
                    <span class="avatar-text">${initials}</span>
                    <div class="status-dot ${statusClass}"></div>
                </div>
                <div class="employee-details">
                    <h3 class="employee-name">${employee.name}</h3>
                    <p class="employee-position">${employee.position || 'Сотрудник'}</p>
                    <div class="employee-status-line">
                        <span class="status-indicator ${statusClass}"></span>
                        <span>${statusText}</span>
                    </div>
                </div>
                <button class="btn-action" onclick="event.stopPropagation(); createTaskForEmployee('${employee.telegramId}', '${employee.name}')">
                    <i data-lucide="plus-circle"></i>
                    Задача
                </button>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
    // Обновляем иконки Lucide
    if (window.lucide) {
        lucide.createIcons();
    }
}

// Отображение пустого состояния
function displayNoEmployees() {
    const container = document.getElementById('employeesList');
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state">
            <i data-lucide="users" class="empty-icon"></i>
            <h3>Нет сотрудников</h3>
            <p>В базе данных пока нет зарегистрированных сотрудников</p>
            <button class="btn-primary" onclick="loadEmployeesFixed()">
                <i data-lucide="refresh-cw"></i>
                Обновить
            </button>
        </div>
    `;
    
    if (window.lucide) {
        lucide.createIcons();
    }
}

// Отображение ошибки подключения
function displayConnectionError(error) {
    const container = document.getElementById('employeesList');
    if (!container) return;
    
    container.innerHTML = `
        <div class="error-state">
            <i data-lucide="wifi-off" class="error-icon"></i>
            <h3>Ошибка подключения</h3>
            <p>Не удалось загрузить данные из Railway PostgreSQL</p>
            <p class="error-details">${error.message}</p>
            <button class="btn-primary" onclick="loadEmployeesFixed()">
                <i data-lucide="refresh-cw"></i>
                Попробовать снова
            </button>
        </div>
    `;
    
    if (window.lucide) {
        lucide.createIcons();
    }
}

// Функция получения инициалов
function getInitials(name) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// Загрузка данных админ-панели из Railway
window.loadAdminDashboardFromRailway = async function() {
    console.log('📊 Loading admin dashboard from Railway PostgreSQL...');
    
    try {
        // Загружаем статистику
        const stats = await railwayApiRequest('/api/admin/stats');
        
        if (stats) {
            updateAdminStats(stats);
        }
        
        // Загружаем отчеты
        const reports = await railwayApiRequest('/api/admin/reports/today');
        if (reports) {
            updateTodayReports(reports);
        }
        
        // Загружаем присутствие
        const attendance = await railwayApiRequest('/api/admin/attendance/today');
        if (attendance) {
            updateAttendanceWidget(attendance);
        }
        
        console.log('✅ Admin dashboard loaded successfully');
        
    } catch (error) {
        console.error('❌ Failed to load admin dashboard:', error);
        showAdminError('Не удалось загрузить данные из Railway');
    }
};

// Обновление статистики админ-панели
function updateAdminStats(stats) {
    const { totalEmployees = 0, todayReports = 0, activeTasks = 0, completedToday = 0 } = stats;
    
    // Обновляем элементы на странице
    const elements = {
        'dashboardTodayReports': todayReports,
        'dashboardMissingReports': Math.max(0, totalEmployees - todayReports),
        'dashboardActiveTasks': activeTasks,
        'dashboardCompletedToday': completedToday
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
    
    // Обновляем прогресс
    const percentage = totalEmployees > 0 ? Math.round((todayReports / totalEmployees) * 100) : 0;
    const progressBar = document.querySelector('.progress-fill');
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
    }
}

// Показать ошибку в админ-панели
function showAdminError(message) {
    const notification = document.createElement('div');
    notification.className = 'admin-error-notification';
    notification.innerHTML = `
        <i data-lucide="alert-triangle"></i>
        <span>${message}</span>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        z-index: 99999;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 10px 30px rgba(239, 68, 68, 0.4);
        animation: slideDown 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    if (window.lucide) {
        lucide.createIcons();
    }
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// CSS стили для Railway подключения
const railwayStyles = document.createElement('style');
railwayStyles.textContent = `
    .loading-state {
        text-align: center;
        padding: 40px;
        color: rgba(255, 255, 255, 0.8);
    }
    
    .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(139, 92, 246, 0.3);
        border-top-color: #8b5cf6;
        border-radius: 50%;
        margin: 0 auto 20px;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    .error-state, .empty-state {
        text-align: center;
        padding: 40px;
        color: rgba(255, 255, 255, 0.8);
    }
    
    .error-icon, .empty-icon {
        width: 64px;
        height: 64px;
        margin: 0 auto 20px;
        color: rgba(239, 68, 68, 0.8);
    }
    
    .empty-icon {
        color: rgba(156, 163, 175, 0.8);
    }
    
    .error-details {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
        margin-top: 8px;
        font-family: monospace;
    }
    
    .btn-primary {
        background: linear-gradient(135deg, #8b5cf6, #ec4899);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 12px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 20px;
        transition: all 0.3s ease;
    }
    
    .btn-primary:hover {
        transform: scale(1.05);
        box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);
    }
    
    .status-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        position: absolute;
        bottom: 0;
        right: 0;
        border: 2px solid rgba(30, 20, 50, 0.9);
    }
    
    .status-dot.online {
        background: #10b981;
        animation: pulse 2s infinite;
    }
    
    .status-dot.offline {
        background: #6b7280;
    }
    
    @keyframes pulse {
        0%, 100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
        }
        50% {
            box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
        }
    }
    
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
`;
document.head.appendChild(railwayStyles);

// Переопределяем оригинальные функции
if (typeof loadEmployees !== 'undefined') {
    window.originalLoadEmployees = window.loadEmployees;
    window.loadEmployees = window.loadEmployeesFixed;
}

if (typeof loadDashboard !== 'undefined') {
    window.originalLoadDashboard = window.loadDashboard;
    window.loadDashboard = window.loadAdminDashboardFromRailway;
}

// Автоматическая инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚂 Railway Connection Fix initialized');
    console.log('📍 Current location:', window.location.origin);
    console.log('🔗 API URL:', window.API_URL);
    
    // Проверяем подключение к Railway
    railwayApiRequest('/api/health')
        .then(() => console.log('✅ Railway API is accessible'))
        .catch(err => console.error('❌ Railway API is not accessible:', err));
});

console.log('Railway connection fix loaded');