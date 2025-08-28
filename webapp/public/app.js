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
    console.log('=== DOMContentLoaded ===');
    
    // Показываем имя пользователя из Telegram
    if (tg.initDataUnsafe.user) {
        document.getElementById('userName').textContent = tg.initDataUnsafe.user.first_name;
    }
    
    // Инициализируем кнопки учета времени по умолчанию
    const checkOutBtn = document.getElementById('checkOutBtn');
    if (checkOutBtn) {
        checkOutBtn.disabled = true;
        console.log('CheckOut button initially disabled');
    }
    
    // Инициализируем современный UI
    initializeModernUI();
    
    // Загружаем профиль
    await loadProfile();
    
    // Проверяем статус отчета
    await checkReportStatus();
    
    // Проверяем статус рабочего времени
    console.log('Calling checkAttendanceStatus from DOMContentLoaded...');
    await checkAttendanceStatus();
    
    // Дополнительная проверка через секунду
    setTimeout(async () => {
        console.log('Rechecking attendance status after 1 second...');
        await checkAttendanceStatus();
    }, 1000);
    
    // Периодическая проверка состояния кнопок каждые 3 секунды
    setInterval(async () => {
        const checkInBtn = document.getElementById('checkInBtn');
        const checkOutBtn = document.getElementById('checkOutBtn');
        
        if (checkInBtn && checkInBtn.classList.contains('active') && 
            checkOutBtn && checkOutBtn.disabled) {
            console.log('Periodic check: trying to enable checkout button...');
            await window.checkAndEnableCheckOut();
        }
    }, 3000);
    
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
    
    // Инициализация навигационного индикатора
    setTimeout(() => {
        const activeBtn = document.querySelector('.nav-btn.active');
        if (activeBtn) {
            updateNavIndicator(activeBtn);
        }
    }, 100);
});

// Инициализация современного UI с расширенными анимациями
function initializeModernUI() {
    // Инициализация Lucide иконок
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // Фоновая анимация удалена для предотвращения полосок по краям
    
    // Добавляем ripple эффект ко всем кнопкам
    addRippleEffect();
    
    // Инициализируем анимации карточек
    initializeCardAnimations();
    
    // Добавляем hover эффекты
    addHoverEffects();
    
    // Инициализация scroll анимаций
    initializeScrollAnimations();
    
    // Инициализация stagger анимаций
    initializeStaggerAnimations();
    
    // Добавляем floating анимации к иконкам
    initializeFloatingAnimations();
    
    console.log('Enhanced Modern UI initialized');
}

// Инициализация scroll анимаций
function initializeScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                entry.target.style.animationDelay = `${Math.random() * 0.3}s`;
            }
        });
    }, observerOptions);
    
    // Добавляем классы для анимации к карточкам
    setTimeout(() => {
        document.querySelectorAll('.action-card.modern, .stat-card.modern, .task-item.modern').forEach((el, index) => {
            el.classList.add('animate-on-scroll');
            el.style.setProperty('--stagger-index', index);
            observer.observe(el);
        });
    }, 100);
}

// Инициализация stagger анимаций
function initializeStaggerAnimations() {
    const staggerContainers = document.querySelectorAll('.action-grid, .stats-grid.modern, .tasks-container');
    
    staggerContainers.forEach(container => {
        container.classList.add('stagger-children');
        const children = container.children;
        for (let i = 0; i < children.length; i++) {
            children[i].style.setProperty('--stagger-delay', '0.1s');
            children[i].style.setProperty('--stagger-index', i);
        }
    });
}

// Floating анимации для иконок
function initializeFloatingAnimations() {
    // Добавляем floating анимацию к FAB кнопке
    const fabMain = document.querySelector('.fab-main');
    if (fabMain && !fabMain.classList.contains('floating-animation')) {
        fabMain.classList.add('floating-animation');
    }
    
    // Добавляем subtle floating к иконкам в навигации
    document.querySelectorAll('.nav-icon-wrapper').forEach((icon, index) => {
        icon.style.animationDelay = `${index * 0.5}s`;
        icon.style.animation = 'floatingElement 4s ease-in-out infinite';
    });
}

// Добавление ripple эффекта
function addRippleEffect() {
    document.addEventListener('click', (e) => {
        const button = e.target.closest('.attendance-btn.modern, .submit-btn.modern, .fab-main, .action-card.modern');
        if (button) {
            createRipple(e, button);
        }
    });
}

// Создание улучшенного ripple эффекта
function createRipple(event, element) {
    const ripple = document.createElement('div');
    ripple.className = 'btn-ripple';
    
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.5;
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    
    element.appendChild(ripple);
    
    // Добавляем легкую вибрацию если поддерживается
    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
    
    setTimeout(() => {
        ripple.remove();
    }, 800);
}

// Инициализация анимаций карточек
function initializeCardAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0) scale(1)';
            }
        });
    }, observerOptions);
    
    // Наблюдаем за карточками
    document.querySelectorAll('.action-card.modern, .stat-card.modern, .task-item.modern').forEach((card) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px) scale(0.95)';
        card.style.transition = 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        observer.observe(card);
    });
}

