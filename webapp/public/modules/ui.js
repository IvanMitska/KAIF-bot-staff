// Модуль UI и анимаций
export const UI = {
    // Показать уведомление
    showNotification(message, type = 'info') {
        const tg = window.Telegram.WebApp;
        console.log(`Notification [${type}]:`, message);

        if (tg.showAlert) {
            tg.showAlert(message);
        } else {
            alert(message);
        }
    },

    // Анимация чисел
    animateNumber(element, endValue, options = {}) {
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
    },

    // Показать страницу
    showPage(pageId) {
        const pages = document.querySelectorAll('.page');
        const navItems = document.querySelectorAll('.nav-item');

        pages.forEach(page => {
            page.classList.remove('active');
        });

        navItems.forEach(item => {
            item.classList.remove('active');
        });

        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
        }

        const targetNav = document.querySelector(`[onclick*="showPage('${pageId}')"]`);
        if (targetNav) {
            targetNav.classList.add('active');
        }

        window.scrollTo(0, 0);
    },

    // Создать ripple эффект
    createRipple(event, button) {
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');

        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';

        button.appendChild(ripple);

        setTimeout(() => {
            ripple.remove();
        }, 600);
    },

    // Инициализация современного UI
    initializeModernUI() {
        // Добавление ripple эффекта
        document.addEventListener('click', (e) => {
            const button = e.target.closest('.attendance-btn.modern, .submit-btn.modern, .fab-main, .action-card.modern');
            if (button) {
                this.createRipple(e, button);
            }
        });

        // Добавление анимаций при загрузке
        const cards = document.querySelectorAll('.stat-card, .action-card');
        cards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
            card.classList.add('fade-in-up');
        });
    },

    // Форматирование даты
    formatDate(date, format = 'short') {
        const d = new Date(date);

        if (format === 'short') {
            return d.toLocaleDateString('ru');
        } else if (format === 'long') {
            return d.toLocaleDateString('ru', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } else if (format === 'time') {
            return d.toLocaleTimeString('ru', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        return d.toLocaleString('ru');
    },

    // Показать загрузку
    showLoading(container, message = 'Загрузка...') {
        if (typeof container === 'string') {
            container = document.getElementById(container);
        }

        if (container) {
            container.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <p>${message}</p>
                </div>
            `;
        }
    },

    // Показать ошибку
    showError(container, message = 'Произошла ошибка', retryCallback = null) {
        if (typeof container === 'string') {
            container = document.getElementById(container);
        }

        if (container) {
            let html = `
                <div class="error-message">
                    <p>${message}</p>
            `;

            if (retryCallback) {
                html += `<button onclick="${retryCallback}">Повторить</button>`;
            }

            html += '</div>';
            container.innerHTML = html;
        }
    },

    // Показать пустое состояние
    showEmpty(container, message = 'Нет данных для отображения') {
        if (typeof container === 'string') {
            container = document.getElementById(container);
        }

        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>${message}</p>
                </div>
            `;
        }
    }
};