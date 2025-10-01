// Отладочный скрипт для проверки работы dropdown

console.log('🔍 Загружен dropdown-debug.js');

// Функция для тестирования dropdown
window.testDropdowns = function() {
    console.log('=== ТЕСТ DROPDOWN ===');

    // Проверяем наличие select элементов
    const selects = document.querySelectorAll('select.custom-select');
    console.log(`Найдено select элементов: ${selects.length}`);

    selects.forEach((select, index) => {
        console.log(`${index + 1}. ${select.id || select.name}:`, {
            initialized: select.dataset.dropdownInitialized === 'true',
            appearance: select.style.appearance,
            listeners: select.onclick ? 'есть onclick' : 'нет onclick',
            wrapper: select.closest('.custom-select-wrapper') ? 'есть wrapper' : 'нет wrapper'
        });
    });

    // Проверяем наличие dropdown элементов
    const dropdowns = document.querySelectorAll('.employee-dropdown, .simple-dropdown');
    console.log(`\nНайдено dropdown элементов: ${dropdowns.length}`);

    dropdowns.forEach((dd, index) => {
        console.log(`Dropdown ${index + 1}:`, {
            display: dd.style.display,
            visibility: dd.style.visibility,
            classes: dd.className
        });
    });

    console.log('=== КОНЕЦ ТЕСТА ===');
};

// Функция для принудительного открытия dropdown
window.forceOpenDropdown = function(selectId) {
    const select = document.getElementById(selectId);
    if (!select) {
        console.error(`Select с id="${selectId}" не найден`);
        return;
    }

    const wrapper = select.closest('.custom-select-wrapper');
    if (!wrapper) {
        console.error('Wrapper не найден');
        return;
    }

    // Ищем dropdown
    const dropdown = wrapper.querySelector('.employee-dropdown, .simple-dropdown');
    if (!dropdown) {
        console.error('Dropdown не найден');
        return;
    }

    // Принудительно открываем
    dropdown.style.display = 'flex';
    dropdown.style.opacity = '1';
    dropdown.style.visibility = 'visible';
    dropdown.classList.add('show');
    wrapper.classList.add('open');

    console.log('✅ Dropdown принудительно открыт');
};

// Автоматически проверяем при загрузке
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        console.log('🔍 Автоматическая проверка dropdown через 2 секунды...');
        window.testDropdowns();
    }, 2000);
});