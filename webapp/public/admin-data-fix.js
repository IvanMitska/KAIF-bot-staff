// ===== ИСПРАВЛЕНИЕ ЗАГРУЗКИ РЕАЛЬНЫХ ДАННЫХ В АДМИН-ПАНЕЛИ =====

// Получаем Telegram WebApp и API URL
const telegramApp = window.Telegram?.WebApp;
const ADMIN_ADMIN_API_URL = window.location.origin;

// Переопределяем функцию загрузки dashboard с реальными данными
async function loadDashboard() {
    console.log('🔄 Loading dashboard data...');
    
    // Скрываем сообщение об ошибке
    const errorOverlay = document.querySelector('.error-overlay');
    if (errorOverlay) {
        errorOverlay.style.display = 'none';
    }
    
    try {
        // Определяем параметры запроса
        const headers = {};
        let testParam = '';
        
        if (telegramApp && telegramApp.initData) {
            headers['X-Telegram-Init-Data'] = telegramApp.initData;
        } else {
            testParam = '?test=1';
        }
        
        console.log('📡 Fetching from:', `${ADMIN_API_URL}/api/admin/dashboard/stats${testParam}`);
        console.log('Headers:', headers);
        
        // Делаем запросы по одному для лучшей отладки
        let statsRes, reportsRes, attendanceRes;
        
        try {
            statsRes = await fetch(`${ADMIN_API_URL}/api/admin/dashboard/stats${testParam}`, { 
                headers,
                method: 'GET',
                mode: 'cors',
                credentials: 'same-origin'
            });
            console.log('Stats response:', statsRes.status, statsRes.ok);
        } catch (err) {
            console.error('Stats fetch error:', err);
            statsRes = { ok: false };
        }
        
        try {
            reportsRes = await fetch(`${ADMIN_API_URL}/api/admin/reports${testParam}`, { 
                headers,
                method: 'GET',
                mode: 'cors',
                credentials: 'same-origin'
            });
            console.log('Reports response:', reportsRes.status, reportsRes.ok);
        } catch (err) {
            console.error('Reports fetch error:', err);
            reportsRes = { ok: false };
        }
        
        try {
            attendanceRes = await fetch(`${ADMIN_API_URL}/api/admin/attendance${testParam}`, { 
                headers,
                method: 'GET',
                mode: 'cors',
                credentials: 'same-origin'
            });
            console.log('Attendance response:', attendanceRes.status, attendanceRes.ok);
        } catch (err) {
            console.error('Attendance fetch error:', err);
            attendanceRes = { ok: false };
        }

        // Обработка общей статистики
        if (statsRes.ok) {
            const stats = await statsRes.json();
            console.log('Real stats loaded:', stats);
            
            // Обновляем метрики реальными данными
            const totalEmployees = stats.totalEmployees || 8;
            const todayReportsCount = stats.todayReports || 0;
            const missingReportsCount = Math.max(0, totalEmployees - todayReportsCount);
            const reportsPercentage = totalEmployees > 0 ? Math.round((todayReportsCount / totalEmployees) * 100) : 0;
            
            // Обновляем значения на странице
            updateElementSafely('dashboardTodayReports', todayReportsCount);
            updateElementSafely('dashboardMissingReports', missingReportsCount);
            
            // Обновляем процент "Без отчетов" (вторая карточка) 
            const warningPercentElement = document.querySelector('.metric-card.warning .metric-trend .trend-value');
            if (warningPercentElement) {
                // Показываем разницу в количестве, а не процент
                warningPercentElement.textContent = `-${missingReportsCount}`;
                
                // Обновляем класс тренда
                const trendContainer = warningPercentElement.closest('.metric-trend');
                if (trendContainer) {
                    trendContainer.classList.remove('positive', 'negative');
                    trendContainer.classList.add(missingReportsCount > 0 ? 'negative' : 'positive');
                }
            }
            
            // Обновляем процент отчетов (первая карточка)
            const reportsPercentElement = document.querySelector('.metric-card.primary .metric-trend .trend-value');
            if (reportsPercentElement) {
                reportsPercentElement.textContent = `${reportsPercentage > 0 ? '+' : ''}${reportsPercentage}%`;
                
                // Обновляем класс тренда
                const trendContainer = reportsPercentElement.closest('.metric-trend');
                if (trendContainer) {
                    trendContainer.classList.remove('positive', 'negative');
                    trendContainer.classList.add(reportsPercentage >= 50 ? 'positive' : 'negative');
                }
            }
            
            // Обновляем прогресс бар
            const progressBar = document.querySelector('.metric-card.primary .progress-fill');
            if (progressBar) {
                progressBar.style.width = `${reportsPercentage}%`;
            }
            
            // Обновляем подпись
            const sublabel = document.querySelector('.metric-card.primary .metric-sublabel');
            if (sublabel) {
                sublabel.textContent = `из ${totalEmployees} сотрудников`;
            }
        }

        // Обработка статистики задач из общей статистики
        if (statsRes.ok) {
            const stats = await statsRes.json();
            
            // Используем данные о задачах из общей статистики
            const activeTasks = stats.activeTasks || 0;
            const completedToday = stats.completedToday || 0;
            const totalTasks = activeTasks + completedToday;
            const completionRate = totalTasks > 0 ? Math.round((completedToday / totalTasks) * 100) : 0;
            
            updateElementSafely('dashboardActiveTasks', activeTasks);
            updateElementSafely('dashboardCompletedToday', completedToday);
            
            // Используем реальное изменение отчетов если есть
            if (stats.reportsChange !== undefined) {
                const reportsPercentElement = document.querySelector('.metric-card.primary .metric-trend .trend-value');
                if (reportsPercentElement) {
                    const change = stats.reportsChange;
                    reportsPercentElement.textContent = `${change > 0 ? '+' : ''}${change}%`;
                    
                    const trendContainer = reportsPercentElement.closest('.metric-trend');
                    if (trendContainer) {
                        trendContainer.classList.remove('positive', 'negative');
                        trendContainer.classList.add(change >= 0 ? 'positive' : 'negative');
                    }
                }
            }
            
            // Обновляем процент выполнения задач (третья карточка)
            const tasksPercentElement = document.querySelector('.metric-card.success .metric-trend .trend-value');
            if (tasksPercentElement) {
                tasksPercentElement.textContent = `${completionRate}%`;
            }
        }

        // Обработка присутствия
        if (attendanceRes.ok) {
            const attendance = await attendanceRes.json();
            console.log('Attendance data loaded:', attendance);
            
            const presentCount = attendance.present || 0;
            const totalEmployees = attendance.total || 8;
            const attendanceRate = totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0;
            
            // Обновляем виджет присутствия
            updateAttendanceWidget(presentCount, totalEmployees, attendanceRate);
        }

        // Загружаем график активности за неделю с реальными данными
        loadRealActivityChart();
        
        // Загружаем топ сотрудников
        loadRealTopEmployees();
        
    } catch (error) {
        console.error('❌ Error loading dashboard data:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            ADMIN_API_URL: ADMIN_API_URL
        });
        
        // Показываем сообщение об ошибке пользователю
        showErrorMessage('Не удалось загрузить данные. Проверьте подключение к интернету.');
        
        // Загружаем резервные данные
        loadFallbackDashboard();
    }
}

