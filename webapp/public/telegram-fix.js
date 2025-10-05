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
                
                // Режим разработки только для localhost
                if (window.location.hostname === 'localhost' && urlParams.has('test')) {
                    console.log('🔧 Development mode on localhost');

                    // В режиме разработки добавляем test параметр
                    const originalFetch = window.fetch;
                    window.fetch = function(url, options = {}) {
                        if (typeof url === 'string' && url.includes('/api/')) {
                            // Добавляем test=1 только если его нет
                            let newUrl = url;
                            if (!url.includes('test=1')) {
                                const separator = url.includes('?') ? '&' : '?';
                                newUrl = url + separator + 'test=1';
                            }
                            return originalFetch(newUrl, options);
                        }
                        return originalFetch(url, options);
                    };
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