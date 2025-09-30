// Минимальный app.js для обратной совместимости
// Основная логика перенесена в модули в папке modules/

// Инициализация Telegram Web App (для старого кода)
const tg = window.Telegram.WebApp;

// API URL
const API_URL = window.location.origin;

// Глобальные переменные (для обратной совместимости)
let currentUser = null;
let currentFilter = 'all';
let currentTaskType = 'my';
let currentTasks = [];
let isSubmittingTask = false;

// Функция getApiUrl для старого кода
function getApiUrl(endpoint) {
    const urlParams = new URLSearchParams(window.location.search);
    const isTestMode = urlParams.has('test') || window.location.search.includes('test=');

    if (!tg.initData || isTestMode) {
        const separator = endpoint.includes('?') ? '&' : '?';
        return `${API_URL}${endpoint}${separator}test=1`;
    }
    return `${API_URL}${endpoint}`;
}

// Функция showNotification для старого кода
function showNotification(message, type = 'info') {
    console.log(`Notification [${type}]:`, message);
    if (tg.showAlert) {
        tg.showAlert(message);
    } else {
        alert(message);
    }
}

// Заглушки для старых функций, которые теперь в модулях
// Они будут переопределены модулями при загрузке

function showPage(pageId) {
    console.log('showPage будет инициализирована модулем');
}

function showTasks() {
    console.log('showTasks будет инициализирована модулем');
}

function showEmployees() {
    console.log('showEmployees будет инициализирована модулем');
}

function showReportForm() {
    console.log('showReportForm будет инициализирована модулем');
}

function checkIn() {
    console.log('checkIn будет инициализирована модулем');
}

function checkOut() {
    console.log('checkOut будет инициализирована модулем');
}

function showCreateTaskModal(employeeId, employeeName) {
    console.log('showCreateTaskModal будет инициализирована модулем');
}

function closeTaskModal() {
    console.log('closeTaskModal будет инициализирована модулем');
}

function submitTask(event) {
    console.log('submitTask будет инициализирована модулем');
}

// Анимация чисел (оставляем тут для обратной совместимости)
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

function animateNumberChange(element, startValue, endValue, duration) {
    animateNumber(element, endValue, { startValue, duration });
}

console.log('📦 Минимальный app.js загружен. Основная логика в модулях.');