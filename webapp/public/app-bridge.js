// Переходной файл для совместимости старого кода с новыми webpack модулями
// Постепенно перенаправляет вызовы на новую модульную архитектуру

console.log('🌉 Загрузка переходного моста app-bridge.js');

// Ждем загрузку webpack приложения и делегируем ему функции
document.addEventListener('DOMContentLoaded', function() {
    console.log('📦 Проверка доступности webpack модулей...');

    // Проверяем наличие webpack приложения с задержкой
    let checkAttempts = 0;
    const maxAttempts = 20; // 2 секунды

    const checkWebpack = setInterval(() => {
        checkAttempts++;

        if (window.KaifApp || window.showCreateTaskModal) {
            clearInterval(checkWebpack);
            console.log('✅ Webpack модули обнаружены после', checkAttempts, 'попыток');
            setupBridge();
        } else if (checkAttempts >= maxAttempts) {
            clearInterval(checkWebpack);
            console.warn('⚠️ Webpack модули не найдены, используем старый код');
        }
    }, 100);
});

function setupBridge() {
    console.log('🔗 Настройка моста между старым и новым кодом');

    // Сохраняем ссылки на старые функции
    const oldFunctions = {
        showCreateTaskModal: window.showCreateTaskModal,
        closeTaskModal: window.closeTaskModal,
        showPage: window.showPage,
        submitTask: window.submitTask,
        toggleFab: window.toggleFab
    };

    // Проверяем наличие новых функций и используем их
    if (window.showCreateTaskModal && typeof window.showCreateTaskModal === 'function') {
        console.log('✅ Используем новый showCreateTaskModal из webpack');
    }

    if (window.closeTaskModal && typeof window.closeTaskModal === 'function') {
        console.log('✅ Используем новый closeTaskModal из webpack');
    }

    if (window.showPage && typeof window.showPage === 'function') {
        console.log('✅ Используем новый showPage из webpack');
    }

    if (window.submitTask && typeof window.submitTask === 'function') {
        console.log('✅ Используем новый submitTask из webpack');
    }

    if (window.toggleFab && typeof window.toggleFab === 'function') {
        console.log('✅ Используем новый toggleFab из webpack');
    }

    // Дополнительная проверка для модального окна
    const modal = document.getElementById('taskModal');
    if (modal) {
        console.log('✅ Модальное окно найдено в DOM');

        // Убеждаемся что модальное окно скрыто при старте
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

// Экспортируем функцию для диагностики
window.debugBridge = function() {
    console.log('=== ДИАГНОСТИКА МОСТА ===');
    console.log('KaifApp:', !!window.KaifApp);
    console.log('showCreateTaskModal:', typeof window.showCreateTaskModal);
    console.log('closeTaskModal:', typeof window.closeTaskModal);
    console.log('showPage:', typeof window.showPage);
    console.log('submitTask:', typeof window.submitTask);
    console.log('toggleFab:', typeof window.toggleFab);

    const modal = document.getElementById('taskModal');
    console.log('Modal element:', !!modal);
    if (modal) {
        console.log('Modal classes:', modal.className);
        console.log('Modal display:', window.getComputedStyle(modal).display);
    }

    console.log('=== КОНЕЦ ДИАГНОСТИКИ ===');
};

console.log('✅ Мост app-bridge.js загружен');