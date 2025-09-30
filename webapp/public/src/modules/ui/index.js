// UI модуль для управления интерфейсом
export class UIModule {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.notifications = [];
        this.modals = new Map();
    }

    initialize() {
        this.setupGlobalHandlers();
        this.setupNotifications();
    }

    setupGlobalHandlers() {
        // Закрытие модальных окон по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeActiveModal();
            }
        });

        // Закрытие модальных окон по клику на фон
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });
    }

    setupNotifications() {
        // Подписка на события уведомлений
        this.eventBus.on('notification', (message, type = 'info') => {
            this.showNotification(message, type);
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        const container = this.getNotificationContainer();
        container.appendChild(notification);

        // Анимация появления
        setTimeout(() => notification.classList.add('show'), 10);

        // Автоматическое скрытие
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    getNotificationContainer() {
        let container = document.getElementById('notifications');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notifications';
            container.className = 'notifications-container';
            document.body.appendChild(container);
        }
        return container;
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            this.modals.set(modalId, modal);
            this.eventBus.emit('modal:opened', modalId);
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            this.modals.delete(modalId);
            this.eventBus.emit('modal:closed', modalId);
        }
    }

    closeActiveModal() {
        const activeModal = Array.from(this.modals.keys()).pop();
        if (activeModal) {
            this.closeModal(activeModal);
        }
    }

    showLoading(container = document.body) {
        const loader = document.createElement('div');
        loader.className = 'loader';
        loader.innerHTML = `
            <div class="spinner"></div>
            <p>Загрузка...</p>
        `;
        container.appendChild(loader);
        return loader;
    }

    hideLoading(loader) {
        if (loader && loader.parentNode) {
            loader.remove();
        }
    }

    confirm(message) {
        return new Promise((resolve) => {
            if (window.Telegram?.WebApp?.showConfirm) {
                window.Telegram.WebApp.showConfirm(message, resolve);
            } else {
                resolve(window.confirm(message));
            }
        });
    }

    alert(message) {
        if (window.Telegram?.WebApp?.showAlert) {
            window.Telegram.WebApp.showAlert(message);
        } else {
            window.alert(message);
        }
    }

    updateTheme(theme) {
        document.body.className = `theme-${theme}`;
        this.eventBus.emit('theme:changed', theme);
    }

    animateCounter(element, start, end, duration = 1000) {
        const range = end - start;
        const startTime = performance.now();

        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const value = Math.floor(start + range * this.easeOutQuart(progress));
            element.textContent = value;

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };

        requestAnimationFrame(update);
    }

    easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
    }
}