// Фикс для предотвращения двойного открытия dropdown меню

console.log('🔧 Загружен select-fix.js - исправление двойных dropdown');

// Функция для блокировки стандартного поведения select
function blockNativeSelect(select) {
    if (!select) return;

    // Блокируем все способы открытия нативного select
    select.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
    });

    select.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
    });

    select.addEventListener('focus', function(e) {
        e.preventDefault();
        this.blur();
    });

    // Добавляем стили для скрытия стрелки нативного select
    select.style.appearance = 'none';
    select.style.webkitAppearance = 'none';
    select.style.mozAppearance = 'none';

    console.log('✅ Заблокирован нативный select:', select.id || select.name);
}

// Функция для инициализации всех select в модальном окне
function initModalSelects() {
    console.log('🎯 Инициализация select элементов в модальном окне');

    // Ищем все select элементы в модальных окнах
    const modalSelects = document.querySelectorAll('#taskModal select, #editTaskModal select');

    modalSelects.forEach(select => {
        // Блокируем нативное поведение
        blockNativeSelect(select);

        // Если это не сотрудники (для которых уже есть кастомный dropdown)
        if (select.id !== 'taskEmployee' && select.id !== 'editTaskEmployee') {
            // Создаем простой кастомный dropdown для приоритета и других select
            createSimpleDropdown(select);
        }
    });
}

// Простой кастомный dropdown для приоритета и других полей
function createSimpleDropdown(select) {
    const wrapper = select.closest('.custom-select-wrapper');
    if (!wrapper) return;

    // Проверяем, не создан ли уже dropdown
    if (wrapper.querySelector('.simple-dropdown')) return;

    // Создаем dropdown контейнер
    const dropdown = document.createElement('div');
    dropdown.className = 'simple-dropdown employee-dropdown'; // Используем те же стили
    dropdown.style.display = 'none';

    // Создаем список опций
    const optionsList = document.createElement('div');
    optionsList.className = 'employee-list';

    // Добавляем опции
    Array.from(select.options).forEach((option, index) => {
        const item = document.createElement('div');
        item.className = 'employee-option';
        if (index === select.selectedIndex) {
            item.classList.add('selected');
        }

        // Для приоритета добавляем цветные индикаторы
        let content = option.text;
        if (select.name === 'priority') {
            item.innerHTML = `
                <div class="priority-option">
                    <span class="priority-text">${content}</span>
                </div>
            `;
        } else {
            item.innerHTML = `
                <div class="option-text">${content}</div>
            `;
        }

        item.dataset.value = option.value;
        item.dataset.index = index;

        // Обработчик клика
        item.addEventListener('click', function() {
            select.selectedIndex = index;

            // Обновляем выделение
            optionsList.querySelectorAll('.employee-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            item.classList.add('selected');

            // Обновляем текст в select (если есть кастомный display)
            const customDisplay = wrapper.querySelector('.select-display');
            if (customDisplay) {
                customDisplay.textContent = option.text;
            }

            // Закрываем dropdown
            dropdown.style.display = 'none';
            wrapper.classList.remove('open');

            // Запускаем событие change
            const event = new Event('change', { bubbles: true });
            select.dispatchEvent(event);
        });

        optionsList.appendChild(item);
    });

    dropdown.appendChild(optionsList);
    wrapper.appendChild(dropdown);

    // Обработчик открытия/закрытия
    const toggleDropdown = function(e) {
        e.preventDefault();
        e.stopPropagation();

        const isOpen = dropdown.style.display === 'flex';

        // Закрываем все другие dropdown
        document.querySelectorAll('.simple-dropdown').forEach(dd => {
            dd.style.display = 'none';
            dd.parentElement.classList.remove('open');
        });

        if (!isOpen) {
            dropdown.style.display = 'flex';
            dropdown.classList.add('show');
            wrapper.classList.add('open');

            // Позиционируем dropdown
            setTimeout(() => {
                dropdown.style.opacity = '1';
                dropdown.style.visibility = 'visible';
            }, 10);
        } else {
            dropdown.style.display = 'none';
            dropdown.classList.remove('show');
            wrapper.classList.remove('open');
        }
    };

    // Клик по wrapper для открытия
    wrapper.addEventListener('click', toggleDropdown);

    // Клик по select (на всякий случай)
    select.addEventListener('click', toggleDropdown);

    console.log('✅ Создан простой dropdown для:', select.name);
}

// Закрытие dropdown при клике вне
document.addEventListener('click', function(e) {
    if (!e.target.closest('.custom-select-wrapper')) {
        document.querySelectorAll('.simple-dropdown').forEach(dropdown => {
            dropdown.style.display = 'none';
            dropdown.classList.remove('show');
            if (dropdown.parentElement) {
                dropdown.parentElement.classList.remove('open');
            }
        });
    }
});

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initModalSelects, 500);
});

// Переинициализация при открытии модального окна
const originalShowModal = window.showCreateTaskModal;
if (originalShowModal) {
    window.showCreateTaskModal = function(...args) {
        const result = originalShowModal.apply(this, args);
        setTimeout(initModalSelects, 100);
        return result;
    };
}

// Экспорт функции для использования в других местах
window.initModalSelects = initModalSelects;

console.log('✅ Select-fix загружен и готов к работе');