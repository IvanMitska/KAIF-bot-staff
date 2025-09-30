// Исправление загрузки списка сотрудников
(function() {
    console.log('👥 Employees Fix loading...');
    
    // Функция для загрузки сотрудников
    window.loadEmployeesList = async function() {
        console.log('Loading employees list...');
        
        const container = document.getElementById('employeesList');
        if (!container) {
            console.warn('Employees list container not found');
            // Создаем контейнер если его нет
            createEmployeesContainer();
            return;
        }
        
        // Показываем загрузку
        container.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div class="spinner"></div>
                <p style="margin-top: 20px; color: var(--text-secondary);">Загрузка сотрудников...</p>
            </div>
        `;
        
        try {
            // Определяем URL для запроса
            let url = '/api/employees';
            
            // Если есть тестовый режим, добавляем параметр
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('test') && !window.Telegram?.WebApp?.initData) {
                url += '?test=1';
            }
            
            // Создаем заголовки
            const headers = {};
            if (window.Telegram?.WebApp?.initData) {
                headers['X-Telegram-Init-Data'] = window.Telegram.WebApp.initData;
            }
            
            console.log('Fetching employees from:', url);
            const response = await fetch(url, { headers });
            
            console.log('Employees response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const employees = await response.json();
            console.log('Employees loaded:', employees);
            
            if (!employees || employees.length === 0) {
                showEmptyEmployees(container);
                return;
            }
            
            displayEmployees(container, employees);
            
        } catch (error) {
            console.error('Error loading employees:', error);
            showEmployeesError(container, error);
        }
    };
    
    // Отображение списка сотрудников
    function displayEmployees(container, employees) {
        container.innerHTML = `
            <div style="display: grid; gap: 15px;">
                ${employees.map(emp => `
                    <div style="
                        background: var(--card-bg, rgba(255,255,255,0.1));
                        border-radius: 12px;
                        padding: 15px;
                        display: flex;
                        align-items: center;
                        gap: 15px;
                        backdrop-filter: blur(10px);
                        border: 1px solid rgba(255,255,255,0.1);
                    ">
                        <div style="
                            width: 50px;
                            height: 50px;
                            border-radius: 50%;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-weight: bold;
                            font-size: 18px;
                        ">
                            ${getInitials(emp.name)}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; margin-bottom: 4px;">${emp.name}</div>
                            <div style="color: var(--text-secondary); font-size: 14px;">
                                ${emp.position || 'Сотрудник'}
                            </div>
                        </div>
                        ${emp.telegramId ? `
                            <div style="
                                padding: 4px 8px;
                                background: rgba(0,255,0,0.1);
                                border: 1px solid rgba(0,255,0,0.3);
                                border-radius: 6px;
                                font-size: 12px;
                                color: #4CAF50;
                            ">
                                ✓ Active
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // Показать пустой список
    function showEmptyEmployees(container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 20px;">👥</div>
                <h3 style="margin-bottom: 10px;">Список сотрудников пуст</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">
                    Пока нет зарегистрированных сотрудников
                </p>
                <button onclick="loadEmployeesList()" style="
                    padding: 10px 20px;
                    background: var(--primary-color);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                ">
                    Обновить
                </button>
            </div>
        `;
    }
    
    // Показать ошибку
    function showEmployeesError(container, error) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 20px; color: #f44336;">⚠️</div>
                <h3 style="margin-bottom: 10px; color: #f44336;">Ошибка загрузки</h3>
                <p style="color: var(--text-secondary); margin-bottom: 10px;">
                    Не удалось загрузить список сотрудников
                </p>
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 20px;">
                    ${error.message}
                </p>
                <button onclick="loadEmployeesList()" style="
                    padding: 10px 20px;
                    background: var(--primary-color);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                ">
                    Попробовать снова
                </button>
            </div>
        `;
    }
    
    // Создать контейнер для сотрудников
    function createEmployeesContainer() {
        const section = document.getElementById('employees');
        if (!section) {
            console.error('Employees section not found');
            return;
        }
        
        // Создаем контейнер
        const container = document.createElement('div');
        container.id = 'employeesList';
        container.style.padding = '20px';
        section.appendChild(container);
        
        // Загружаем список
        loadEmployeesList();
    }
    
    // Получить инициалы
    function getInitials(name) {
        if (!name) return '??';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
    
    // Переопределяем глобальные функции если они есть
    if (typeof window.loadEmployees !== 'undefined') {
        window.originalLoadEmployees = window.loadEmployees;
    }
    window.loadEmployees = window.loadEmployeesList;
    
    // Автоматически загружаем при переходе на страницу сотрудников
    document.addEventListener('DOMContentLoaded', () => {
        // Проверяем, открыта ли страница сотрудников
        const employeesSection = document.getElementById('employees');
        if (employeesSection && employeesSection.classList.contains('active')) {
            setTimeout(() => loadEmployeesList(), 500);
        }
    });
    
    console.log('✅ Employees fix loaded');
})();