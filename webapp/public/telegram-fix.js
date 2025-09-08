// Telegram WebApp Authorization Fix
// Этот скрипт исправляет проблемы с авторизацией в Telegram WebApp

(function() {
    console.log('🔧 Telegram Fix loading...');
    
    // Ждем инициализацию Telegram WebApp
    function waitForTelegram() {
        if (window.Telegram && window.Telegram.WebApp) {
            const tg = window.Telegram.WebApp;
            
            console.log('📱 Telegram WebApp detected:', {
                initData: tg.initData ? 'Present' : 'Missing',
                initDataUnsafe: tg.initDataUnsafe,
                platform: tg.platform,
                version: tg.version
            });
            
            // Если initData отсутствует, пробуем получить его другими способами
            if (!tg.initData) {
                console.warn('⚠️ No initData found, checking alternative sources...');
                
                // Проверяем URL параметры
                const urlParams = new URLSearchParams(window.location.search);
                const tgWebAppData = urlParams.get('tgWebAppData');
                
                if (tgWebAppData) {
                    console.log('✅ Found tgWebAppData in URL');
                    // Можно попробовать использовать эти данные
                }
                
                // Проверяем hash
                if (window.location.hash) {
                    const hashParams = new URLSearchParams(window.location.hash.substring(1));
                    const hashData = hashParams.get('tgWebAppData');
                    if (hashData) {
                        console.log('✅ Found tgWebAppData in hash');
                    }
                }
                
                // Если есть параметр test, включаем тестовый режим
                if (urlParams.has('test')) {
                    console.log('🧪 Test mode detected, enabling bypass...');
                    
                    // Переопределяем fetch для автоматического добавления test параметра
                    const originalFetch = window.fetch;
                    window.fetch = function(url, options = {}) {
                        if (typeof url === 'string' && url.includes('/api/')) {
                            const separator = url.includes('?') ? '&' : '?';
                            const newUrl = url + separator + 'test=1';
                            console.log('🔄 Modified request:', newUrl);
                            
                            // Убираем X-Telegram-Init-Data из заголовков если его нет
                            if (options.headers && options.headers['X-Telegram-Init-Data'] === undefined) {
                                delete options.headers['X-Telegram-Init-Data'];
                            }
                            
                            return originalFetch(newUrl, options);
                        }
                        return originalFetch(url, options);
                    };
                    
                    // Показываем уведомление о тестовом режиме
                    setTimeout(() => {
                        const existing = document.getElementById('test-mode-banner');
                        if (!existing) {
                            const banner = document.createElement('div');
                            banner.id = 'test-mode-banner';
                            banner.style.cssText = `
                                position: fixed;
                                top: 10px;
                                left: 50%;
                                transform: translateX(-50%);
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                color: white;
                                padding: 8px 16px;
                                border-radius: 20px;
                                font-size: 12px;
                                z-index: 10000;
                                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                                animation: slideDown 0.3s ease;
                            `;
                            banner.innerHTML = '🧪 Тестовый режим (Пользователь: Иван)';
                            document.body.appendChild(banner);
                        }
                    }, 500);
                }
            } else {
                console.log('✅ Telegram initData is present');
            }
            
            // Убеждаемся, что WebApp готов
            if (!tg.isExpanded) {
                tg.expand();
            }
            tg.ready();
            
        } else {
            // Повторяем через 100мс
            setTimeout(waitForTelegram, 100);
        }
    }
    
    // Запускаем проверку
    waitForTelegram();
    
    // Добавляем CSS для анимации
    if (!document.getElementById('telegram-fix-styles')) {
        const style = document.createElement('style');
        style.id = 'telegram-fix-styles';
        style.textContent = `
            @keyframes slideDown {
                from {
                    opacity: 0;
                    transform: translateX(-50%) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }
})();