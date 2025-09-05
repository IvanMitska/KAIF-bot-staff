// ===== TELEGRAM WEBAP INTEGRATION LAYER =====

// Инициализация Telegram WebApp с расширенной диагностикой
const TelegramIntegration = {
    tg: window.Telegram?.WebApp,
    isInitialized: false,
    initData: null,
    user: null,
    
    // Инициализация
    init() {
        if (!this.tg) {
            console.error('Telegram WebApp not available');
            this.useFallbackMode();
            return false;
        }
        
        try {
            this.tg.ready();
            this.tg.expand();
            
            // Сохраняем данные
            this.initData = this.tg.initData || '';
            this.user = this.tg.initDataUnsafe?.user || null;
            
            // Диагностика
            console.log('Telegram WebApp initialized:', {
                hasInitData: !!this.initData,
                initDataLength: this.initData.length,
                user: this.user,
                version: this.tg.version,
                platform: this.tg.platform
            });
            
            this.isInitialized = true;
            
            // Применяем тему
            this.applyTheme();
            
            // Устанавливаем пользователя
            this.setUserInfo();
            
            return true;
            
        } catch (error) {
            console.error('Error initializing Telegram WebApp:', error);
            this.useFallbackMode();
            return false;
        }
    },
    
    // Fallback режим для разработки
    useFallbackMode() {
        console.log('Using fallback mode (development)');
        
        // Эмулируем данные пользователя для разработки
        this.user = {
            id: 123456789,
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser'
        };
        
        this.initData = 'mock_init_data_for_development';
        
        // Устанавливаем информацию о пользователе
        this.setUserInfo();
    },
    
    // Установка информации о пользователе в UI
    setUserInfo() {
        if (this.user) {
            const userName = document.getElementById('userName');
            if (userName) {
                userName.textContent = this.user.first_name || 'Пользователь';
            }
            
            // Обновляем приветствие
            const greeting = document.querySelector('.greeting-text');
            if (greeting) {
                greeting.innerHTML = `
                    Привет, <span class="user-name">${this.user.first_name || 'Пользователь'}</span>! 
                    <span class="greeting-emoji">👋</span>
                `;
            }
        }
    },
    
    // Применение темы
    applyTheme() {
        if (this.tg?.themeParams) {
            const theme = this.tg.themeParams;
            
            // Применяем цвета темы если они есть
            if (theme.bg_color) {
                document.documentElement.style.setProperty('--tg-theme-bg-color', theme.bg_color);
            }
            if (theme.text_color) {
                document.documentElement.style.setProperty('--tg-theme-text-color', theme.text_color);
            }
            if (theme.button_color) {
                document.documentElement.style.setProperty('--tg-theme-button-color', theme.button_color);
            }
        }
    },
    
    // Получение заголовков для API запросов
    getApiHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.initData) {
            headers['X-Telegram-Init-Data'] = this.initData;
        }
        
        return headers;
    },
    
    // Показ уведомления
    showNotification(message, type = 'info') {
        console.log(`[${type}] ${message}`);
        
        if (this.tg?.showAlert) {
            this.tg.showAlert(message);
        } else {
            // Создаем кастомное уведомление
            this.showCustomNotification(message, type);
        }
    },
    
    // Кастомное уведомление
    showCustomNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'custom-notification';
        
        const colors = {
            info: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            error: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
        };
        
        const icons = {
            info: 'info',
            success: 'check-circle',
            error: 'alert-triangle',
            warning: 'alert-circle'
        };
        
        notification.innerHTML = `
            <div class="notification-content">
                <i data-lucide="${icons[type]}"></i>
                <span>${message}</span>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${colors[type]};
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            z-index: 99999;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideInTop 0.3s ease;
            max-width: 90%;
        `;
        
        document.body.appendChild(notification);
        
        // Обновляем иконки
        if (window.lucide) {
            lucide.createIcons();
        }
        
        // Удаляем через 4 секунды
        setTimeout(() => {
            notification.style.animation = 'slideOutTop 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    },
    
    // Показ подтверждения
    showConfirm(message, onConfirm, onCancel) {
        if (this.tg?.showConfirm) {
            this.tg.showConfirm(message, (confirmed) => {
                if (confirmed && onConfirm) {
                    onConfirm();
                } else if (!confirmed && onCancel) {
                    onCancel();
                }
            });
        } else {
            // Fallback на обычный confirm
            const confirmed = confirm(message);
            if (confirmed && onConfirm) {
                onConfirm();
            } else if (!confirmed && onCancel) {
                onCancel();
            }
        }
    },
    
    // Проверка платформы
    getPlatform() {
        return this.tg?.platform || 'web';
    },
    
    // Проверка версии
    getVersion() {
        return this.tg?.version || '1.0';
    },
    
    // Вибрация
    vibrate(style = 'light') {
        if (this.tg?.HapticFeedback) {
            switch (style) {
                case 'light':
                    this.tg.HapticFeedback.impactOccurred('light');
                    break;
                case 'medium':
                    this.tg.HapticFeedback.impactOccurred('medium');
                    break;
                case 'heavy':
                    this.tg.HapticFeedback.impactOccurred('heavy');
                    break;
                case 'success':
                    this.tg.HapticFeedback.notificationOccurred('success');
                    break;
                case 'warning':
                    this.tg.HapticFeedback.notificationOccurred('warning');
                    break;
                case 'error':
                    this.tg.HapticFeedback.notificationOccurred('error');
                    break;
                default:
                    this.tg.HapticFeedback.selectionChanged();
            }
        }
    },
    
    // Открытие ссылки
    openLink(url) {
        if (this.tg?.openLink) {
            this.tg.openLink(url);
        } else {
            window.open(url, '_blank');
        }
    },
    
    // Закрытие приложения
    close() {
        if (this.tg?.close) {
            this.tg.close();
        }
    }
};

// CSS для уведомлений
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideInTop {
        from {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
        }
        to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutTop {
        from {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        to {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
        }
    }
    
    .custom-notification {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .notification-content svg {
        width: 20px;
        height: 20px;
    }
`;
document.head.appendChild(notificationStyles);

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    TelegramIntegration.init();
    
    // Экспортируем глобально для использования в других скриптах
    window.TelegramIntegration = TelegramIntegration;
    
    console.log('Telegram Integration initialized');
});

// Экспорт для других модулей
window.TelegramIntegration = TelegramIntegration;