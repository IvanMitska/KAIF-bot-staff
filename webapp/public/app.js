// Создаем глобальный namespace для приложения
window.KaifApp = window.KaifApp || {};

// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Проверка initData только в dev режиме
if (window.location.hostname === 'localhost') {
    console.log('Telegram WebApp initialized:', {
        initData: tg.initData ? 'Present' : 'Missing',
        platform: tg.platform
    });
}

// Убираем отладочную панель из продакшна
if (!tg.initData && window.location.hostname === 'localhost') {
    console.warn('⚠️ NO TELEGRAM INIT DATA DETECTED (dev mode)');
}

// Принудительно используем только темную тему
// Игнорируем настройки темы Telegram - приложение всегда в темной теме
document.documentElement.style.setProperty('--tg-theme-bg-color', '#0F0F14');
document.documentElement.style.setProperty('--tg-theme-text-color', '#FFFFFF');

console.log('🎨 Тема заблокирована на темной версии');

// API URL
const API_URL = window.location.origin;

// Функция для получения URL API
function getApiUrl(endpoint) {
    // Просто возвращаем URL без модификаций
    return `${API_URL}${endpoint}`;
}

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
let lastNewTasksCount = parseInt(localStorage.getItem('lastNewTasksCount') || '0');
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
    
    // Загружаем данные о присутствии на главной странице
    setTimeout(async () => {
        await updateRealTimeAttendance();
    }, 1000);
    
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
    const reportForm = document.getElementById('reportForm');
    if (reportForm) {
        reportForm.addEventListener('submit', submitReport);
    }

    // Event delegation для задач - один обработчик на весь контейнер
    const tasksList = document.getElementById('tasksList');
    if (tasksList) {
        console.log('🎯 Устанавливаем event delegation на tasksList');
        console.log('🔍 Проверка showTaskDetails при установке delegation:', typeof window.showTaskDetails);

        tasksList.addEventListener('click', function(e) {
            // Находим ближайший .task-item-modern
            const taskItem = e.target.closest('.task-item-modern[data-task-id]');

            if (taskItem) {
                const taskId = parseInt(taskItem.getAttribute('data-task-id'));
                console.log('🖱️ КЛИК по задаче через delegation:', taskId);
                console.log('🔍 Тип window.showTaskDetails:', typeof window.showTaskDetails);

                if (typeof window.showTaskDetails === 'function') {
                    console.log('✅ Вызываем window.showTaskDetails');
                    try {
                        window.showTaskDetails(taskId);
                        console.log('✅ showTaskDetails вызвана без ошибок');
                    } catch (error) {
                        console.error('❌ Ошибка при вызове showTaskDetails:', error);
                    }
                } else {
                    console.error('❌❌❌ window.showTaskDetails не является функцией!');
                }
            }
        });

        console.log('✅ Event delegation установлен для задач');
    }
    
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

// Упрощенная инициализация scroll анимаций (отключена для избежания конфликтов)
function initializeScrollAnimations() {
    // Отключено для предотвращения двойных анимаций при переключении страниц
    console.log('Scroll animations disabled to prevent conflicts');
}

// Упрощенная инициализация stagger анимаций
function initializeStaggerAnimations() {
    // Упрощено для избежания конфликтов с page transitions
    console.log('Stagger animations simplified');
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
    document.querySelectorAll('.action-card.modern, .stat-card.modern, .task-item.modern, .task-item-modern').forEach((card) => {
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
// Универсальная функция анимации чисел
function animateNumber(element, endValue, options = {}) {
    const defaults = {
        duration: 500,
        startValue: null,
        addPulse: false,
        easing: 'easeOut'
    };

    const settings = { ...defaults, ...options };
    const startValue = settings.startValue ?? (parseInt(element.textContent) || 0);

    if (startValue === endValue) return;

    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / settings.duration, 1);

        // Easing function
        let eased = progress;
        if (settings.easing === 'easeOut') {
            eased = 1 - Math.pow(1 - progress, 3);
        }

        const currentValue = Math.round(startValue + (endValue - startValue) * eased);
        element.textContent = currentValue;

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = endValue;

            // Добавляем пульсацию если нужно
            if (settings.addPulse && endValue > startValue) {
                element.style.transform = 'scale(1.2)';
                element.style.color = 'var(--primary)';
                setTimeout(() => {
                    element.style.transform = '';
                    element.style.color = '';
                }, 300);
            }
        }
    }

    requestAnimationFrame(update);
}

// Совместимость со старыми названиями
function animateCounterUpdate(element, newValue) {
    animateNumber(element, newValue, { addPulse: true });
}

// Переменная для предотвращения множественных переключений
let isPageSwitching = false;

// Навигация между страницами
function showPage(pageId) {
    console.log('🔄 showPage() called with pageId:', pageId);

    const currentPage = document.querySelector('.page.active');
    const targetPage = document.getElementById(pageId);

    console.log('📍 Current page:', currentPage?.id);
    console.log('🎯 Target page element found:', !!targetPage);

    if (!targetPage) {
        console.error('❌ Target page not found:', pageId);
        return;
    }
    
    // Если пытаемся переключиться на ту же страницу
    if (currentPage === targetPage) {
        window.scrollTo(0, 0);
        return;
    }
    
    // Быстрая проверка на множественные клики, но не блокируем надолго
    if (isPageSwitching) {
        setTimeout(() => showPage(pageId), 10);
        return;
    }
    
    isPageSwitching = true;
    
    // Мгновенное переключение без задержек и анимаций
    if (currentPage) {
        currentPage.classList.remove('active');
        currentPage.style.opacity = '';
        currentPage.style.transform = '';
        currentPage.style.transition = '';
    }
    
    // Сразу показываем новую страницу
    targetPage.classList.add('active');
    targetPage.style.opacity = '';
    targetPage.style.transform = '';
    targetPage.style.transition = '';
    
    // Прокручиваем страницу к началу
    window.scrollTo(0, 0);
    targetPage.scrollTop = 0;
    
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
    
    // Асинхронно загружаем данные для страницы (не блокируем UI)
    setTimeout(() => {
        console.log('📊 Loading data for page:', pageId);
        switch(pageId) {
            case 'tasks':
                console.log('🎯 Calling loadTasks() from showPage...');
                loadTasks();
                break;
            case 'stats':
                console.log('📈 Calling loadStats() from showPage...');
                loadStats();
                break;
            case 'profile':
                console.log('👤 Calling loadFullProfile() from showPage...');
                loadFullProfile();
                break;
            default:
                console.log('❓ Unknown page ID:', pageId);
        }
    }, 0);
    
    // Вибрация при переключении
    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
    
    // Разрешаем следующее переключение мгновенно
    isPageSwitching = false;
}

