// КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ ДЛЯ TELEGRAM WEBAPP
(function() {
    console.log('🚨 CRITICAL FIX LOADING...');
    
    // 1. ИСПРАВЛЯЕМ ПОЛУЧЕНИЕ INITDATA
    function fixTelegramInit() {
        const tg = window.Telegram?.WebApp;
        if (!tg) {
            console.error('Telegram WebApp not found!');
            return;
        }
        
        // Проверяем разные источники initData
        if (!tg.initData) {
            console.warn('⚠️ No initData in Telegram.WebApp, checking alternatives...');
            
            // Пробуем получить из URL
            const urlParams = new URLSearchParams(window.location.search);
            const urlInitData = urlParams.get('tgWebAppData');
            if (urlInitData) {
                console.log('✅ Found initData in URL params');
                // Можно попробовать использовать
            }
            
            // Проверяем hash
            if (window.location.hash) {
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const hashInitData = hashParams.get('tgWebAppData');
                if (hashInitData) {
                    console.log('✅ Found initData in hash');
                }
            }
        }
        
        // Убеждаемся что WebApp готов
        tg.ready();
        tg.expand();
        
        console.log('📱 Telegram WebApp state:', {
            initData: tg.initData ? 'Present' : 'Missing',
            initDataUnsafe: tg.initDataUnsafe,
            platform: tg.platform,
            version: tg.version
        });
    }
    
    // 2. ИСПРАВЛЯЕМ ОТСУТСТВУЮЩИЕ ЭЛЕМЕНТЫ
    function fixMissingElements() {
        // Проверяем и создаем отсутствующие элементы
        const fixes = [
            { id: 'profileName', parent: 'profile', html: '<div id="profileName" style="display:none;"></div>' },
            { id: 'profilePosition', parent: 'profile', html: '<div id="profilePosition" style="display:none;"></div>' },
            { id: 'currentDateText', parent: 'dashboard', html: '<div id="currentDateText" style="display:none;"></div>' },
            { id: 'checkInBtn', parent: 'dashboard', html: '<button id="checkInBtn" style="display:none;">Check In</button>' },
            { id: 'checkOutBtn', parent: 'dashboard', html: '<button id="checkOutBtn" style="display:none;">Check Out</button>' }
        ];
        
        fixes.forEach(fix => {
            if (!document.getElementById(fix.id)) {
                const parent = document.getElementById(fix.parent) || document.body;
                const temp = document.createElement('div');
                temp.innerHTML = fix.html;
                parent.appendChild(temp.firstElementChild);
                console.log(`✅ Created missing element: ${fix.id}`);
            }
        });
    }
    
    // 3. ПЕРЕОПРЕДЕЛЯЕМ ПРОБЛЕМНЫЕ ФУНКЦИИ
    window.checkAttendanceStatus = async function() {
        console.log('🔄 checkAttendanceStatus (fixed version)');
        try {
            const tg = window.Telegram?.WebApp;
            const headers = {};
            
            // Добавляем initData если есть
            if (tg?.initData) {
                headers['X-Telegram-Init-Data'] = tg.initData;
            }
            
            // Добавляем test параметр если нужно
            const urlParams = new URLSearchParams(window.location.search);
            const isTest = urlParams.has('test');
            const url = `/api/attendance/today${isTest ? '?test=1' : ''}`;
            
            const response = await fetch(url, { headers });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Attendance data:', data);
                
                // Безопасно обновляем UI
                const checkInBtn = document.getElementById('checkInBtn');
                const checkOutBtn = document.getElementById('checkOutBtn');
                
                if (checkInBtn) {
                    checkInBtn.disabled = data.isPresent;
                }
                if (checkOutBtn) {
                    checkOutBtn.disabled = !data.isPresent || !data.checkIn;
                }
            }
        } catch (error) {
            console.error('❌ Attendance check error:', error);
        }
    };
    
    // 4. ИСПРАВЛЯЕМ ЗАГРУЗКУ ПРОФИЛЯ
    window.loadProfile = async function() {
        console.log('🔄 loadProfile (fixed version)');
        try {
            const tg = window.Telegram?.WebApp;
            const headers = {};
            
            if (tg?.initData) {
                headers['X-Telegram-Init-Data'] = tg.initData;
            }
            
            const urlParams = new URLSearchParams(window.location.search);
            const isTest = urlParams.has('test');
            const url = `/api/profile${isTest ? '?test=1' : ''}`;
            
            const response = await fetch(url, { headers });
            
            if (response.ok) {
                const profile = await response.json();
                console.log('✅ Profile loaded:', profile);
                
                // Безопасно обновляем UI
                const nameEl = document.getElementById('profileName');
                const positionEl = document.getElementById('profilePosition');
                
                if (nameEl) nameEl.textContent = profile.name || 'Unknown';
                if (positionEl) positionEl.textContent = profile.position || 'Employee';
                
                // Сохраняем профиль глобально
                window.currentUserProfile = profile;
                
                return profile;
            }
        } catch (error) {
            console.error('❌ Profile load error:', error);
        }
    };
    
    // 5. ИСПРАВЛЯЕМ ЗАГРУЗКУ ЗАДАЧ
    window.loadTasksFixed = async function() {
        console.log('🔄 Loading tasks (fixed version)...');
        
        const tasksList = document.getElementById('tasksList');
        if (!tasksList) {
            console.warn('Tasks list container not found');
            return;
        }
        
        try {
            const tg = window.Telegram?.WebApp;
            const headers = {};
            
            if (tg?.initData) {
                headers['X-Telegram-Init-Data'] = tg.initData;
            }
            
            const urlParams = new URLSearchParams(window.location.search);
            const isTest = urlParams.has('test');
            const url = `/api/tasks/my${isTest ? '?test=1' : ''}`;
            
            console.log('Fetching tasks from:', url);
            const response = await fetch(url, { headers });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const tasks = await response.json();
            console.log(`✅ Loaded ${tasks.length} tasks`);
            
            // Отображаем задачи
            if (tasks.length === 0) {
                tasksList.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <div style="font-size: 48px; margin-bottom: 20px;">📋</div>
                        <h3>Нет задач</h3>
                        <p style="color: var(--text-secondary);">У вас пока нет назначенных задач</p>
                    </div>
                `;
            } else {
                tasksList.innerHTML = tasks.map(task => `
                    <div style="
                        background: var(--card-bg, rgba(255,255,255,0.05));
                        border-radius: 12px;
                        padding: 16px;
                        margin-bottom: 12px;
                        border: 1px solid rgba(255,255,255,0.1);
                    ">
                        <h4 style="margin: 0 0 8px 0;">${task.title}</h4>
                        <p style="margin: 0 0 8px 0; color: var(--text-secondary); font-size: 14px;">
                            ${task.description || 'Без описания'}
                        </p>
                        <div style="display: flex; gap: 10px; font-size: 12px;">
                            <span style="
                                padding: 4px 8px;
                                background: ${task.status === 'Новая' ? 'rgba(33,150,243,0.2)' : 'rgba(76,175,80,0.2)'};
                                border-radius: 4px;
                            ">${task.status}</span>
                            <span style="
                                padding: 4px 8px;
                                background: ${task.priority === 'Высокий' ? 'rgba(244,67,54,0.2)' : 'rgba(255,193,7,0.2)'};
                                border-radius: 4px;
                            ">${task.priority}</span>
                        </div>
                    </div>
                `).join('');
            }
            
        } catch (error) {
            console.error('❌ Tasks load error:', error);
            tasksList.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 48px; margin-bottom: 20px; color: #f44336;">⚠️</div>
                    <h3>Ошибка загрузки</h3>
                    <p style="color: var(--text-secondary);">Не удалось загрузить задачи</p>
                    <button onclick="loadTasksFixed()" style="
                        margin-top: 20px;
                        padding: 10px 20px;
                        background: var(--primary-color);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                    ">Попробовать снова</button>
                </div>
            `;
        }
    };
    
    // 6. ПРИМЕНЯЕМ ИСПРАВЛЕНИЯ
    function applyFixes() {
        console.log('🔧 Applying critical fixes...');
        
        // Исправляем Telegram
        fixTelegramInit();
        
        // Исправляем отсутствующие элементы
        fixMissingElements();
        
        // Переопределяем loadTasks если она существует
        if (typeof window.loadTasks !== 'undefined') {
            window.originalLoadTasks = window.loadTasks;
            window.loadTasks = window.loadTasksFixed;
        }
        
        // Удаляем проблемный слушатель событий
        const problemListener = document.querySelector('.floating-actions');
        if (problemListener) {
            const newEl = problemListener.cloneNode(true);
            problemListener.parentNode.replaceChild(newEl, problemListener);
        }
        
        console.log('✅ Critical fixes applied!');
    }
    
    // Применяем исправления при загрузке
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyFixes);
    } else {
        applyFixes();
    }
    
    // Экспортируем функции глобально
    window.loadTasksFixed = loadTasksFixed;
    
    console.log('✅ CRITICAL FIX LOADED');
})();