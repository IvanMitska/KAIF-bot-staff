// КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ МОДАЛЬНОГО ОКНА
// Этот файл переопределяет функции работы с модальным окном

console.log('🔥 ЗАГРУЖЕН modal-fix.js - критическое исправление модального окна');

// Функция для принудительного показа модального окна
function forceShowModal() {
    console.log('🚨 FORCE SHOW MODAL ЗАПУЩЕН');

    const modal = document.getElementById('taskModal');
    if (!modal) {
        console.error('❌ Модальное окно не найдено!');
        // Попытка найти модальное окно с задержкой
        setTimeout(() => {
            const retryModal = document.getElementById('taskModal');
            if (retryModal) {
                console.log('✅ Модальное окно найдено при повторной попытке');
                forceShowModal();
            }
        }, 500);
        return false;
    }

    // Удаляем все возможные блокирующие классы
    modal.classList.remove('hidden', 'hide', 'closed');

    // ПРИНУДИТЕЛЬНО устанавливаем все стили через setAttribute для максимального приоритета
    modal.setAttribute('style', `
        display: flex !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: rgba(0, 0, 0, 0.85) !important;
        backdrop-filter: blur(10px) !important;
        -webkit-backdrop-filter: blur(10px) !important;
        z-index: 999999 !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        align-items: center !important;
        justify-content: center !important;
    `);

    // Добавляем класс show
    modal.classList.add('show');

    // Блокируем скролл
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');

    // Убеждаемся, что модальное окно на переднем плане
    setTimeout(() => {
        if (modal.style.opacity !== '1') {
            console.log('⚠️ Opacity не установлена, принудительно устанавливаем');
            modal.style.setProperty('opacity', '1', 'important');
        }
        if (window.getComputedStyle(modal).display === 'none') {
            console.log('⚠️ Display все еще none, принудительно устанавливаем flex');
            modal.style.setProperty('display', 'flex', 'important');
        }
    }, 100);

    console.log('✅ Модальное окно должно быть видимым');
    return true;
}

// Переопределяем глобальную функцию showCreateTaskModal
const originalShowCreateTaskModal = window.showCreateTaskModal;
window.showCreateTaskModal = function(employeeId = null, employeeName = null) {
    console.log('🎯 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: showCreateTaskModal');

    // Сначала пробуем принудительно показать модальное окно
    if (!forceShowModal()) {
        console.error('❌ Не удалось показать модальное окно');
        return;
    }

    // Затем вызываем оригинальную функцию для инициализации данных
    if (typeof originalShowCreateTaskModal === 'function') {
        try {
            // Временно отключаем console.log в оригинальной функции чтобы не засорять
            const originalLog = console.log;
            console.log = () => {};
            originalShowCreateTaskModal(employeeId, employeeName);
            console.log = originalLog;
        } catch (e) {
            console.error('Ошибка в оригинальной функции:', e);
        }
    }

    // Инициализируем Lucide иконки
    if (typeof lucide !== 'undefined') {
        setTimeout(() => lucide.createIcons(), 100);
    }

    // Инициализируем улучшенный dropdown для сотрудников
    if (typeof initEmployeeDropdown === 'function') {
        setTimeout(() => initEmployeeDropdown(), 150);
    }

    // Инициализируем фикс для всех select элементов
    if (typeof initModalSelects === 'function') {
        setTimeout(() => initModalSelects(), 200);
    }

    // Устанавливаем дату по умолчанию
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = document.getElementById('taskDeadline');
    if (dateInput && !dateInput.value) {
        dateInput.value = tomorrow.toISOString().split('T')[0];
    }

    console.log('✅ Модальное окно инициализировано');
};

// Функция закрытия модального окна
window.closeTaskModal = function() {
    console.log('🔒 Закрываем модальное окно');
    const modal = document.getElementById('taskModal');
    if (!modal) return;

    // Скрываем модальное окно
    modal.classList.remove('show');
    modal.style.setProperty('opacity', '0', 'important');
    modal.style.setProperty('visibility', 'hidden', 'important');
    modal.style.setProperty('pointer-events', 'none', 'important');

    // Через небольшую задержку полностью скрываем
    setTimeout(() => {
        modal.style.setProperty('display', 'none', 'important');
    }, 300);

    // Восстанавливаем скролл
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');

    // Сбрасываем форму
    const form = document.getElementById('taskForm');
    if (form) form.reset();
};

// Экстренная функция для тестирования
window.emergencyShowModal = function() {
    console.log('🚨 ЭКСТРЕННЫЙ ПОКАЗ МОДАЛЬНОГО ОКНА');

    // Создаем модальное окно заново если его нет
    let modal = document.getElementById('taskModal');
    if (!modal) {
        console.log('❌ Модальное окно отсутствует, пытаемся найти в DOM');
        // Ищем модальное окно по классу
        modal = document.querySelector('.modal-overlay');
        if (modal && !modal.id) {
            modal.id = 'taskModal';
            console.log('✅ Найдено модальное окно по классу и добавлен ID');
        }
    }

    if (modal) {
        forceShowModal();
    } else {
        alert('КРИТИЧЕСКАЯ ОШИБКА: Модальное окно не найдено в DOM!\\nПроверьте HTML структуру.');
    }
};

// Добавляем обработчик на клик по фону для закрытия
document.addEventListener('click', function(e) {
    const modal = document.getElementById('taskModal');
    if (e.target === modal) {
        closeTaskModal();
    }
});

// Добавляем глобальную команду для диагностики
window.modalDebug = function() {
    const modal = document.getElementById('taskModal');
    console.log('=== ДИАГНОСТИКА МОДАЛЬНОГО ОКНА ===');
    console.log('1. Элемент найден:', !!modal);
    if (modal) {
        console.log('2. ID:', modal.id);
        console.log('3. Классы:', modal.className);
        console.log('4. Inline стили:', modal.getAttribute('style'));
        const computed = window.getComputedStyle(modal);
        console.log('5. Computed стили:', {
            display: computed.display,
            opacity: computed.opacity,
            visibility: computed.visibility,
            zIndex: computed.zIndex,
            position: computed.position
        });
        console.log('6. Родительский элемент:', modal.parentElement);
        console.log('7. Размеры:', {
            offsetWidth: modal.offsetWidth,
            offsetHeight: modal.offsetHeight,
            clientWidth: modal.clientWidth,
            clientHeight: modal.clientHeight
        });
    }
    console.log('=== КОНЕЦ ДИАГНОСТИКИ ===');
};

console.log('✅ Критические исправления модального окна загружены');
console.log('📝 Доступные команды в консоли:');
console.log('  - showCreateTaskModal() - открыть модальное окно');
console.log('  - emergencyShowModal() - экстренное открытие');
console.log('  - modalDebug() - диагностика');
console.log('  - closeTaskModal() - закрыть модальное окно');