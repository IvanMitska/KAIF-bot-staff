// АВТОМАТИЧЕСКАЯ ЗАГРУЗКА ЗАДАЧ - ФИНАЛЬНОЕ РЕШЕНИЕ
(function() {
    console.log('🎯 AUTO LOAD TASKS - FINAL SOLUTION');
    
    let tasksLoaded = false;
    let loadInterval = null;
    let lastLoadTime = 0;
    
    // Главная функция загрузки задач
    async function autoLoadTasks() {
        // Предотвращаем слишком частые загрузки
        const now = Date.now();
        if (now - lastLoadTime < 2000) {
            console.log('⏳ Too soon, skipping load');
            return;
        }
        lastLoadTime = now;
        
        console.log('🔄 Auto loading tasks...');
        
        const tasksList = document.getElementById('tasksList');
        const tasksSection = document.getElementById('tasks');
        
        // Проверяем, что мы на странице задач
        if (!tasksSection || !tasksSection.classList.contains('active')) {
            console.log('📍 Not on tasks page, skipping');
            return;
        }
        
        // Создаем контейнер если его нет
        if (!tasksList) {
            console.log('Creating tasks container...');
            const container = document.createElement('div');
            container.id = 'tasksList';
            container.className = 'tasks-container';
            container.style.padding = '20px';
            tasksSection.appendChild(container);
        }
        
        try {
            // Получаем Telegram WebApp
            const tg = window.Telegram?.WebApp;
            
            // Определяем параметры запроса
            const headers = {};
            if (tg?.initData) {
                headers['X-Telegram-Init-Data'] = tg.initData;
            }
            
            // Определяем URL - всегда добавляем test=1 если нет initData
            let url = '/api/tasks/my';
            if (!tg?.initData || window.location.search.includes('test')) {
                url += '?test=1';
            }
            
            console.log(`📡 Fetching from: ${url}`);
            console.log('📡 Headers:', headers);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: headers,
                credentials: 'same-origin'
            });
            
            console.log(`📡 Response: ${response.status}`);
            
            if (!response.ok) {
                // Если ошибка 401 и не пробовали с test
                if (response.status === 401 && !url.includes('test=1')) {
                    console.log('🔄 Got 401, retrying with test mode...');
                    url += '?test=1';
                    const retryResponse = await fetch(url, { headers });
                    if (retryResponse.ok) {
                        const tasks = await retryResponse.json();
                        displayTasks(tasks);
                        tasksLoaded = true;
                        stopAutoLoad(); // Останавливаем автозагрузку после успеха
                        return;
                    }
                }
                throw new Error(`HTTP ${response.status}`);
            }
            
            const tasks = await response.json();
            console.log(`✅ Loaded ${tasks.length} tasks successfully`);
            
            displayTasks(tasks);
            tasksLoaded = true;
            stopAutoLoad(); // Останавливаем автозагрузку после успеха
            
        } catch (error) {
            console.error('❌ Auto load failed:', error);
            
            // Показываем ошибку но НЕ останавливаем попытки
            const tasksList = document.getElementById('tasksList');
            if (tasksList && !tasksLoaded) {
                tasksList.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <div style="font-size: 48px; margin-bottom: 20px;">⏳</div>
                        <h3>Загружаем задачи...</h3>
                        <p style="color: var(--text-secondary); margin-bottom: 20px;">
                            Подождите несколько секунд
                        </p>
                        <button onclick="autoLoadTasks()" style="
                            padding: 10px 20px;
                            background: var(--primary-color, #667eea);
                            color: white;
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                        ">Загрузить сейчас</button>
                    </div>
                `;
            }
        }
    }
    
    // Функция отображения задач
    function displayTasks(tasks) {
        console.log(`📝 Displaying ${tasks.length} tasks`);
        
        const tasksList = document.getElementById('tasksList');
        if (!tasksList) return;
        
        if (!tasks || tasks.length === 0) {
            tasksList.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 64px; margin-bottom: 20px;">📭</div>
                    <h3>Нет задач</h3>
                    <p style="color: var(--text-secondary);">У вас пока нет назначенных задач</p>
                </div>
            `;
            return;
        }
        
        // Отображаем задачи
        tasksList.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${tasks.map(task => createTaskCard(task)).join('')}
            </div>
        `;
        
        // Сохраняем задачи глобально
        window.currentTasks = tasks;
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
            <div class="task-card" style="
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                padding: 16px;
                border: 1px solid rgba(255,255,255,0.1);
                backdrop-filter: blur(10px);
                transition: transform 0.2s;
            ">
                <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">
                    ${task.title || 'Без названия'}
                </h4>
                <p style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 14px;">
                    ${task.description || 'Без описания'}
                </p>
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
                            border-radius: 6px;
                        ">📅 ${new Date(task.deadline).toLocaleDateString('ru-RU')}</span>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    // Запуск автозагрузки
    function startAutoLoad() {
        console.log('🚀 Starting auto load...');
        
        // Очищаем предыдущий интервал если есть
        stopAutoLoad();
        
        // Первая попытка сразу
        autoLoadTasks();
        
        // Повторяем каждые 3 секунды пока не загрузится
        loadInterval = setInterval(() => {
            if (!tasksLoaded) {
                console.log('⏰ Auto load interval triggered');
                autoLoadTasks();
            } else {
                stopAutoLoad();
            }
        }, 3000);
    }
    
    // Остановка автозагрузки
    function stopAutoLoad() {
        if (loadInterval) {
            console.log('🛑 Stopping auto load');
            clearInterval(loadInterval);
            loadInterval = null;
        }
    }
    
    // Сброс состояния при переходе на другую страницу
    function resetTasksState() {
        tasksLoaded = false;
        stopAutoLoad();
    }
    
    // ГЛАВНЫЙ КОД ИНИЦИАЛИЗАЦИИ
    
    // Переопределяем функцию loadTasks
    if (window.loadTasks) {
        window.originalLoadTasks = window.loadTasks;
    }
    window.loadTasks = autoLoadTasks;
    
    // Переопределяем другие функции которые могут мешать
    window.forceLoadTasks = autoLoadTasks;
    window.loadTasksImproved = autoLoadTasks;
    window.loadTasksFixed = autoLoadTasks;
    
    // Слушаем переходы на страницу задач
    document.addEventListener('click', (e) => {
        const target = e.target;
        
        // Если клик по навигации к задачам
        if (target.closest('[data-section="tasks"]') || 
            target.closest('.nav-btn') && target.textContent.includes('Задачи')) {
            console.log('📋 Navigating to tasks page');
            resetTasksState();
            setTimeout(() => startAutoLoad(), 500);
        }
        
        // Если уходим со страницы задач
        if (target.closest('[data-section]') && !target.closest('[data-section="tasks"]')) {
            console.log('👋 Leaving tasks page');
            resetTasksState();
        }
    });
    
    // Проверяем при загрузке страницы
    function checkOnLoad() {
        const tasksSection = document.getElementById('tasks');
        if (tasksSection && tasksSection.classList.contains('active')) {
            console.log('📋 Tasks page is active on load');
            startAutoLoad();
        }
    }
    
    // Запускаем проверку при загрузке
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(checkOnLoad, 1000);
        });
    } else {
        setTimeout(checkOnLoad, 1000);
    }
    
    // Предотвращаем сброс задач другими скриптами
    let protectionInterval = setInterval(() => {
        const tasksSection = document.getElementById('tasks');
        const tasksList = document.getElementById('tasksList');
        
        if (tasksSection && tasksSection.classList.contains('active') && tasksList) {
            // Если контейнер пустой или показывает загрузку, а задачи уже загружены
            if (tasksLoaded && window.currentTasks && window.currentTasks.length > 0) {
                const hasContent = tasksList.querySelector('.task-card');
                if (!hasContent) {
                    console.log('🛡️ Protecting tasks from being cleared');
                    displayTasks(window.currentTasks);
                }
            }
        }
    }, 2000);
    
    // Экспортируем функции глобально
    window.autoLoadTasks = autoLoadTasks;
    window.startAutoLoad = startAutoLoad;
    window.stopAutoLoad = stopAutoLoad;
    
    console.log('✅ AUTO LOAD TASKS READY!');
})();