// Добавление улучшенных hover эффектов
function addHoverEffects() {
    // Эффект следования за курсором для кнопок учета времени
    document.querySelectorAll('.attendance-btn.modern').forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            btn.style.setProperty('--mouse-x', `${x}%`);
            btn.style.setProperty('--mouse-y', `${y}%`);
        });
    });
    
    // Улучшенный параллакс эффект для карточек
    document.querySelectorAll('.action-card.modern').forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transition = 'transform 0.1s ease-out';
        });
        
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 12;
            const rotateY = (centerX - x) / 12;
            
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px) scale(1.03)`;
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transition = 'all var(--transition-normal)';
            card.style.transform = '';
        });
    });
    
    // Добавляем hover анимации к навигационным кнопкам
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            if (!btn.classList.contains('active')) {
                btn.style.animation = 'bounceIn 0.4s ease-out';
            }
        });
        
        btn.addEventListener('animationend', () => {
            btn.style.animation = '';
        });
    });
}

// Анимированное обновление счетчика
function animateCounterUpdate(element, newValue) {
    const currentValue = parseInt(element.textContent) || 0;
    if (currentValue === newValue) return;
    
    const duration = 500;
    const steps = 30;
    const stepValue = (newValue - currentValue) / steps;
    let currentStep = 0;
    
    const interval = setInterval(() => {
        currentStep++;
        const value = Math.round(currentValue + (stepValue * currentStep));
        element.textContent = value;
        
        if (currentStep >= steps) {
            element.textContent = newValue;
            clearInterval(interval);
            
            // Добавляем пульсацию если значение увеличилось
            if (newValue > currentValue) {
                element.style.transform = 'scale(1.2)';
                element.style.color = 'var(--primary)';
                setTimeout(() => {
                    element.style.transform = '';
                    element.style.color = '';
                }, 300);
            }
        }
    }, duration / steps);
}

// Навигация между страницами
function showPage(pageId) {
    const currentPage = document.querySelector('.page.active');
    const targetPage = document.getElementById(pageId);
    
    if (!targetPage) return;
    
    // Анимация выхода для текущей страницы
    if (currentPage && currentPage !== targetPage) {
        currentPage.classList.add('animate-out');
        setTimeout(() => {
            currentPage.classList.remove('active', 'animate-out');
        }, 300);
    }
    
    // Анимация входа для новой страницы
    setTimeout(() => {
        targetPage.classList.add('active', 'animate-in');
        
        // Добавляем stagger анимацию к дочерним элементам
        const staggerElements = targetPage.querySelectorAll('.action-card.modern, .stat-card.modern, .task-item.modern');
        staggerElements.forEach((el, index) => {
            el.style.animationDelay = `${index * 0.1}s`;
            el.style.animation = 'fadeInUp 0.6s ease-out forwards';
        });
        
        setTimeout(() => {
            targetPage.classList.remove('animate-in');
            staggerElements.forEach(el => {
                el.style.animation = '';
                el.style.animationDelay = '';
            });
        }, 600);
    }, currentPage ? 150 : 0);
    
    // Обновляем навигацию
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Находим соответствующую кнопку навигации по data-page атрибуту
    const activeNavBtn = document.querySelector(`[data-page="${pageId}"]`);
    if (activeNavBtn) {
        activeNavBtn.classList.add('active');
        
        // Обновляем позицию индикатора навигации
        updateNavIndicator(activeNavBtn);
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
    
    // Переинициализируем Lucide иконки для новой страницы
    if (window.lucide) {
        lucide.createIcons();
    }
}

// Обновление позиции индикатора навигации
function updateNavIndicator(activeBtn) {
    const indicator = document.querySelector('.nav-indicator');
    const navBtns = document.querySelectorAll('.nav-btn');
    const index = Array.from(navBtns).indexOf(activeBtn);
    
    if (indicator && index !== -1) {
        const percentage = (index * 100) / navBtns.length;
        indicator.style.left = `${percentage}%`;
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
                const currentTelegramId = tg.initDataUnsafe.user?.id;
                const isManager = currentTelegramId && MANAGER_IDS.includes(currentTelegramId);
                
                console.log('User initialization - Telegram ID:', currentTelegramId, 'isManager:', isManager);
                
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
                window.currentTelegramId = currentTelegramId;
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
            
            // Анимированное обновление счетчика
            const activeTasksElement = document.getElementById('activeTasksCount');
            if (activeTasksElement) {
                animateCounterUpdate(activeTasksElement, activeTasks);
            }
            
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
    // Обновляем бейдж на кнопке навигации (новая версия с правильным селектором)
    const taskNavBtn = document.querySelector('[data-page="tasks"]');
    if (taskNavBtn) {
        const iconWrapper = taskNavBtn.querySelector('.nav-icon-wrapper');
        let badge = iconWrapper ? iconWrapper.querySelector('.nav-badge') : null;
        
        if (count > 0) {
            if (!badge && iconWrapper) {
                badge = document.createElement('span');
                badge.className = 'nav-badge';
                badge.id = 'tasksBadge';
                iconWrapper.appendChild(badge);
            }
            if (badge) {
                badge.textContent = count;
                badge.style.display = 'block';
                
                // Анимация появления бейджа
                badge.style.transform = 'scale(0)';
                setTimeout(() => {
                    badge.style.transform = 'scale(1)';
                }, 100);
            }
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

// Фильтрация задач с анимациями
function filterTasks(filter) {
    currentFilter = filter;
    
    // Обновляем активную кнопку с анимацией
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn === event.target) {
            btn.style.animation = 'bounceIn 0.4s ease-out';
        }
    });
    event.target.classList.add('active');
    
    // Анимация исчезновения текущих задач
    const tasksContainer = document.querySelector('.tasks-container');
    if (tasksContainer) {
        tasksContainer.style.opacity = '0';
        tasksContainer.style.transform = 'translateY(20px)';
    }
    
    // Перезагружаем задачи с задержкой для плавности
    setTimeout(() => {
        loadTasks();
        if (tasksContainer) {
            tasksContainer.style.transition = 'all 0.4s ease-out';
            tasksContainer.style.opacity = '1';
            tasksContainer.style.transform = 'translateY(0)';
        }
    }, 200);
    
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

// Функции учета рабочего времени
async function checkAttendanceStatus() {
    console.log('=== checkAttendanceStatus called ===');
    try {
        const response = await fetch(`${API_URL}/api/attendance/today`, {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        
        console.log('Attendance response status:', response.status);
        
        if (response.ok) {
            const attendance = await response.json();
            console.log('Attendance data received:', attendance);
            
            const statusItem = document.getElementById('attendanceStatusItem');
            const checkInBtn = document.getElementById('checkInBtn');
            const checkOutBtn = document.getElementById('checkOutBtn');
            const checkInTime = document.getElementById('checkInTime');
            const checkOutTime = document.getElementById('checkOutTime');
            
            console.log('Button elements:', {
                checkInBtn: checkInBtn ? 'found' : 'not found',
                checkOutBtn: checkOutBtn ? 'found' : 'not found'
            });
            
            if (attendance) {
                console.log('Attendance exists:', {
                    checkIn: attendance.checkIn,
                    checkOut: attendance.checkOut,
                    status: attendance.status
                });
                if (attendance.checkIn) {
                    // Сотрудник пришел
                    const checkInDate = new Date(attendance.checkIn);
                    const timeStr = checkInDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                    
                    checkInBtn.disabled = true;
                    checkInBtn.classList.add('active');
                    checkInBtn.classList.add('checked-in');
                    checkInTime.textContent = timeStr;
                    checkInTime.style.display = 'block';
                    
                    if (attendance.checkOut) {
                        // Сотрудник ушел
                        const checkOutDate = new Date(attendance.checkOut);
                        const timeStr = checkOutDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                        
                        checkOutBtn.disabled = true;
                        checkOutBtn.classList.add('active');
                        checkOutTime.textContent = timeStr;
                        checkOutTime.style.display = 'block';
                        
                        statusItem.className = 'status-item status-success';
                        statusItem.innerHTML = `
                            <span class="status-icon">✅</span>
                            <span class="status-text">Рабочий день завершен (${attendance.workHours} ч)</span>
                        `;
                    } else {
                        // На работе
                        console.log('Setting checkOut button to ENABLED (no checkOut time)');
                        checkOutBtn.classList.add('force-enabled'); // Добавляем класс принудительной активации
                        checkOutBtn.disabled = false;
                        checkOutBtn.removeAttribute('disabled');
                        checkOutBtn.classList.remove('disabled');
                        checkOutBtn.style.opacity = '1';
                        checkOutBtn.style.cursor = 'pointer';
                        checkOutBtn.style.pointerEvents = 'auto';
                        
                        statusItem.className = 'status-item status-success';
                        statusItem.innerHTML = `
                            <span class="status-icon">🟢</span>
                            <span class="status-text">На работе с ${timeStr}</span>
                        `;
                        
                        console.log('CheckOut button state after update:', {
                            disabled: checkOutBtn.disabled,
                            hasDisabledAttr: checkOutBtn.hasAttribute('disabled'),
                            classList: checkOutBtn.className,
                            style: {
                                opacity: checkOutBtn.style.opacity,
                                cursor: checkOutBtn.style.cursor,
                                pointerEvents: checkOutBtn.style.pointerEvents
                            }
                        });
                        
                        // Дополнительная попытка активации через небольшую задержку
                        setTimeout(() => {
                            console.log('Attempting force enable checkout after delay...');
                            window.forceEnableCheckOut();
                        }, 100);
                    }
                } else {
                    // Не пришел
                    console.log('No checkIn - disabling checkOut button');
                    checkInBtn.disabled = false;
                    checkOutBtn.disabled = true;
                    
                    statusItem.className = 'status-item status-warning';
                    statusItem.innerHTML = `
                        <span class="status-icon">⏰</span>
                        <span class="status-text">Не отмечен приход</span>
                    `;
                }
            } else {
                // Нет записи на сегодня
                console.log('No attendance record - disabling checkOut button');
                checkInBtn.disabled = false;
                checkOutBtn.disabled = true;
                
                statusItem.className = 'status-item status-warning';
                statusItem.innerHTML = `
                    <span class="status-icon">⏰</span>
                    <span class="status-text">Не отмечен приход</span>
                `;
            }
        }
    } catch (error) {
        console.error('Error checking attendance status:', error);
    }
}

// Вспомогательная функция: получить геолокацию пользователя
async function getCurrentLocation(options = { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    const onSuccess = (pos) => {
      resolve({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      });
    };
    const onError = () => resolve(null);
    try {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
    } catch (_) {
      resolve(null);
    }
  });
}

// Отметить приход
window.checkIn = async function() {
    console.log('CheckIn called');
    console.log('API URL:', API_URL);
    console.log('Init data:', tg.initData ? 'Present' : 'Missing');
    
    try {
        const checkInBtn = document.getElementById('checkInBtn');
        checkInBtn.disabled = true;
        
        // Берем геолокацию (не блокирующе, но с ожиданием до таймаута)
        const location = await getCurrentLocation();
        
        console.log('Sending check-in request...');
        const response = await fetch(`${API_URL}/api/attendance/check-in`, {
          method: 'POST',
          headers: {
            'X-Telegram-Init-Data': tg.initData,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ location })
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
            showNotification('Приход отмечен', 'success');
            await checkAttendanceStatus();
            
            // АГРЕССИВНАЯ активация кнопки checkout - пробуем несколько раз
            console.log('Starting aggressive checkout button activation...');
            
            // Сразу активируем
            window.forceEnableCheckOut();
            
            // И еще несколько раз с интервалами для надёжности
            const intervals = [100, 300, 500, 1000, 2000];
            intervals.forEach(delay => {
                setTimeout(() => {
                    console.log(`Trying to enable checkout after ${delay}ms`);
                    window.forceEnableCheckOut();
                }, delay);
            });
            
            // Дополнительная проверка через API
            setTimeout(async () => {
                await window.checkAndEnableCheckOut();
                // И еще раз форсированно после проверки
                window.forceEnableCheckOut();
            }, 1500);
            
            // Вибрация
            if (tg.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('success');
            }
        } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Check-in error response:', response.status, errorData);
            showNotification(`Ошибка: ${errorData.error || 'Ошибка отметки прихода'}`, 'error');
            checkInBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error checking in:', error);
        showNotification('Ошибка отметки прихода', 'error');
        document.getElementById('checkInBtn').disabled = false;
    }
}

// Глобальная функция для отладки кнопок
window.debugCheckOutButton = function() {
    const btn = document.getElementById('checkOutBtn');
    console.log('CheckOut Button Debug:', {
        element: btn,
        disabled: btn?.disabled,
        hasDisabledAttr: btn?.hasAttribute('disabled'),
        className: btn?.className,
        onclick: btn?.onclick,
        style: {
            opacity: btn?.style.opacity,
            cursor: btn?.style.cursor,
            pointerEvents: btn?.style.pointerEvents
        },
        computedStyle: btn ? {
            opacity: window.getComputedStyle(btn).opacity,
            cursor: window.getComputedStyle(btn).cursor,
            pointerEvents: window.getComputedStyle(btn).pointerEvents
        } : null
    });
};

// Функция для принудительной активации кнопки "Ушел с работы"
window.forceEnableCheckOut = function() {
    const checkOutBtn = document.getElementById('checkOutBtn');
    const checkInBtn = document.getElementById('checkInBtn');
    
    // Убираем проверку на checked-in, просто активируем если кнопка существует
    if (checkOutBtn) {
        console.log('Force enabling checkout button with force-enabled class...');
        
        // ВАЖНО: Добавляем специальный класс для принудительной активации
        checkOutBtn.classList.add('force-enabled');
        
        // Убираем ВСЕ блокировки
        checkOutBtn.disabled = false;
        checkOutBtn.removeAttribute('disabled');
        checkOutBtn.classList.remove('disabled');
        checkOutBtn.classList.remove('btn-disabled');
        
        // Сбрасываем все стили блокировки
        checkOutBtn.style.removeProperty('opacity');
        checkOutBtn.style.removeProperty('cursor');
        checkOutBtn.style.removeProperty('pointer-events');
        checkOutBtn.style.removeProperty('filter');
        checkOutBtn.style.removeProperty('user-select');
        checkOutBtn.style.removeProperty('touch-action');
        
        // Убираем табиндекс блокировки
        checkOutBtn.removeAttribute('tabindex');
        checkOutBtn.setAttribute('tabindex', '0');
        
        // Восстанавливаем обработчик события - пробуем разные способы
        checkOutBtn.onclick = window.checkOut;
        checkOutBtn.addEventListener('click', window.checkOut, { once: true });
        
        // Также устанавливаем через setAttribute для надёжности
        checkOutBtn.setAttribute('onclick', 'checkOut()');
        
        // Убираем все возможные блокировки от родителей
        let parent = checkOutBtn.parentElement;
        while (parent && parent !== document.body) {
            if (parent.style) {
                parent.style.removeProperty('pointer-events');
            }
            parent = parent.parentElement;
        }
        
        // Восстанавливаем стили кнопки
        const wrapper = checkOutBtn.querySelector('.btn-icon-wrapper');
        if (wrapper) {
            wrapper.style.removeProperty('background');
            wrapper.style.removeProperty('pointer-events');
            wrapper.classList.add('force-enabled');
        }
        
        // Убираем классы блокировки от всех дочерних элементов
        checkOutBtn.querySelectorAll('*').forEach(el => {
            el.style.removeProperty('pointer-events');
            el.classList.remove('disabled');
            el.classList.add('force-enabled');
        });
        
        console.log('Checkout button FULLY force enabled:', {
            disabled: checkOutBtn.disabled,
            classList: checkOutBtn.className,
            hasForceEnabled: checkOutBtn.classList.contains('force-enabled'),
            onclick: checkOutBtn.onclick ? 'set' : 'not set',
            onclickAttr: checkOutBtn.getAttribute('onclick')
        });
        
        return true;
    }
    
    console.error('Checkout button not found!');
    return false;
};

// Новый метод для проверки и активации кнопки через API
window.checkAndEnableCheckOut = async function() {
    try {
        const response = await fetch(`${API_URL}/api/attendance/today`, {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        
        if (response.ok) {
            const attendance = await response.json();
            console.log('Manual check attendance:', attendance);
            
            const checkOutBtn = document.getElementById('checkOutBtn');
            const checkInBtn = document.getElementById('checkInBtn');
            
            if (attendance && attendance.checkIn && !attendance.checkOut && checkOutBtn) {
                console.log('Manual enable checkout button');
                checkOutBtn.disabled = false;
                checkOutBtn.removeAttribute('disabled');
                checkOutBtn.style.opacity = '1';
                checkOutBtn.style.cursor = 'pointer';
                checkOutBtn.style.pointerEvents = 'auto';
                
                if (checkInBtn) {
                    checkInBtn.classList.add('checked-in');
                }
                
                const wrapper = checkOutBtn.querySelector('.btn-icon-wrapper');
                if (wrapper) {
                    wrapper.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                }
                
                return true;
            }
        }
    } catch (error) {
        console.error('Error in checkAndEnableCheckOut:', error);
    }
    return false;
};

// Отметить уход
window.checkOut = async function() {
    console.log('=== checkOut function called ===');
    try {
        const checkOutBtn = document.getElementById('checkOutBtn');
        checkOutBtn.disabled = true;
        
        // Геолокация при уходе
        const location = await getCurrentLocation();
        
        const response = await fetch(`${API_URL}/api/attendance/check-out`, {
          method: 'POST',
          headers: {
            'X-Telegram-Init-Data': tg.initData,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ location })
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification(`Уход отмечен. Отработано: ${result.workHours} часов`, 'success');
            await checkAttendanceStatus();
            
            // Вибрация
            if (tg.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('success');
            }
        } else {
            const errorData = await response.json().catch(() => ({ error: 'Неизвестная ошибка' }));
            console.error('Check-out error:', errorData);
            showNotification(errorData.error || 'Ошибка отметки ухода', 'error');
            checkOutBtn.disabled = false;
            // Восстанавливаем класс force-enabled
            checkOutBtn.classList.add('force-enabled');
        }
    } catch (error) {
        console.error('Error checking out:', error);
        showNotification('Ошибка отметки ухода', 'error');
        document.getElementById('checkOutBtn').disabled = false;
    }
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
    
    // Скрываем все контент-вкладки
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    // Показываем выбранную вкладку
    document.getElementById(`${tab}Tab`).classList.add('active');
    document.getElementById(`${tab}Content`).style.display = 'block';
    
    // Загружаем контент в зависимости от вкладки
    if (tab === 'dashboard') {
        loadDashboard();
    } else if (tab === 'reports') {
        loadAdminPanel();
    } else if (tab === 'attendance') {
        loadAttendanceTab();
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
            loadTodayReports(todayData.reports);
            loadAttendanceStatus();
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

// Отчеты сотрудников за сегодня
function loadTodayReports(reports) {
    const container = document.getElementById('todayReportsList');
    
    if (!reports || reports.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <p style="color: var(--text-secondary);">Нет отчетов за сегодня</p>
            </div>
        `;
        return;
    }
    
    let html = '<div style="display: flex; flex-direction: column; gap: 16px;">';
    
    reports.forEach(report => {
        const reportTime = report.timestamp ? new Date(report.timestamp).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        }) : 'Время не указано';
        
        html += `
            <div style="background: var(--bg-card); border-radius: 12px; padding: 16px; border-left: 3px solid var(--primary);">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <div>
                        <div style="font-weight: 600; color: var(--text-primary); font-size: 16px;">${report.employeeName || 'Неизвестный сотрудник'}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Отправлено в ${reportTime}</div>
                    </div>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">✍️ Что сделано:</div>
                    <div style="color: var(--text-primary); font-size: 14px; line-height: 1.5;">${report.whatDone || 'Не указано'}</div>
                </div>
                
                ${report.problems && report.problems !== 'нет' && report.problems !== 'Нет' ? `
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">⚠️ Проблемы:</div>
                        <div style="color: var(--warning); font-size: 14px; line-height: 1.5;">${report.problems}</div>
                    </div>
                ` : ''}
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

// Загрузка статуса присутствия
async function loadAttendanceStatus() {
    const container = document.getElementById('attendanceStatus');
    
    try {
        const response = await fetch(`${API_URL}/api/admin/attendance/current`, {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        
        if (response.ok) {
            const attendanceData = await response.json();
            
            if (attendanceData.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 20px;">
                        <p style="color: var(--text-secondary);">Пока никто не отметился</p>
                    </div>
                `;
                return;
            }
            
            // Сортируем по статусу (присутствующие первыми)
            attendanceData.sort((a, b) => {
                if (a.isPresent && !b.isPresent) return -1;
                if (!a.isPresent && b.isPresent) return 1;
                return 0;
            });
            
            let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
            
            attendanceData.forEach(attendance => {
                const checkInTime = new Date(attendance.checkIn).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                const checkOutTime = attendance.checkOut ? 
                    new Date(attendance.checkOut).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : null;
                
                html += `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--bg-card); border-radius: 12px; border: 1px solid ${attendance.isPresent ? 'rgba(78, 205, 196, 0.2)' : 'rgba(255, 255, 255, 0.05)'};">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="font-size: 20px;">${attendance.isPresent ? '🟢' : '🔴'}</div>
                            <div>
                                <div style="font-weight: 600; color: var(--text-primary);">${attendance.employeeName}</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">
                                    Пришел: ${checkInTime}
                                    ${checkOutTime ? ` • Ушел: ${checkOutTime}` : ''}
                                    ${attendance.workHours ? ` • ${attendance.workHours.toFixed(1)} ч` : ''}
                                </div>
                            </div>
                        </div>
                        <div style="font-size: 12px; padding: 4px 12px; background: ${attendance.isPresent ? 'rgba(78, 205, 196, 0.1)' : 'rgba(255, 107, 107, 0.1)'}; color: ${attendance.isPresent ? 'var(--success)' : 'var(--danger)'}; border-radius: 20px; font-weight: 600;">
                            ${attendance.isPresent ? 'На работе' : 'Ушел'}
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            
            // Добавляем статистику
            const presentCount = attendanceData.filter(a => a.isPresent).length;
            const totalCount = attendanceData.length;
            
            html += `
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px;">
                        <span style="color: var(--text-secondary);">Сейчас на работе:</span>
                        <span style="font-weight: 600; color: var(--success);">${presentCount} из ${totalCount}</span>
                    </div>
                </div>
            `;
            
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Ошибка загрузки данных</p>';
        }
    } catch (error) {
        console.error('Error loading attendance status:', error);
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Ошибка загрузки данных</p>';
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
    
    if (!select) {
        console.error('Employee select not found!');
        return;
    }
    
    // ВАЖНО: Показываем поле выбора исполнителя для ВСЕХ, но с разным содержимым
    const formGroup = select.closest('.form-group');
    if (formGroup) {
        formGroup.style.display = 'block'; // Всегда показываем поле
    }
    
    // Делаем поле обязательным для всех
    select.setAttribute('name', 'employee');
    select.setAttribute('required', 'required');
    select.disabled = false;
    
    if (!window.isManager) {
        // Обычный пользователь - может выбрать только себя
        console.log('User is not manager - showing only self option');
        
        // Получаем ID и имя текущего пользователя
        const currentUserId = tg.initDataUnsafe?.user?.id;
        const currentUserName = currentUser?.name || tg.initDataUnsafe?.user?.first_name || 'Я';
        
        if (currentUserId) {
            // Показываем только опцию "себе" с правильным ID
            select.innerHTML = `<option value="${currentUserId}" selected>${currentUserName} (себе)</option>`;
            console.log(`Set self-option: ${currentUserId} - ${currentUserName}`);
        } else {
            console.error('ERROR: Current user ID not found!');
            select.innerHTML = `<option value="">Ошибка: пользователь не найден</option>`;
        }
    } else {
        // Менеджер - показываем всех сотрудников
        console.log('User is manager - loading all employees');
        
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
    console.log('=== submitTask called ===');
    event.preventDefault();
    
    const formData = new FormData(event.target);
    console.log('Form data collected');
    
    // Если не менеджер, не передаем assigneeId (сервер автоматически поставит на себя)
    // Используем tg.initDataUnsafe.user.id, а не currentUser.telegramId!
    const currentUserId = tg.initDataUnsafe?.user?.id;
    const isManager = currentUserId && [385436658, 1734337242].includes(currentUserId);
    
    console.log('Creating task, currentUserId:', currentUserId, 'isManager:', isManager);
    console.log('Current user from profile:', currentUser);
    
    const task = {
        title: formData.get('title'),
        description: formData.get('description') || '',
        deadline: formData.get('deadline'),
        priority: formData.get('priority')
    };
    
    // ВАЖНО: Теперь ВСЕГДА берем assigneeId из формы, так как поле всегда заполнено
    const employeeId = formData.get('employee');
    console.log('Employee ID from form:', employeeId);
    
    if (employeeId && employeeId !== '') {
        task.assigneeId = parseInt(employeeId);
        console.log('Setting assigneeId:', task.assigneeId);
    } else {
        // Если по какой-то причине ID не получен, используем ID текущего пользователя
        const currentUserId = tg.initDataUnsafe?.user?.id;
        if (currentUserId) {
            task.assigneeId = parseInt(currentUserId);
            console.log('Fallback: using current user ID:', task.assigneeId);
        } else {
            console.error('ERROR: No user ID available!');
        }
    }
    
    console.log('Task data to send:', JSON.stringify(task));
    
    const submitBtn = event.target.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Создание...';
    submitBtn.disabled = true;
    
    try {
        console.log('Sending request to:', `${API_URL}/api/tasks`);
        console.log('Request headers:', {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': tg.initData ? 'Present' : 'Missing'
        });
        console.log('Request body:', JSON.stringify(task));
        
        const response = await fetch(`${API_URL}/api/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': tg.initData
            },
            body: JSON.stringify(task)
        });
        
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        
        if (response.ok) {
            if (tg.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('success');
            }
            
            // Закрываем модальное окно сразу
            closeTaskModal();
            
            // Показываем уведомление
            if (tg.showAlert) {
                tg.showAlert('Задача успешно создана! ✅');
            }
            
            // Обновляем список задач если он открыт
            if (document.getElementById('tasks').classList.contains('active')) {
                await loadTasks();
            }
            
            // Также показываем уведомление в интерфейсе
            showNotification('Задача успешно создана! ✅', 'success');
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Ошибка создания');
        }
    } catch (error) {
        console.error('Error creating task:', error);
        if (tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('error');
        }
        
        const errorMessage = error.message || 'Ошибка при создании задачи';
        
        if (tg.showAlert) {
            tg.showAlert(errorMessage);
        }
        
        showNotification(errorMessage, 'error');
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
    
    const priorityClass = task.priority === 'Высокий' ? 'priority-high' : 
                         task.priority === 'Средний' ? 'priority-medium' : 'priority-low';
    
    const priorityText = task.priority === 'Высокий' ? 'Высокий' : 
                        task.priority === 'Средний' ? 'Средний' : 'Низкий';
    
    const canComplete = task.status !== 'Выполнена' && currentTaskType === 'my';
    
    content.innerHTML = `
        <div class="task-detail-card modern">
            <div class="task-detail-header">
                <h1 class="task-detail-title">${task.title}</h1>
                <span class="task-status-badge modern ${statusClass}">
                    <div class="priority-indicator ${statusClass}"></div>
                    ${task.status}
                </span>
            </div>
            
            ${task.description ? `
                <div class="task-detail-section">
                    <h3>
                        <i data-lucide="file-text" class="section-icon"></i>
                        Описание
                    </h3>
                    <p>${task.description}</p>
                </div>
            ` : ''}
            
            <div class="task-info-grid">
                <div class="task-info-item">
                    <div class="task-info-label">Приоритет</div>
                    <div class="task-info-value">
                        <div class="priority-indicator ${priorityClass}"></div>
                        ${priorityText}
                    </div>
                </div>
                
                <div class="task-info-item">
                    <div class="task-info-label">Срок выполнения</div>
                    <div class="task-info-value">
                        <i data-lucide="calendar" style="width: 14px; height: 14px;"></i>
                        ${formatDate(task.deadline)}
                    </div>
                </div>
                
                <div class="task-info-item">
                    <div class="task-info-label">Создана</div>
                    <div class="task-info-value">
                        <i data-lucide="clock" style="width: 14px; height: 14px;"></i>
                        ${formatDate(task.createdDate)}
                    </div>
                </div>
                
                <div class="task-info-item">
                    <div class="task-info-label">Постановщик</div>
                    <div class="task-info-value">
                        <i data-lucide="user" style="width: 14px; height: 14px;"></i>
                        ${task.creatorName === currentUser?.name ? 'Я' : (task.creatorName || 'Система')}
                    </div>
                </div>
                
                ${currentTaskType === 'created' ? `
                    <div class="task-info-item">
                        <div class="task-info-label">Исполнитель</div>
                        <div class="task-info-value">
                            <i data-lucide="user-check" style="width: 14px; height: 14px;"></i>
                            ${task.assigneeName || 'Не назначен'}
                        </div>
                    </div>
                ` : ''}
            </div>
            
            ${canComplete ? `
                <div class="task-actions modern">
                    ${task.status === 'Новая' ? `
                        <button class="task-action-btn modern start" onclick="updateTaskStatus('${task.id}', 'В работе')">
                            <i data-lucide="play" class="btn-icon"></i>
                            Взять в работу
                        </button>
                    ` : ''}
                    <button class="task-action-btn modern complete" onclick="updateTaskStatus('${task.id}', 'Выполнена')">
                        <i data-lucide="check-circle" class="btn-icon"></i>
                        Выполнить
                    </button>
                </div>
            ` : ''}
            
            ${window.isManager && currentTaskType === 'created' ? `
                <div class="task-actions modern" style="margin-top: 12px;">
                    <button class="task-action-btn modern edit" onclick="editTask('${task.id}')">
                        <i data-lucide="edit-3" class="btn-icon"></i>
                        Редактировать
                    </button>
                </div>
            ` : ''}
            
            ${task.status === 'Выполнена' ? `
                <div class="task-completed-notice">
                    <h3>
                        <i data-lucide="check-circle" style="width: 20px; height: 20px;"></i>
                        Задача выполнена
                    </h3>
                    <p>Отличная работа! Задача успешно завершена.</p>
                </div>
            ` : ''}
        </div>
    `;
    
    // Переинициализируем Lucide иконки для новых элементов
    if (window.lucide) {
        lucide.createIcons();
    }
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

// Загрузка вкладки учета времени
async function loadAttendanceTab() {
    try {
        // Загружаем список сотрудников для фильтра
        const employeesResponse = await fetch(`${API_URL}/api/employees`, {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        
        if (employeesResponse.ok) {
            const employees = await employeesResponse.json();
            const employeeFilter = document.getElementById('attendanceEmployeeFilter');
            
            employeeFilter.innerHTML = '<option value="all">Все сотрудники</option>' +
                employees.map(emp => 
                    `<option value="${emp.telegramId}">${emp.name}</option>`
                ).join('');
        }
        
        // Обработчик изменения периода
        const periodFilter = document.getElementById('attendancePeriodFilter');
        const customDateRange = document.getElementById('attendanceCustomDateRange');
        
        periodFilter.addEventListener('change', (e) => {
            customDateRange.style.display = e.target.value === 'custom' ? 'flex' : 'none';
        });
        
        // Загружаем историю учета времени
        updateAttendanceHistory();
        
    } catch (error) {
        console.error('Error loading attendance tab:', error);
        showNotification('Ошибка загрузки учета времени', 'error');
    }
}

// Обновление истории учета времени
window.updateAttendanceHistory = async function() {
    const container = document.getElementById('attendanceHistoryList');
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p style="margin-top: 16px;">Загрузка истории...</p></div>';
    
    try {
        // Получаем значения фильтров
        const period = document.getElementById('attendancePeriodFilter').value;
        const employeeId = document.getElementById('attendanceEmployeeFilter').value;
        
        let startDate, endDate;
        const today = new Date();
        
        switch (period) {
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
                startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                endDate = today.toISOString().split('T')[0];
                break;
            case 'custom':
                startDate = document.getElementById('attendanceStartDate').value;
                endDate = document.getElementById('attendanceEndDate').value;
                if (!startDate || !endDate) {
                    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Выберите даты</p>';
                    return;
                }
                break;
        }
        
        // Формируем URL с параметрами
        const params = new URLSearchParams({
            startDate: startDate,
            endDate: endDate
        });
        
        if (employeeId !== 'all') {
            params.append('employeeId', employeeId);
        }
        
        const response = await fetch(`${API_URL}/api/admin/attendance/history?${params}`, {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        
        if (response.ok) {
            const attendanceData = await response.json();
            
            if (attendanceData.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Нет данных за выбранный период</p>';
                updateAttendanceStats([]); // Обновляем статистику пустыми данными
                return;
            }
            
            // Обновляем статистику
            updateAttendanceStats(attendanceData);
            
            // Группируем данные по дням
            const groupedByDate = {};
            attendanceData.forEach(record => {
                const date = record.date;
                if (!groupedByDate[date]) {
                    groupedByDate[date] = [];
                }
                groupedByDate[date].push(record);
            });
            
            // Сортируем даты в обратном порядке
            const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));
            
            let html = '<div style="display: flex; flex-direction: column; gap: 20px;">';
            
            sortedDates.forEach(date => {
                const dateRecords = groupedByDate[date];
                const dateObj = new Date(date);
                const dateStr = dateObj.toLocaleDateString('ru-RU', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                
                html += `
                    <div>
                        <h4 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: var(--text-secondary);">
                            ${dateStr}
                        </h4>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                `;
                
                dateRecords.forEach(record => {
                    const checkInTime = record.checkIn ? 
                        new Date(record.checkIn).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '-';
                    const checkOutTime = record.checkOut ? 
                        new Date(record.checkOut).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '-';
                    const workHours = record.workHours ? `${record.workHours.toFixed(1)} ч` : '-';
                    
                    html += `
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--bg-card); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.05);">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: var(--text-primary);">${record.employeeName}</div>
                                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                                    Пришел: ${checkInTime} • 
                                    Ушел: ${checkOutTime} • 
                                    Отработано: ${workHours}
                                    ${record.late ? ' • <span style="color: var(--warning);">Опоздание</span>' : ''}
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${record.late ? '<span style="font-size: 20px;">⚠️</span>' : ''}
                                <div style="font-size: 12px; padding: 4px 12px; background: ${record.status === 'Completed' ? 'rgba(78, 205, 196, 0.1)' : 'rgba(255, 217, 61, 0.1)'}; color: ${record.status === 'Completed' ? 'var(--success)' : 'var(--warning)'}; border-radius: 20px; font-weight: 600;">
                                    ${record.status === 'Completed' ? 'Завершен' : 'В процессе'}
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                html += '</div></div>';
            });
            
            html += '</div>';
            container.innerHTML = html;
            
        } else {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Ошибка загрузки данных</p>';
        }
        
    } catch (error) {
        console.error('Error loading attendance history:', error);
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Ошибка загрузки данных</p>';
    }
}

// Обновление статистики учета времени
function updateAttendanceStats(attendanceData) {
    // Подсчитываем статистику
    const totalDays = new Set(attendanceData.map(r => r.date)).size;
    const totalHours = attendanceData.reduce((sum, r) => sum + (r.workHours || 0), 0);
    const lateCount = attendanceData.filter(r => r.late).length;
    const avgHours = totalDays > 0 ? (totalHours / totalDays).toFixed(1) : 0;
    
    // Обновляем значения
    document.getElementById('attendanceTotalDays').textContent = totalDays;
    document.getElementById('attendanceTotalHours').textContent = totalHours.toFixed(1);
    document.getElementById('attendanceLateCount').textContent = lateCount;
    document.getElementById('attendanceAvgHours').textContent = avgHours;
}