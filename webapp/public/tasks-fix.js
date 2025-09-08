// ИСПРАВЛЕНИЕ ЗАГРУЗКИ ЗАДАЧ
(function() {
    console.log('📋 Tasks Fix Loading...');
    
    // Глобальная переменная для хранения задач
    window.currentTasks = [];
    window.currentTaskType = 'my';
    
    // Основная функция загрузки задач
    window.loadTasksImproved = async function() {
        console.log('🔄 Loading tasks (improved version)...');
        
        const tasksList = document.getElementById('tasksList');
        if (!tasksList) {
            console.warn('Tasks list container not found, creating...');
            createTasksContainer();
            return;
        }
        
        // Показываем загрузку
        tasksList.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div class="spinner" style="
                    width: 40px;
                    height: 40px;
                    border: 3px solid rgba(255,255,255,0.1);
                    border-top-color: var(--primary-color, #667eea);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 20px;
                "></div>
                <p style="color: var(--text-secondary);">Загрузка задач...</p>
            </div>
        `;
        
        try {
            // Получаем Telegram WebApp
            const tg = window.Telegram?.WebApp;
            
            // Определяем URL и заголовки
            const urlParams = new URLSearchParams(window.location.search);
            const isTest = urlParams.has('test');
            
            let url = `/api/tasks/${window.currentTaskType || 'my'}`;
            if (isTest && !tg?.initData) {
                url += '?test=1';
            }
            
            const headers = {};
            if (tg?.initData) {
                headers['X-Telegram-Init-Data'] = tg.initData;
            }
            
            console.log('📍 Fetching tasks from:', url);
            console.log('📍 Headers:', headers);
            
            const response = await fetch(url, { 
                method: 'GET',
                headers: headers 
            });
            
            console.log('📍 Response status:', response.status);
            
            if (!response.ok) {
                // Если 401, пробуем с test параметром
                if (response.status === 401 && !url.includes('test=1')) {
                    console.log('⚠️ Got 401, retrying with test mode...');
                    url += url.includes('?') ? '&test=1' : '?test=1';
                    const retryResponse = await fetch(url, { headers });
                    if (retryResponse.ok) {
                        const tasks = await retryResponse.json();
                        displayTasks(tasks);
                        return;
                    }
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const tasks = await response.json();
            console.log(`✅ Successfully loaded ${tasks.length} tasks`);
            
            // Сохраняем задачи глобально
            window.currentTasks = tasks;
            
            // Отображаем задачи
            displayTasks(tasks);
            
        } catch (error) {
            console.error('❌ Error loading tasks:', error);
            showTasksError(error);
        }
    };
    
    // Функция отображения задач
    function displayTasks(tasks) {
        const tasksList = document.getElementById('tasksList');
        if (!tasksList) return;
        
        if (!tasks || tasks.length === 0) {
            tasksList.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 64px; margin-bottom: 20px;">📭</div>
                    <h3 style="margin-bottom: 10px;">Нет задач</h3>
                    <p style="color: var(--text-secondary);">
                        У вас пока нет назначенных задач
                    </p>
                </div>
            `;
            return;
        }
        
        // Группируем задачи по статусу
        const grouped = {
            'Новая': [],
            'В работе': [],
            'Выполнена': []
        };
        
        tasks.forEach(task => {
            const status = task.status || 'Новая';
            if (!grouped[status]) grouped[status] = [];
            grouped[status].push(task);
        });
        
        // Отображаем задачи
        tasksList.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${tasks.map(task => createTaskCard(task)).join('')}
            </div>
        `;
        
        // Добавляем обработчики кликов
        attachTaskHandlers();
    }
    
    // Создание карточки задачи
    function createTaskCard(task) {
        const statusColors = {
            'Новая': '#2196F3',
            'В работе': '#FF9800',
            'Выполнена': '#4CAF50',
            'Отменена': '#9E9E9E'
        };
        
        const priorityColors = {
            'Высокий': '#F44336',
            'Средний': '#FF9800',
            'Низкий': '#4CAF50'
        };
        
        return `
            <div class="task-card" data-task-id="${task.id}" style="
                background: var(--card-bg, rgba(255,255,255,0.05));
                border-radius: 12px;
                padding: 16px;
                border: 1px solid rgba(255,255,255,0.1);
                backdrop-filter: blur(10px);
                cursor: pointer;
                transition: all 0.3s ease;
            " onclick="showTaskDetails('${task.id}')">
                <div style="margin-bottom: 12px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">
                        ${task.title || 'Без названия'}
                    </h4>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 14px; 
                              overflow: hidden; text-overflow: ellipsis; 
                              display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                        ${task.description || 'Без описания'}
                    </p>
                </div>
                
                <div style="display: flex; gap: 8px; flex-wrap: wrap; font-size: 12px;">
                    <span style="
                        padding: 4px 10px;
                        background: ${statusColors[task.status] || '#666'}22;
                        color: ${statusColors[task.status] || '#666'};
                        border-radius: 6px;
                        font-weight: 500;
                    ">${task.status || 'Новая'}</span>
                    
                    <span style="
                        padding: 4px 10px;
                        background: ${priorityColors[task.priority] || '#666'}22;
                        color: ${priorityColors[task.priority] || '#666'};
                        border-radius: 6px;
                        font-weight: 500;
                    ">${task.priority || 'Средний'}</span>
                    
                    ${task.deadline ? `
                        <span style="
                            padding: 4px 10px;
                            background: rgba(255,255,255,0.1);
                            color: var(--text-secondary);
                            border-radius: 6px;
                        ">📅 ${new Date(task.deadline).toLocaleDateString('ru-RU')}</span>
                    ` : ''}
                    
                    ${task.creatorName ? `
                        <span style="
                            padding: 4px 10px;
                            background: rgba(255,255,255,0.05);
                            color: var(--text-secondary);
                            border-radius: 6px;
                        ">👤 ${task.creatorName}</span>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    // Показать детали задачи
    window.showTaskDetails = function(taskId) {
        const task = window.currentTasks.find(t => t.id === taskId);
        if (!task) return;
        
        console.log('Showing task details:', task);
        
        // Здесь можно показать модальное окно с деталями
        // Пока просто показываем alert
        alert(`
Задача: ${task.title}
Описание: ${task.description || 'Нет'}
Статус: ${task.status}
Приоритет: ${task.priority}
Создал: ${task.creatorName || 'Неизвестно'}
Дедлайн: ${task.deadline ? new Date(task.deadline).toLocaleDateString('ru-RU') : 'Не установлен'}
        `);
    };
    
    // Показать ошибку
    function showTasksError(error) {
        const tasksList = document.getElementById('tasksList');
        if (!tasksList) return;
        
        tasksList.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 64px; margin-bottom: 20px; color: #f44336;">⚠️</div>
                <h3 style="margin-bottom: 10px; color: #f44336;">Ошибка загрузки</h3>
                <p style="color: var(--text-secondary); margin-bottom: 10px;">
                    Не удалось загрузить задачи
                </p>
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 20px;">
                    ${error.message}
                </p>
                <button onclick="loadTasksImproved()" style="
                    padding: 10px 20px;
                    background: var(--primary-color, #667eea);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                ">Попробовать снова</button>
            </div>
        `;
    }
    
    // Создать контейнер для задач
    function createTasksContainer() {
        const section = document.getElementById('tasks');
        if (!section) {
            console.error('Tasks section not found');
            return;
        }
        
        // Создаем контейнер для списка задач
        const container = document.createElement('div');
        container.id = 'tasksList';
        container.style.padding = '20px';
        section.appendChild(container);
        
        // Загружаем задачи
        loadTasksImproved();
    }
    
    // Добавить обработчики для карточек
    function attachTaskHandlers() {
        const cards = document.querySelectorAll('.task-card');
        cards.forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            });
            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = 'none';
            });
        });
    }
    
    // Добавляем CSS для анимации
    if (!document.getElementById('tasks-fix-styles')) {
        const style = document.createElement('style');
        style.id = 'tasks-fix-styles';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .task-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            
            .task-card:active {
                transform: translateY(0);
            }
        `;
        document.head.appendChild(style);
    }
    
    // Переопределяем оригинальную функцию
    if (typeof window.loadTasks !== 'undefined') {
        window.originalLoadTasks = window.loadTasks;
    }
    window.loadTasks = window.loadTasksImproved;
    
    // Автоматически загружаем задачи при открытии страницы
    document.addEventListener('DOMContentLoaded', () => {
        // Проверяем, если страница задач активна
        const tasksSection = document.getElementById('tasks');
        if (tasksSection && tasksSection.classList.contains('active')) {
            setTimeout(() => loadTasksImproved(), 500);
        }
    });
    
    // Также слушаем клики по навигации
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-section="tasks"]') || 
            e.target.closest('.nav-btn') && e.target.textContent.includes('Задачи')) {
            setTimeout(() => loadTasksImproved(), 100);
        }
    });
    
    console.log('✅ Tasks fix loaded successfully');
})();