// ===== ИСПРАВЛЕНИЕ ЗАГРУЗКИ РЕАЛЬНЫХ ДАННЫХ В АДМИН-ПАНЕЛИ =====

// Переопределяем функцию загрузки dashboard с реальными данными
async function loadDashboard() {
    try {
        console.log('Loading real dashboard data...');
        
        // Загружаем реальные данные из API с правильными эндпоинтами
        const headers = tg.initData ? { 'X-Telegram-Init-Data': tg.initData } : {};
        const testParam = !tg.initData ? '?test=1' : '';
        
        const [statsRes, reportsRes, attendanceRes] = await Promise.all([
            // Общая статистика
            fetch(`${API_URL}/api/admin/dashboard/stats${testParam}`, { headers }),
            // Отчеты 
            fetch(`${API_URL}/api/admin/reports${testParam}`, { headers }),
            // Присутствие
            fetch(`${API_URL}/api/admin/attendance${testParam}`, { headers })
        ]);

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
            
            // Обновляем процент и прогресс бар
            const percentElement = document.querySelector('.metric-trend .trend-value');
            if (percentElement) {
                percentElement.textContent = `${reportsPercentage > 0 ? '+' : ''}${reportsPercentage}%`;
                
                // Обновляем класс тренда
                const trendContainer = percentElement.closest('.metric-trend');
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
            const totalTasks = stats.totalTasks || 0;
            const completionRate = totalTasks > 0 ? Math.round((completedToday / totalTasks) * 100) : 0;
            
            updateElementSafely('dashboardActiveTasks', activeTasks);
            updateElementSafely('dashboardCompletedToday', completedToday);
            
            // Обновляем процент выполнения задач
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
        console.error('Error loading real dashboard data:', error);
        
        // Если произошла ошибка, загружаем данные из локального хранилища или показываем нули
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
        const response = await fetch(`${API_URL}/api/admin/activity/week`, {
            headers: { 'X-Telegram-Init-Data': tg.initData }
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
        const response = await fetch(`${API_URL}/api/admin/employees/top`, {
            headers: { 'X-Telegram-Init-Data': tg.initData }
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