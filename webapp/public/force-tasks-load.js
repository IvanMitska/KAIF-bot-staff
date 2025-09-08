// ФОРСИРОВАННАЯ ЗАГРУЗКА ЗАДАЧ
(function() {
    console.log('🚀 FORCE TASKS LOAD STARTING...');
    
    // Ждем полной загрузки страницы
    function waitAndLoad() {
        const tasksSection = document.getElementById('tasks');
        const tasksList = document.getElementById('tasksList');
        
        // Если мы на странице задач
        if (tasksSection && tasksSection.classList.contains('active')) {
            console.log('📋 Tasks page detected, forcing load...');
            
            // Создаем контейнер если его нет
            if (!tasksList) {
                const container = document.createElement('div');
                container.id = 'tasksList';
                container.style.padding = '20px';
                tasksSection.appendChild(container);
            }
            
            // Форсируем загрузку
            forceLoadTasks();
        }
    }
    
    // Основная функция загрузки
    async function forceLoadTasks() {
        console.log('⚡ FORCING TASKS LOAD...');
        
        const tasksList = document.getElementById('tasksList');
        if (!tasksList) {
            console.error('Tasks list not found!');
            return;
        }
        
        // Показываем что загружаем
        tasksList.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 24px; margin-bottom: 10px;">⏳</div>
                <p>Загружаем задачи...</p>
            </div>
        `;
        
        try {
            // Получаем Telegram WebApp
            const tg = window.Telegram?.WebApp;
            
            // Пробуем разные варианты URL
            const urls = [
                '/api/tasks/my',
                '/api/tasks/my?test=1',
                `${window.location.origin}/api/tasks/my`,
                `${window.location.origin}/api/tasks/my?test=1`
            ];
            
            let tasks = null;
            let successUrl = null;
            
            // Пробуем каждый URL
            for (const url of urls) {
                console.log(`🔍 Trying: ${url}`);
                
                try {
                    const headers = {};
                    if (tg?.initData) {
                        headers['X-Telegram-Init-Data'] = tg.initData;
                    }
                    
                    const response = await fetch(url, { 
                        method: 'GET',
                        headers: headers,
                        credentials: 'same-origin'
                    });
                    
                    console.log(`Response from ${url}: ${response.status}`);
                    
                    if (response.ok) {
                        tasks = await response.json();
                        successUrl = url;
                        console.log(`✅ SUCCESS! Got ${tasks.length} tasks from ${url}`);
                        break;
                    }
                } catch (err) {
                    console.error(`Failed ${url}:`, err);
                }
            }
            
            // Если получили задачи
            if (tasks && Array.isArray(tasks)) {
                console.log(`📋 Displaying ${tasks.length} tasks`);
                
                if (tasks.length === 0) {
                    tasksList.innerHTML = `
                        <div style="text-align: center; padding: 60px 20px;">
                            <div style="font-size: 64px; margin-bottom: 20px;">📭</div>
                            <h3>Нет задач</h3>
                            <p style="color: var(--text-secondary);">У вас пока нет назначенных задач</p>
                        </div>
                    `;
                } else {
                    // Отображаем задачи
                    tasksList.innerHTML = `
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            ${tasks.map(task => `
                                <div style="
                                    background: rgba(255,255,255,0.05);
                                    border-radius: 12px;
                                    padding: 16px;
                                    border: 1px solid rgba(255,255,255,0.1);
                                ">
                                    <h4 style="margin: 0 0 8px 0; font-size: 16px;">
                                        ${task.title || 'Без названия'}
                                    </h4>
                                    <p style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 14px;">
                                        ${task.description || 'Без описания'}
                                    </p>
                                    <div style="display: flex; gap: 8px; flex-wrap: wrap; font-size: 12px;">
                                        <span style="
                                            padding: 4px 10px;
                                            background: ${getStatusColor(task.status)}22;
                                            color: ${getStatusColor(task.status)};
                                            border-radius: 6px;
                                        ">${task.status || 'Новая'}</span>
                                        <span style="
                                            padding: 4px 10px;
                                            background: ${getPriorityColor(task.priority)}22;
                                            color: ${getPriorityColor(task.priority)};
                                            border-radius: 6px;
                                        ">${task.priority || 'Средний'}</span>
                                        ${task.deadline ? `
                                            <span style="
                                                padding: 4px 10px;
                                                background: rgba(255,255,255,0.1);
                                                border-radius: 6px;
                                            ">📅 ${formatDate(task.deadline)}</span>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                }
                
                // Сохраняем URL который сработал
                window.workingTasksUrl = successUrl;
                
            } else {
                throw new Error('Не удалось загрузить задачи ни одним способом');
            }
            
        } catch (error) {
            console.error('❌ FORCE LOAD FAILED:', error);
            
            // Показываем тестовые данные для проверки UI
            tasksList.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 48px; margin-bottom: 20px; color: #f44336;">⚠️</div>
                    <h3 style="color: #f44336;">Не удалось загрузить задачи</h3>
                    <p style="margin: 20px 0;">${error.message}</p>
                    <button onclick="location.reload()" style="
                        padding: 10px 20px;
                        background: var(--primary-color, #667eea);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                    ">Перезагрузить страницу</button>
                    
                    <div style="margin-top: 30px; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 8px; text-align: left;">
                        <h4>Информация для отладки:</h4>
                        <p style="font-size: 12px; font-family: monospace;">
                            Platform: ${window.Telegram?.WebApp?.platform || 'Unknown'}<br>
                            InitData: ${window.Telegram?.WebApp?.initData ? 'Present' : 'Missing'}<br>
                            User: ${JSON.stringify(window.Telegram?.WebApp?.initDataUnsafe?.user || {})}<br>
                            URL: ${window.location.href}
                        </p>
                    </div>
                </div>
            `;
        }
    }
    
    // Вспомогательные функции
    function getStatusColor(status) {
        const colors = {
            'Новая': '#2196F3',
            'В работе': '#FF9800', 
            'Выполнена': '#4CAF50',
            'Отменена': '#9E9E9E'
        };
        return colors[status] || '#666';
    }
    
    function getPriorityColor(priority) {
        const colors = {
            'Высокий': '#F44336',
            'Средний': '#FF9800',
            'Низкий': '#4CAF50'
        };
        return colors[priority] || '#666';
    }
    
    function formatDate(dateStr) {
        try {
            return new Date(dateStr).toLocaleDateString('ru-RU');
        } catch {
            return dateStr;
        }
    }
    
    // Переопределяем кнопку "Попробовать снова"
    window.retryLoadTasks = forceLoadTasks;
    
    // Запускаем при загрузке
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(waitAndLoad, 1000);
        });
    } else {
        setTimeout(waitAndLoad, 1000);
    }
    
    // Слушаем переходы на страницу задач
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target.closest('[data-section="tasks"]') || 
            target.closest('.nav-btn') && target.textContent.includes('Задачи') ||
            target.textContent === 'Попробовать снова') {
            setTimeout(waitAndLoad, 500);
        }
    });
    
    // Экспортируем функцию глобально
    window.forceLoadTasks = forceLoadTasks;
    
    console.log('✅ FORCE TASKS LOAD READY');
})();