// Безопасное обновление элементов
function updateElementSafely(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

// Обновление виджета присутствия
function updateAttendanceWidget(present, total, percentage) {
    const widget = document.querySelector('.attendance-widget');
    if (!widget) return;
    
    let html = `
        <div class="widget-header">
            <div class="widget-title">
                <i data-lucide="users"></i>
                Присутствие сегодня
            </div>
            <div class="widget-action">${percentage}%</div>
        </div>
        <div class="attendance-stats">
            <div class="attendance-stat">
                <div class="stat-value">${present}</div>
                <div class="stat-label">На месте</div>
            </div>
            <div class="attendance-stat">
                <div class="stat-value">${total - present}</div>
                <div class="stat-label">Отсутствуют</div>
            </div>
        </div>
    `;
    
    widget.innerHTML = html;
    
    // Обновляем иконки Lucide
    if (window.lucide) {
        lucide.createIcons();
    }
}

// Загрузка реального графика активности
async function loadRealActivityChart() {
    try {
        const response = await fetch(`${ADMIN_API_URL}/api/admin/activity/week`, {
            headers: { 'X-Telegram-Init-Data': telegramApp.initData }
        });
        
        if (response.ok) {
            const weekData = await response.json();
            console.log('Week activity data:', weekData);
            
            const container = document.getElementById('activityChart');
            if (!container) return;
            
            // Создаем график с реальными данными
            const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
            const maxValue = Math.max(...weekData.map(d => d.count || 0), 1);
            
            let html = '<div class="chart-bars-container">';
            
            weekData.forEach((day, index) => {
                const height = (day.count / maxValue) * 120;
                html += `
                    <div class="chart-bar-group">
                        <div class="chart-bar" style="height: ${height}px;" title="${day.count} отчетов">
                            <span class="bar-value">${day.count}</span>
                        </div>
                        <span class="bar-label">${days[index]}</span>
                    </div>
                `;
            });
            
            html += '</div>';
            container.innerHTML = html;
        }
    } catch (error) {
        console.error('Error loading activity chart:', error);
    }
}

// Загрузка топ сотрудников
async function loadRealTopEmployees() {
    try {
        const response = await fetch(`${ADMIN_API_URL}/api/admin/employees/top`, {
            headers: { 'X-Telegram-Init-Data': telegramApp.initData }
        });
        
        if (response.ok) {
            const topEmployees = await response.json();
            console.log('Top employees:', topEmployees);
            
            const container = document.getElementById('topEmployees');
            if (!container) return;
            
            let html = '<div class="top-employees-list">';
            
            topEmployees.slice(0, 5).forEach((employee, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
                html += `
                    <div class="top-employee-item">
                        <div class="top-position">${medal}</div>
                        <div class="top-employee-info">
                            <div class="employee-name">${employee.name}</div>
                            <div class="employee-score">${employee.score} баллов</div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            container.innerHTML = html;
        }
    } catch (error) {
        console.error('Error loading top employees:', error);
    }
}

// Резервная загрузка данных
function loadFallbackDashboard() {
    console.log('Loading fallback dashboard data...');
    
    // Устанавливаем нулевые значения
    updateElementSafely('dashboardTodayReports', 0);
    updateElementSafely('dashboardMissingReports', 8);
    updateElementSafely('dashboardActiveTasks', 0);
    updateElementSafely('dashboardCompletedToday', 0);
    
    // Устанавливаем прогресс бары на 0
    const progressBars = document.querySelectorAll('.progress-fill');
    progressBars.forEach(bar => {
        bar.style.width = '0%';
    });
    
    // Показываем сообщение об ошибке
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.textContent = 'Не удалось загрузить данные. Проверьте подключение к интернету.';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(239, 68, 68, 0.9);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 9999;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Периодическое обновление данных
let dashboardUpdateInterval = null;

function startDashboardAutoUpdate() {
    // Останавливаем предыдущий интервал если есть
    if (dashboardUpdateInterval) {
        clearInterval(dashboardUpdateInterval);
    }
    
    // Обновляем каждые 30 секунд
    dashboardUpdateInterval = setInterval(() => {
        if (document.getElementById('adminPanel').classList.contains('active')) {
            console.log('Auto-updating dashboard...');
            loadDashboard();
        }
    }, 30000);
}

// Останавливаем обновление при переходе на другую страницу
function stopDashboardAutoUpdate() {
    if (dashboardUpdateInterval) {
        clearInterval(dashboardUpdateInterval);
        dashboardUpdateInterval = null;
    }
}

// Функция показа сообщения об ошибке
function showErrorMessage(message) {
    // Создаем элемент для сообщения об ошибке
    const errorElement = document.createElement('div');
    errorElement.className = 'dashboard-error-message';
    errorElement.style.cssText = `
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.2));
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #fca5a5;
        padding: 16px;
        border-radius: 12px;
        margin: 20px;
        text-align: center;
        font-size: 14px;
    `;
    errorElement.textContent = message;
    
    // Вставляем в начало dashboard content
    const dashboardContent = document.getElementById('dashboardContent');
    if (dashboardContent) {
        const existingError = dashboardContent.querySelector('.dashboard-error-message');
        if (existingError) {
            existingError.remove();
        }
        dashboardContent.insertBefore(errorElement, dashboardContent.firstChild);
    }
}

// Переопределяем функцию переключения табов
const originalSwitchAdminTab = window.switchAdminTab;
window.switchAdminTab = function(tab) {
    // Вызываем оригинальную функцию
    if (originalSwitchAdminTab) {
        originalSwitchAdminTab.call(this, tab);
    }
    
    // Если переключились на dashboard, запускаем автообновление
    if (tab === 'dashboard') {
        loadDashboard(); // Загружаем реальные данные
        startDashboardAutoUpdate();
    } else {
        stopDashboardAutoUpdate();
    }
}

// Переопределяем глобальную функцию loadDashboard
window.loadDashboard = loadDashboard;
window.loadRealDashboard = loadDashboard; // Для обратной совместимости
window.startDashboardAutoUpdate = startDashboardAutoUpdate;
window.stopDashboardAutoUpdate = stopDashboardAutoUpdate;