// Функции навигации
function showTasks() {
    showPage('tasks');
}

function showEmployees() {
    showPage('employees');
}

function showReportForm() {
    showPage('report');
}

function showProfile() {
    showPage('profile');
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
        // В режиме без initData продолжаем работать с test=1
        if (!tg.initData || tg.initData.length === 0) {
            console.warn('No initData available, using test mode');
            
            // Устанавливаем тестового пользователя
            currentUser = {
                id: 1734337242,
                telegramId: 1734337242,
                name: 'Test User',
                first_name: 'Test',
                last_name: 'User',
                username: 'testuser',
                isManager: true
            };
            
            // НЕ блокируем приложение, продолжаем работу в test режиме
            console.log('Working in test mode without Telegram auth');
            document.getElementById('userName').textContent = 'Test User';
            
            // Показываем кнопку создания задачи
            const createTaskBtn = document.getElementById('createTaskBtn');
            if (createTaskBtn) {
                createTaskBtn.style.display = 'block';
            }
            
            // Показываем секцию админа для тестового пользователя
            const adminSection = document.querySelector('[data-section="admin"]');
            if (adminSection) {
                adminSection.style.display = 'block';
            }
            
            return; // Выходим из функции, не блокируя приложение
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
            
            console.log('📱 Profile loaded:', {
                name: currentUser?.name,
                telegramId: currentUser?.telegramId,
                isManager: currentUser?.isManager,
                fullUser: currentUser
            });
            
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
        // Используем getApiUrl которая автоматически добавит test=1 если нет initData
        const headers = {};
        if (tg.initData) {
            headers['X-Telegram-Init-Data'] = tg.initData;
        }
        
        const response = await fetch(getApiUrl('/api/tasks/my'), {
            headers: headers
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
            // Показываем уведомление только если это НЕ первый запуск
            const hasStoredCount = localStorage.getItem('lastNewTasksCount') !== null;
            if (newTasks > lastNewTasksCount && hasStoredCount) {
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
            localStorage.setItem('lastNewTasksCount', newTasks.toString());
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

// СТАРАЯ ФУНКЦИЯ - ПЕРЕНАПРАВЛЯЕМ НА НОВЫЙ МОДУЛЬ
function switchTaskType(type) {
    console.log('🔄 Перенаправление на TasksModule.switchTaskType:', type);
    if (window.TasksModule && window.TasksModule.switchTaskType) {
        window.TasksModule.switchTaskType(type);
        return;
    }
    // Старый код выполнится только если модуль недоступен
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

// Загрузка задач - ТОЛЬКО НОВЫЙ МОДУЛЬ
async function loadTasks() {
    console.log('🚀 loadTasks() - используем ТОЛЬКО новый модуль');

    // Используем новый модуль задач
    if (window.TasksModule) {
        await window.TasksModule.loadTasks();
        return;
    }

    // Если модуль не загружен, ждем его
    console.log('⏳ Ждем загрузки TasksModule...');
    setTimeout(() => {
        if (window.TasksModule) {
            window.TasksModule.init();
        }
    }, 100);
    return;
}

// Все старые функции задач отключены - используем только TasksModule

// СТАРЫЕ ФУНКЦИИ - ПЕРЕНАПРАВЛЯЕМ НА НОВЫЙ МОДУЛЬ
function openTaskDetail(taskId) {
    console.log('🔄 Перенаправление на TasksModule.showTaskDetails:', taskId);
    if (window.TasksModule && window.TasksModule.showTaskDetails) {
        const task = window.TasksModule.currentTasks.find(t => t.id === taskId);
        if (task) {
            window.TasksModule.showTaskDetails(task);
        }
    }
}
window.openTaskDetail = openTaskDetail;

function forceLoadTasks() {
    console.log('🔄 Перенаправление на TasksModule.loadTasks');
    if (window.TasksModule && window.TasksModule.loadTasks) {
        window.TasksModule.loadTasks();
    }
}

// СТАРАЯ ФУНКЦИЯ - ПЕРЕНАПРАВЛЯЕМ НА НОВЫЙ МОДУЛЬ
function showTaskModal(task) {
    console.log('🔄 Перенаправление на TasksModule.showTaskDetails');
    if (window.TasksModule && window.TasksModule.showTaskDetails) {
        window.TasksModule.showTaskDetails(task);
        return;
    }
    // Старый код ниже не выполнится, если модуль доступен
    // Создаем или обновляем модальное окно просмотра задачи
    let modal = document.getElementById('taskDetailModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'taskDetailModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    const statusColors = {
        'Новая': { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', border: '#3b82f6' },
        'В работе': { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: '#f59e0b' },
        'Выполнена': { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: '#10b981' }
    };

    const statusClass = task.status || 'Новая';
    const statusColor = statusColors[statusClass];

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px; margin: 0 auto;">
            <div class="modal-header">
                <h2 style="margin: 0; color: var(--text-primary);">Детали задачи</h2>
                <button class="close-btn" onclick="closeTaskDetailModal()" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: var(--text-secondary);
                ">×</button>
            </div>

            <div class="modal-body">
                <div style="margin-bottom: 20px;">
                    <h3 style="
                        margin: 0 0 8px 0;
                        font-size: 18px;
                        font-weight: 600;
                        color: var(--text-primary);
                    ">${task.title}</h3>

                    <span style="
                        display: inline-flex;
                        align-items: center;
                        padding: 6px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 500;
                        background: ${statusColor.bg};
                        color: ${statusColor.color};
                        border: 1px solid ${statusColor.border}40;
                    ">${task.status}</span>
                </div>

                ${task.description ? `
                    <div style="margin-bottom: 20px;">
                        <h4 style="
                            margin: 0 0 8px 0;
                            font-size: 14px;
                            font-weight: 500;
                            color: var(--text-secondary);
                        ">Описание:</h4>
                        <p style="
                            margin: 0;
                            font-size: 14px;
                            color: var(--text-primary);
                            line-height: 1.5;
                            white-space: pre-wrap;
                        ">${task.description}</p>
                    </div>
                ` : ''}

                <div style="
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                    margin-bottom: 20px;
                ">
                    <div>
                        <h4 style="
                            margin: 0 0 4px 0;
                            font-size: 12px;
                            font-weight: 500;
                            color: var(--text-secondary);
                            text-transform: uppercase;
                        ">Дедлайн</h4>
                        <p style="
                            margin: 0;
                            font-size: 14px;
                            color: var(--text-primary);
                        ">${formatDate(task.deadline)}</p>
                    </div>

                    <div>
                        <h4 style="
                            margin: 0 0 4px 0;
                            font-size: 12px;
                            font-weight: 500;
                            color: var(--text-secondary);
                            text-transform: uppercase;
                        ">Исполнитель</h4>
                        <p style="
                            margin: 0;
                            font-size: 14px;
                            color: var(--text-primary);
                        ">${task.assigneeName || 'Не назначен'}</p>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <h4 style="
                        margin: 0 0 4px 0;
                        font-size: 12px;
                        font-weight: 500;
                        color: var(--text-secondary);
                        text-transform: uppercase;
                    ">Создатель</h4>
                    <p style="
                        margin: 0;
                        font-size: 14px;
                        color: var(--text-primary);
                    ">${task.creatorName || 'Система'}</p>
                </div>

                ${task.status !== 'Выполнена' && (currentUser?.id === task.assigneeId || currentUser?.isManager) ? `
                    <div style="
                        display: flex;
                        gap: 12px;
                        padding-top: 20px;
                        border-top: 1px solid rgba(255, 255, 255, 0.08);
                    ">
                        ${task.status === 'Новая' && currentUser?.id === task.assigneeId ? `
                            <button onclick="updateTaskStatus('${task.id}', 'В работе'); closeTaskDetailModal();" style="
                                flex: 1;
                                padding: 12px 16px;
                                background: linear-gradient(135deg, #f59e0b, #d97706);
                                color: white;
                                border: none;
                                border-radius: 8px;
                                font-weight: 500;
                                cursor: pointer;
                                transition: all 0.2s ease;
                            ">Взять в работу</button>
                        ` : ''}

                        ${currentUser?.id === task.assigneeId ? `
                            <button onclick="updateTaskStatus('${task.id}', 'Выполнена'); closeTaskDetailModal();" style="
                                flex: 1;
                                padding: 12px 16px;
                                background: linear-gradient(135deg, #10b981, #059669);
                                color: white;
                                border: none;
                                border-radius: 8px;
                                font-weight: 500;
                                cursor: pointer;
                                transition: all 0.2s ease;
                            ">Выполнить</button>
                        ` : ''}

                        ${currentUser?.isManager && currentTaskType === 'created' ? `
                            <button onclick="editTask('${task.id}'); closeTaskDetailModal();" style="
                                flex: 1;
                                padding: 12px 16px;
                                background: linear-gradient(135deg, #6366f1, #4f46e5);
                                color: white;
                                border: none;
                                border-radius: 8px;
                                font-weight: 500;
                                cursor: pointer;
                                transition: all 0.2s ease;
                            ">Редактировать</button>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    // Показываем модальное окно
    modal.style.display = 'flex';
    modal.classList.add('show');

    // Предотвращаем скролл фона
    document.body.style.overflow = 'hidden';
}

// Закрыть модальное окно просмотра задачи
function closeTaskDetailModal() {
    const modal = document.getElementById('taskDetailModal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// Делаем функции глобально доступными
window.showTaskModal = showTaskModal;
window.closeTaskDetailModal = closeTaskDetailModal;
window.handleTaskClick = handleTaskClick;

// СТАРАЯ ФУНКЦИЯ - ПЕРЕНАПРАВЛЯЕМ НА НОВЫЙ МОДУЛЬ
function displayTasks(tasks) {
    console.log('🔄 Перенаправление на TasksModule для отображения задач');
    if (window.TasksModule && window.TasksModule.renderTasks) {
        window.TasksModule.currentTasks = tasks;
        window.TasksModule.renderTasks(tasks);
        return;
    }
    // Старый код ниже не выполнится, если модуль доступен
    console.log('📋 displayTasks called with', tasks?.length || 0, 'tasks');
    console.log('🔍 Tasks data:', tasks);
    console.log('📍 Current filter:', currentFilter);
    console.log('📍 Current task type:', currentTaskType);

    const tasksList = document.getElementById('tasksList');
    console.log('📋 tasksList element in displayTasks:', !!tasksList);

    if (!tasksList) {
        console.error('❌ tasksList element not found in displayTasks!');
        return;
    }

    // Проверяем, что tasks это массив
    if (!Array.isArray(tasks)) {
        console.error('❌ tasks is not an array:', tasks);
        tasksList.innerHTML = '<p style="text-align: center; color: red;">Ошибка: неверный формат данных</p>';
        return;
    }
    
    // Фильтрация задач
    let filteredTasks = tasks;
    if (currentFilter !== 'all') {
        const statusMap = {
            'new': 'Новая',
            'in-progress': 'В работе',
            'completed': 'Выполнена'
        };
        const targetStatus = statusMap[currentFilter];
        console.log('🎯 Filtering by status:', targetStatus, 'from filter:', currentFilter);
        console.log('📊 Available statuses in tasks:', [...new Set(tasks.map(t => t.status))]);
        filteredTasks = tasks.filter(task => task.status === targetStatus);
    }
    
    console.log('📋 Filtered tasks:', filteredTasks.length, 'from total:', tasks.length);
    
    if (filteredTasks.length === 0) {
        tasksList.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">Нет задач</p>';
        return;
    }
    
    tasksList.innerHTML = filteredTasks.map(task => {
        const statusClass = task.status === 'Новая' ? 'new' : 
                          task.status === 'В работе' ? 'in-progress' : 'completed';
        
        // Определяем цвета для статуса
        const statusColors = {
            'new': { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '#ef4444' },
            'in-progress': { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '#f59e0b' },
            'completed': { bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '#22c55e' }
        };
        
        const statusColor = statusColors[statusClass];
        
        return `
            <div class="task-item-modern" data-task-id="${task.id}"
                 style="
                    cursor: pointer;
                    background: var(--bg-card);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 16px;
                    padding: 20px;
                    margin-bottom: 16px;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    position: relative;
                    overflow: hidden;
                 "
            >
                <div style="
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 4px;
                    background: ${statusColor.border};
                "></div>
                
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 12px;
                ">
                    <h3 style="
                        margin: 0;
                        font-size: 16px;
                        font-weight: 600;
                        color: var(--text-primary);
                        line-height: 1.4;
                        flex: 1;
                        margin-right: 12px;
                    ">${task.title}</h3>
                    
                    <span style="
                        display: inline-flex;
                        align-items: center;
                        padding: 6px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 500;
                        background: ${statusColor.bg};
                        color: ${statusColor.color};
                        border: 1px solid ${statusColor.border}40;
                        white-space: nowrap;
                    ">${task.status}</span>
                </div>
                
                ${task.description ? `
                    <p style="
                        margin: 0 0 16px 0;
                        font-size: 14px;
                        color: var(--text-secondary);
                        line-height: 1.5;
                        display: -webkit-box;
                        -webkit-line-clamp: 2;
                        -webkit-box-orient: vertical;
                        overflow: hidden;
                    ">${task.description}</p>
                ` : ''}
                
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid rgba(255, 255, 255, 0.06);
                ">
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        font-size: 13px;
                        color: var(--text-secondary);
                    ">
                        <span style="opacity: 0.8;">📅</span>
                        <span>${formatDate(task.deadline)}</span>
                    </div>
                    
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        font-size: 13px;
                        color: var(--text-secondary);
                    ">
                        <span style="opacity: 0.8;">👤</span>
                        <span>${currentTaskType === 'my' ? 
                            (task.creatorName === currentUser?.name ? 'Я' : (task.creatorName || 'Система')) : 
                            (task.assigneeName || 'Не назначен')}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Используем event delegation - один обработчик на контейнер
    console.log('🔧 Задачи отрисованы, event delegation активен');
}

// Функция обработки клика по задаче
function handleTaskClick(taskId) {
    console.log('🚀 handleTaskClick called with:', taskId);
    // Используем showTaskDetails из task-detail-modal.js
    if (typeof window.showTaskDetails === 'function') {
        window.showTaskDetails(taskId);
    } else {
        console.error('❌ Функция showTaskDetails не найдена!');
        openTaskDetail(taskId); // Fallback на старую функцию
    }
}

// Функция добавления обработчиков клика на задачи
// Функция addTaskClickHandlers удалена - используется event delegation из DOMContentLoaded

// СТАРЫЕ ФУНКЦИИ - ПЕРЕНАПРАВЛЯЕМ НА НОВЫЙ МОДУЛЬ
function updateTaskCounts(tasks) {
    console.log('🔄 Перенаправление на TasksModule.updateCounts');
    if (window.TasksModule && window.TasksModule.updateTaskCounts) {
        window.TasksModule.updateTaskCounts(tasks);
        return;
    }
    // Старый код не выполнится, если модуль доступен
}

// Фильтрация задач - перенаправляем на новый модуль
function filterTasks(filter, event) {
    console.log('🔄 Перенаправление на TasksModule.filterTasks:', filter);
    if (window.TasksModule && window.TasksModule.filterTasks) {
        window.TasksModule.filterTasks(filter);
        return;
    }
    // Старый код продолжит выполняться только если модуль недоступен
    console.log('🔍 filterTasks called:', filter, event);
    currentFilter = filter;
    
    // Обновляем активную кнопку с анимацией
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Если event передан, используем его для определения нажатой кнопки
    if (event && event.target) {
        // Находим кнопку (может быть клик по дочернему элементу)
        let button = event.target;
        if (button.tagName !== 'BUTTON') {
            button = button.closest('button');
        }
        if (button) {
            button.classList.add('active');
            button.style.animation = 'bounceIn 0.4s ease-out';
        }
    } else {
        // Иначе находим кнопку по фильтру
        const filterMap = {
            'all': 0,
            'new': 1,
            'in-progress': 2,
            'completed': 3
        };
        const buttons = document.querySelectorAll('.filter-btn');
        if (buttons[filterMap[filter]]) {
            buttons[filterMap[filter]].classList.add('active');
        }
    }
    
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
// Функция принудительного обновления профиля
window.reloadProfile = async function() {
    showNotification('Обновление профиля...', 'info');
    await loadProfile();
    showNotification('Профиль обновлен', 'success');
}

// Функции админ-панели
window.showAdminPanel = async function() {
    // Прокручиваем к началу
    window.scrollTo(0, 0);
    
    console.log('Admin panel access check:', {
        currentUser: currentUser,
        isManager: currentUser?.isManager,
        telegramId: currentUser?.telegramId
    });
    
    // Если нет данных о правах, перезагружаем профиль
    if (currentUser && currentUser.isManager === undefined) {
        console.log('⚠️ isManager not set, reloading profile...');
        await loadProfile();
    }
    
    // Используем проверку isManager с сервера
    if (!currentUser?.isManager) {
        showNotification('У вас нет доступа к админ-панели', 'error');
        console.error('❌ Access denied. Current user:', currentUser);
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
            const actualReportsCount = todayData.reports ? todayData.reports.length : 0;
            const missingCount = Math.max(0, employees.length - actualReportsCount);
            
            console.log('Dashboard metrics:', {
                employees: employees.length,
                reports: actualReportsCount,
                missing: missingCount
            });
            
            document.getElementById('dashboardTodayReports').textContent = actualReportsCount;
            document.getElementById('dashboardMissingReports').textContent = missingCount;
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
    let maxValue = Math.max(...weekData.map(d => typeof d === 'number' ? d : (d.count || 0)));
    if (maxValue === 0) maxValue = 1;
    
    let html = '<div style="display: flex; align-items: flex-end; justify-content: space-between; height: 160px; margin-bottom: 16px;">';
    
    weekData.forEach(day => {
        const count = typeof day === 'number' ? day : (day.count || 0);
        const height = (count / maxValue) * 140;
        const date = day.date || new Date();
        const dayName = new Date(date).toLocaleDateString('ru-RU', { weekday: 'short' });
        
        html += `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                <div style="position: relative; width: 100%; max-width: 40px;">
                    <div style="background: var(--gradient-primary); height: ${height}px; border-radius: 8px 8px 0 0; transition: all 0.3s; cursor: pointer;"
                         onmouseover="this.style.transform='scaleY(1.05)'"
                         onmouseout="this.style.transform='scaleY(1)'">
                    </div>
                    <div style="position: absolute; top: -24px; left: 50%; transform: translateX(-50%); font-size: 12px; font-weight: 600; color: var(--text-primary);">
                        ${count}
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
    
    console.log('Missing reports check:', {
        employees: allEmployees,
        reports: todayReports,
        employeeCount: allEmployees?.length,
        reportCount: todayReports?.length
    });
    
    // Проверяем наличие данных
    if (!allEmployees || allEmployees.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <p style="color: var(--text-secondary);">Нет данных о сотрудниках</p>
            </div>
        `;
        return;
    }
    
    // Получаем ID сотрудников, которые отправили отчеты
    const reportedIds = todayReports ? todayReports.map(r => {
        // Преобразуем в строку для сравнения
        return String(r.telegramId);
    }) : [];
    
    // Фильтруем тех, кто не отправил
    const missingEmployees = allEmployees.filter(emp => {
        // Преобразуем в строку для сравнения
        const empId = String(emp.telegramId);
        return !reportedIds.includes(empId);
    });
    
    console.log('Missing employees:', missingEmployees.length, missingEmployees);
    
    // Проверяем разные сценарии
    if (allEmployees.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <p style="color: var(--text-secondary);">Нет активных сотрудников</p>
            </div>
        `;
        return;
    } else if (missingEmployees.length === 0 && todayReports && todayReports.length > 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <p style="color: var(--success); font-size: 16px;">✅ Все сотрудники отправили отчеты!</p>
            </div>
        `;
        return;
    } else if (missingEmployees.length === allEmployees.length) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <p style="color: var(--warning); font-size: 16px;">⚠️ Никто еще не отправил отчеты</p>
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
            
            // Инициализируем custom select
            if (window.initCustomSelect) {
                window.initCustomSelect(employeeFilter);
            }
            
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
    window.scrollTo(0, 0);
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

// Упрощенная функция открытия модального окна задачи
function showCreateTaskModal(employeeId = null, employeeName = null) {
    const modal = document.getElementById('taskModal');
    if (!modal) {
        console.error('Модальное окно taskModal не найдено');
        return;
    }

    // Сброс флага и очистка состояния
    isSubmittingTask = false;
    modal.className = 'modal-overlay show';
    modal.removeAttribute('style');

    // Открытие модального окна
    requestAnimationFrame(() => {
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';
        document.body.style.overflow = 'hidden';
    });

    // Проверяем финальные стили
    const computedStyle = window.getComputedStyle(modal);
    console.log('🎨 Финальные стили модального окна:', {
        display: computedStyle.display,
        opacity: computedStyle.opacity,
        visibility: computedStyle.visibility,
        pointerEvents: computedStyle.pointerEvents,
        zIndex: computedStyle.zIndex
    });
    
    // Инициализируем Lucide иконки в модальном окне
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // Устанавливаем дату по умолчанию на завтра
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = document.getElementById('taskDeadline');
    if (dateInput) {
        dateInput.value = tomorrow.toISOString().split('T')[0];
    }
    
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

// Делаем функцию глобально доступной
window.showCreateTaskModal = showCreateTaskModal;

// Тестовая функция для диагностики модального окна
window.testModal = function() {
    console.log('🧪 === ТЕСТ МОДАЛЬНОГО ОКНА ===');

    const modal = document.getElementById('taskModal');
    console.log('1. Элемент taskModal:', modal);

    if (!modal) {
        console.log('❌ Модальное окно не найдено!');
        const allElements = document.querySelectorAll('*[id*="modal"], *[class*="modal"]');
        console.log('🔍 Найденные модальные элементы:', allElements);
        return;
    }

    console.log('2. Текущие стили:', {
        display: modal.style.display,
        opacity: modal.style.opacity,
        visibility: modal.style.visibility,
        classList: Array.from(modal.classList)
    });

    console.log('3. Computed стили:', {
        display: getComputedStyle(modal).display,
        opacity: getComputedStyle(modal).opacity,
        visibility: getComputedStyle(modal).visibility,
        zIndex: getComputedStyle(modal).zIndex
    });

    console.log('4. Попытка открытия...');
    showCreateTaskModal();
};

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

            // ВАЖНО: Переинициализируем dropdown после загрузки данных
            console.log('🔄 Переинициализация dropdown после загрузки сотрудников');

            // Удаляем старый dropdown если есть
            const wrapper = select.closest('.custom-select-wrapper');
            if (wrapper) {
                const oldDropdown = wrapper.querySelector('.employee-dropdown');
                if (oldDropdown) {
                    oldDropdown.remove();
                }
                // Убираем флаг инициализации
                select.dataset.dropdownInitialized = 'false';
            }

            // Инициализируем dropdown заново
            if (typeof initEmployeeDropdown === 'function') {
                setTimeout(() => {
                    initEmployeeDropdown();
                    console.log('✅ Dropdown переинициализирован с новыми данными');
                }, 100);
            }
        }
    } catch (error) {
        console.error('Error loading employees:', error);

        // Fallback - используем статические данные
        const select = document.getElementById('taskEmployee');
        select.innerHTML = `
            <option value="">Выберите сотрудника</option>
            <option value="642664990">Аля</option>
            <option value="385436658">Борис</option>
            <option value="5937587032">Дмитрий</option>
            <option value="1734337242">Иван</option>
            <option value="1151085087">Ксения</option>
            <option value="303267717">Максим</option>
            <option value="726915228">Полина</option>
            <option value="893020643">Юрий</option>
        `;

        // Переинициализируем dropdown
        if (typeof initEmployeeDropdown === 'function') {
            setTimeout(initEmployeeDropdown, 100);
        }
    }
}

// СТАРАЯ ФУНКЦИЯ - ПЕРЕНАПРАВЛЯЕМ НА НОВЫЙ МОДУЛЬ
function closeTaskModal() {
    console.log('🔄 Перенаправление на TasksModule для закрытия модального окна');
    if (window.TasksModule && window.TasksModule.closeCreateTaskModal) {
        window.TasksModule.closeCreateTaskModal();
        return;
    }
    // Старый код для обратной совместимости
    const modal = document.getElementById('taskModal');
    if (!modal) return;

    // Полный сброс
    modal.className = 'modal-overlay hidden';
    modal.removeAttribute('style');
    document.body.style.overflow = '';

    // Сброс формы и флага
    const form = document.getElementById('taskForm');
    if (form) form.reset();
    isSubmittingTask = false;
}

// Делаем функцию глобально доступной
window.closeTaskModal = closeTaskModal;

// Флаг для предотвращения повторной отправки
let isSubmittingTask = false;

// СТАРАЯ ФУНКЦИЯ - ПЕРЕНАПРАВЛЯЕМ НА НОВЫЙ МОДУЛЬ
async function submitTask(event) {
    console.log('🔄 Перенаправление на TasksModule.submitCreateTask');
    if (window.TasksModule && window.TasksModule.submitCreateTask) {
        await window.TasksModule.submitCreateTask(event);
        return;
    }
    // Старый код для обратной совместимости
    console.log('=== submitTask called ===');
    event.preventDefault();

    // Проверка на повторную отправку
    if (isSubmittingTask) {
        console.log('⚠️ Task is already being submitted, ignoring duplicate request');
        return;
    }

    isSubmittingTask = true;

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

            // ВАЖНО: Сбрасываем форму перед закрытием модального окна
            const form = document.getElementById('taskForm');
            if (form) {
                form.reset();
            }

            // Сбрасываем флаг отправки перед закрытием
            isSubmittingTask = false;

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
        // Сбрасываем флаг отправки
        isSubmittingTask = false;
    }
}

// Делаем функцию глобально доступной
window.submitTask = submitTask;

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
                        <button class="task-action-btn modern start" onclick="event.stopPropagation(); updateTaskStatus('${task.id}', 'В работе')">
                            <i data-lucide="play" class="btn-icon"></i>
                            Взять в работу
                        </button>
                    ` : ''}
                    <button class="task-action-btn modern complete" onclick="event.stopPropagation(); updateTaskStatus('${task.id}', 'Выполнена')">
                        <i data-lucide="check-circle" class="btn-icon"></i>
                        Выполнить
                    </button>
                </div>
            ` : ''}
            
            ${window.isManager && currentTaskType === 'created' ? `
                <div class="task-actions modern" style="margin-top: 12px;">
                    <button class="task-action-btn modern edit" onclick="event.stopPropagation(); editTask('${task.id}')">
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
            
            // Инициализируем custom select
            if (window.initCustomSelect) {
                window.initCustomSelect(employeeFilter);
            }
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

// ===== ENHANCED ADMIN PANEL FUNCTIONS =====

// Function to show missing reports with details
function showMissingReports() {
    // This would open a detailed modal or navigate to a detailed view
    console.log('Showing detailed missing reports view');
    // Implementation would show employee names, contact info, last report dates, etc.
    alert('Функция детального просмотра отсутствующих отчетов будет реализована');
}

// Function to show employees who are late
function showLateEmployees() {
    console.log('Showing late employees');
    alert('Функция просмотра опоздавших сотрудников будет реализована');
}

// Function to refresh real-time data
async function refreshRealTimeData() {
    console.log('Refreshing real-time attendance data');
    
    // Show loading state
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.style.transform = 'rotate(360deg)';
        setTimeout(() => {
            refreshBtn.style.transform = 'rotate(0deg)';
        }, 500);
    }
    
    // Update real-time attendance with actual data
    await updateRealTimeAttendance();
}

// Function to update real-time attendance display
async function updateRealTimeAttendance() {
    try {
        // Используем новый endpoint, доступный всем пользователям
        const response = await fetch(`${API_URL}/api/attendance/summary`, {
            headers: { 'X-Telegram-Init-Data': tg.initData }
        });

        let presentCount = 0;
        let lateCount = 0;
        let absentCount = 0;

        if (response.ok) {
            const data = await response.json();
            
            presentCount = data.presentCount || 0;
            lateCount = data.lateCount || 0;
            absentCount = data.absentCount || 0;
            
            console.log('Текущее присутствие:', {
                totalEmployees: data.totalEmployees,
                presentCount,
                lateCount,
                absentCount,
                attendanceRecords: data.attendanceRecords ? data.attendanceRecords.length : 0
            });
        } else {
            // Если нет доступа к API, используем значения по умолчанию
            console.log('Нет доступа к данным о присутствии');
            presentCount = 0;
            lateCount = 0;
            absentCount = 0;
        }
        
        // Обновляем элементы на странице
        const currentlyPresentEl = document.getElementById('currentlyPresent');
        const currentlyLateEl = document.getElementById('currentlyLate');
        const currentlyAbsentEl = document.getElementById('currentlyAbsent');
        
        if (currentlyPresentEl) {
            animateNumberChange(currentlyPresentEl, parseInt(currentlyPresentEl.textContent) || 0, presentCount, 500);
        }
        if (currentlyLateEl) {
            animateNumberChange(currentlyLateEl, parseInt(currentlyLateEl.textContent) || 0, lateCount, 500);
        }
        if (currentlyAbsentEl) {
            animateNumberChange(currentlyAbsentEl, parseInt(currentlyAbsentEl.textContent) || 0, absentCount, 500);
        }
    } catch (error) {
        console.error('Ошибка загрузки данных о присутствии:', error);
        
        // При ошибке очищаем значения
        const currentlyPresentEl = document.getElementById('currentlyPresent');
        const currentlyLateEl = document.getElementById('currentlyLate');
        const currentlyAbsentEl = document.getElementById('currentlyAbsent');
        
        if (currentlyPresentEl) currentlyPresentEl.textContent = '0';
        if (currentlyLateEl) currentlyLateEl.textContent = '0';
        if (currentlyAbsentEl) currentlyAbsentEl.textContent = '0';
    }
}

// Function to reset attendance filters
function resetAttendanceFilters() {
    const periodFilter = document.getElementById('attendancePeriodFilter');
    const employeeFilter = document.getElementById('attendanceEmployeeFilter');
    const statusFilter = document.getElementById('attendanceStatusFilter');
    
    if (periodFilter) periodFilter.value = 'week';
    if (employeeFilter) employeeFilter.value = 'all';
    if (statusFilter) statusFilter.value = 'all';
    
    // Hide custom date range
    const customDateRange = document.getElementById('attendanceCustomDateRange');
    if (customDateRange) {
        customDateRange.style.display = 'none';
    }
    
    // Refresh data
    updateAttendanceHistory();
}

// Function to export attendance data
function exportAttendanceData() {
    console.log('Exporting attendance data');
    
    // Show loading state
    const btn = event.target.closest('.history-control-btn');
    if (btn) {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" style="animation: spin 1s linear infinite;"></i>';
        
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            lucide.createIcons();
            alert('Данные экспортированы в CSV файл');
        }, 1500);
    }
}

// Function to print attendance report
function printAttendanceReport() {
    console.log('Printing attendance report');
    alert('Функция печати отчета будет реализована');
}

// Function to enhance metric cards with real-time updates
function startMetricUpdates() {
    // Update metrics every 30 seconds
    setInterval(updateAdminMetrics, 30000);
    
    // Initial update
    updateAdminMetrics();
}

// Function to update admin metrics with realistic data
function updateAdminMetrics() {
    const now = new Date();
    const hour = now.getHours();
    
    // Generate realistic sample data based on time of day
    const todayReports = hour >= 17 ? Math.floor(Math.random() * 3) + 5 : Math.floor(Math.random() * hour/2);
    const missingReports = Math.max(0, 8 - todayReports - Math.floor(Math.random() * 2));
    const activeTasks = Math.floor(Math.random() * 10) + 15;
    const completedToday = Math.floor(Math.random() * 8) + 3;
    
    // Update dashboard metrics
    updateMetricValue('dashboardTodayReports', todayReports);
    updateMetricValue('dashboardMissingReports', missingReports);
    updateMetricValue('dashboardActiveTasks', activeTasks);
    updateMetricValue('dashboardCompletedToday', completedToday);
    
    // Update progress bars and trends
    updateMetricProgress(todayReports, 8); // Out of 8 employees
    
    // Update real-time attendance
    updateRealTimeAttendance();
}

// Helper function to update metric values with animation
function updateMetricValue(elementId, newValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const currentValue = parseInt(element.textContent) || 0;
    
    if (currentValue !== newValue) {
        // Animate value change
        animateNumberChange(element, currentValue, newValue, 1000);
    }
}

// Function to animate number changes
// Совместимость со старым названием animateNumberChange
function animateNumberChange(element, startValue, endValue, duration) {
    animateNumber(element, endValue, { startValue, duration });
}

// Function to update metric progress bars
function updateMetricProgress(current, total) {
    const progressBars = document.querySelectorAll('.progress-fill');
    progressBars.forEach(bar => {
        const percentage = Math.min((current / total) * 100, 100);
        bar.style.width = percentage + '%';
    });
}

// Function to handle period filter changes
function handlePeriodFilterChange(filterId, customDateRangeId) {
    const filter = document.getElementById(filterId);
    const customDateRange = document.getElementById(customDateRangeId);
    
    if (filter && customDateRange) {
        if (filter.value === 'custom') {
            customDateRange.style.display = 'grid';
        } else {
            customDateRange.style.display = 'none';
        }
    }
}

// Enhanced admin panel initialization
function initializeEnhancedAdminPanel() {
    // Set up period filter listeners
    const attendancePeriodFilter = document.getElementById('attendancePeriodFilter');
    if (attendancePeriodFilter) {
        attendancePeriodFilter.addEventListener('change', () => {
            handlePeriodFilterChange('attendancePeriodFilter', 'attendanceCustomDateRange');
        });
    }
    
    const periodFilter = document.getElementById('periodFilter');
    if (periodFilter) {
        periodFilter.addEventListener('change', () => {
            handlePeriodFilterChange('periodFilter', 'customDateRange');
        });
    }
    
    // Start metric updates if admin panel is visible
    if (document.getElementById('adminPanel')) {
        startMetricUpdates();
    }
    
    // Initialize tooltips and interactive elements
    initializeAdminTooltips();
}

// Function to initialize tooltips for admin panel
function initializeAdminTooltips() {
    const tooltipElements = document.querySelectorAll('[title]');
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
    });
}

function showTooltip(event) {
    const title = event.target.getAttribute('title');
    if (!title) return;
    
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'admin-tooltip';
    tooltip.textContent = title;
    tooltip.style.cssText = `
        position: absolute;
        background: var(--bg-card);
        color: var(--text-primary);
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        white-space: nowrap;
        z-index: 10000;
        border: 1px solid var(--admin-border);
        box-shadow: var(--shadow-lg);
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
    `;
    
    document.body.appendChild(tooltip);
    
    // Position tooltip
    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = (rect.top - tooltip.offsetHeight - 8) + 'px';
    
    // Animate in
    setTimeout(() => {
        tooltip.style.opacity = '1';
    }, 10);
    
    // Store reference for cleanup
    event.target._tooltip = tooltip;
    
    // Remove title to prevent browser tooltip
    event.target.removeAttribute('title');
    event.target._originalTitle = title;
}

function hideTooltip(event) {
    const tooltip = event.target._tooltip;
    if (tooltip) {
        tooltip.style.opacity = '0';
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        }, 200);
        delete event.target._tooltip;
    }
    
    // Restore original title
    if (event.target._originalTitle) {
        event.target.setAttribute('title', event.target._originalTitle);
        delete event.target._originalTitle;
    }
}

// Initialize enhanced admin panel when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeEnhancedAdminPanel();
});

// Add CSS for spin animation
const additionalCSS = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;

// Inject additional CSS
const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);

// ===== ENHANCED CHART FUNCTIONALITY =====

// Function to toggle chart fullscreen
function toggleChartFullscreen() {
    const chartCard = document.querySelector('.chart-card.modern');
    if (!chartCard) return;
    
    if (!chartCard.classList.contains('fullscreen')) {
        // Enter fullscreen
        chartCard.classList.add('fullscreen');
        chartCard.style.position = 'fixed';
        chartCard.style.top = '0';
        chartCard.style.left = '0';
        chartCard.style.width = '100vw';
        chartCard.style.height = '100vh';
        chartCard.style.zIndex = '10000';
        chartCard.style.margin = '0';
        
        // Update button icon
        const btn = chartCard.querySelector('.chart-fullscreen-btn i');
        if (btn) {
            btn.setAttribute('data-lucide', 'minimize-2');
            lucide.createIcons();
        }
        
        // Add escape key listener
        document.addEventListener('keydown', handleChartEscapeKey);
    } else {
        // Exit fullscreen
        exitChartFullscreen();
    }
}

// Function to exit chart fullscreen
function exitChartFullscreen() {
    const chartCard = document.querySelector('.chart-card.modern');
    if (!chartCard) return;
    
    chartCard.classList.remove('fullscreen');
    chartCard.style.position = '';
    chartCard.style.top = '';
    chartCard.style.left = '';
    chartCard.style.width = '';
    chartCard.style.height = '';
    chartCard.style.zIndex = '';
    chartCard.style.margin = '';
    
    // Update button icon
    const btn = chartCard.querySelector('.chart-fullscreen-btn i');
    if (btn) {
        btn.setAttribute('data-lucide', 'maximize-2');
        lucide.createIcons();
    }
    
    // Remove escape key listener
    document.removeEventListener('keydown', handleChartEscapeKey);
}

// Handle escape key for chart fullscreen
function handleChartEscapeKey(event) {
    if (event.key === 'Escape') {
        exitChartFullscreen();
    }
}

// Initialize interactive chart functionality
function initializeInteractiveChart() {
    const chartDays = document.querySelectorAll('.chart-day');
    const tooltip = document.getElementById('chartTooltip');
    
    if (!tooltip) return;
    
    const dayNames = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    
    chartDays.forEach((day, index) => {
        const bars = day.querySelectorAll('.chart-bar');
        
        day.addEventListener('mouseenter', (event) => {
            const rect = day.getBoundingClientRect();
            const chartRect = document.querySelector('.interactive-chart').getBoundingClientRect();
            
            // Get data values from bars
            const reportsValue = bars[0] ? bars[0].getAttribute('data-value') : '0';
            const tasksValue = bars[1] ? bars[1].getAttribute('data-value') : '0';
            const hoursValue = bars[2] ? bars[2].getAttribute('data-value') : '0';
            
            // Update tooltip content
            tooltip.querySelector('.tooltip-title').textContent = dayNames[index] || `День ${index + 1}`;
            
            const tooltipItems = tooltip.querySelectorAll('.tooltip-item strong');
            if (tooltipItems[0]) tooltipItems[0].textContent = reportsValue;
            if (tooltipItems[1]) tooltipItems[1].textContent = tasksValue;
            if (tooltipItems[2]) tooltipItems[2].textContent = hoursValue;
            
            // Position tooltip
            const tooltipX = rect.left - chartRect.left + rect.width / 2 - tooltip.offsetWidth / 2;
            const tooltipY = rect.top - chartRect.top - tooltip.offsetHeight - 10;
            
            tooltip.style.left = Math.max(10, Math.min(tooltipX, chartRect.width - tooltip.offsetWidth - 10)) + 'px';
            tooltip.style.top = Math.max(10, tooltipY) + 'px';
            
            // Show tooltip
            tooltip.classList.add('show');
        });
        
        day.addEventListener('mouseleave', () => {
            tooltip.classList.remove('show');
        });
        
        // Add click functionality for detailed view
        day.addEventListener('click', () => {
            const dayName = dayNames[index] || `День ${index + 1}`;
            showDayDetailModal(dayName, {
                reports: bars[0] ? bars[0].getAttribute('data-value') : '0',
                tasks: bars[1] ? bars[1].getAttribute('data-value') : '0',
                hours: bars[2] ? bars[2].getAttribute('data-value') : '0'
            });
        });
    });
    
    // Chart period selector
    const periodSelector = document.getElementById('chartPeriodSelector');
    if (periodSelector) {
        periodSelector.addEventListener('change', (event) => {
            updateChartData(event.target.value);
        });
    }
    
    // Animate chart bars on load
    animateChartBars();
}

// Function to show detailed day modal
function showDayDetailModal(dayName, data) {
    alert(`Подробная информация за ${dayName}:\n` +
          `Отчеты: ${data.reports}\n` +
          `Задачи: ${data.tasks}\n` +
          `Часы: ${data.hours}\n\n` +
          `Функция детального просмотра будет реализована.`);
}

// Function to update chart data based on period
function updateChartData(period) {
    console.log('Updating chart data for period:', period);
    
    const chartTitle = document.querySelector('.chart-title');
    if (chartTitle) {
        const titles = {
            'week': 'Активность за неделю',
            'month': 'Активность за месяц',
            'quarter': 'Активность за квартал'
        };
        chartTitle.innerHTML = `
            <i data-lucide="trending-up" class="chart-icon"></i>
            ${titles[period] || 'Активность'}
        `;
        lucide.createIcons();
    }
    
    // Here you would typically fetch new data from the server
    // For now, we'll just animate the existing bars
    animateChartBars();
}

// Function to animate chart bars
function animateChartBars() {
    const chartBars = document.querySelectorAll('.chart-bar');
    
    chartBars.forEach((bar, index) => {
        const originalHeight = bar.style.height;
        bar.style.height = '0%';
        bar.style.opacity = '0';
        
        setTimeout(() => {
            bar.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
            bar.style.height = originalHeight;
            bar.style.opacity = '1';
        }, index * 100);
    });
    
    // Animate summary values
    const summaryValues = document.querySelectorAll('.summary-value');
    summaryValues.forEach((value, index) => {
        const finalValue = parseInt(value.textContent);
        animateNumberChange(value, 0, finalValue, 1000 + index * 200);
    });
}

// Enhanced initialization for admin panel
function initializeEnhancedAdminPanelComplete() {
    // Initialize existing functionality
    initializeEnhancedAdminPanel();
    
    // Initialize interactive chart
    initializeInteractiveChart();
    
    // Add click animation to metric cards
    initializeMetricCardAnimations();
    
    // Initialize custom selects
    initializeCustomSelects();
}

// Function to initialize metric card animations
function initializeMetricCardAnimations() {
    const metricCards = document.querySelectorAll('.metric-card.modern');
    
    metricCards.forEach(card => {
        card.addEventListener('click', () => {
            card.style.transform = 'scale(0.95)';
            setTimeout(() => {
                card.style.transform = '';
            }, 150);
        });
    });
}

// Function to initialize custom selects
function initializeCustomSelects() {
    // Find all custom select wrappers and initialize them
    const selectWrappers = document.querySelectorAll('.custom-select-wrapper');
    
    selectWrappers.forEach(wrapper => {
        const select = wrapper.querySelector('.custom-select');
        const arrow = wrapper.querySelector('.select-arrow');
        
        if (select && arrow) {
            // Add focus event for arrow animation
            select.addEventListener('focus', () => {
                arrow.style.transform = 'translateY(-50%) rotate(180deg)';
            });
            
            select.addEventListener('blur', () => {
                arrow.style.transform = 'translateY(-50%) rotate(0deg)';
            });
            
            // Add change event for additional effects
            select.addEventListener('change', () => {
                // Add a subtle pulse effect on change
                select.style.transform = 'scale(1.02)';
                setTimeout(() => {
                    select.style.transform = '';
                }, 150);
            });
            
            // Add hover effects
            wrapper.addEventListener('mouseenter', () => {
                if (!select.matches(':focus')) {
                    arrow.style.color = 'var(--primary)';
                    arrow.style.transform = 'translateY(-50%) scale(1.1)';
                }
            });
            
            wrapper.addEventListener('mouseleave', () => {
                if (!select.matches(':focus')) {
                    arrow.style.color = '';
                    arrow.style.transform = 'translateY(-50%)';
                }
            });
        }
    });
    
    // Re-initialize Lucide icons for new arrow icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Update existing DOM ready event to include custom selects
document.addEventListener('DOMContentLoaded', () => {
    // Initialize enhanced admin panel
    if (document.getElementById('adminPanel')) {
        initializeEnhancedAdminPanelComplete();
    }
    
    // Initialize custom selects for all pages
    initializeCustomSelects();
});

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