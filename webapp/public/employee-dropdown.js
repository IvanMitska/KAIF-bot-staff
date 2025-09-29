// Улучшенный dropdown для выбора сотрудников

class EmployeeDropdown {
    constructor(selectElement) {
        this.select = selectElement;
        this.wrapper = selectElement.closest('.custom-select-wrapper');
        this.options = Array.from(selectElement.options);
        this.selectedIndex = selectElement.selectedIndex;
        this.isOpen = false;

        this.init();
    }

    init() {
        // Создаем кастомный dropdown
        this.createDropdown();

        // Добавляем обработчики
        this.attachEventListeners();

        // Загружаем данные о сотрудниках
        this.loadEmployeeData();
    }

    createDropdown() {
        // Создаем контейнер для dropdown
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'employee-dropdown';

        // Добавляем поиск (опционально)
        if (this.options.length > 5) {
            const searchDiv = document.createElement('div');
            searchDiv.className = 'employee-search';
            searchDiv.innerHTML = `
                <input type="text" placeholder="Поиск сотрудника..." class="employee-search-input">
            `;
            this.dropdown.appendChild(searchDiv);
            this.searchInput = searchDiv.querySelector('input');
        }

        // Создаем список сотрудников
        this.listContainer = document.createElement('div');
        this.listContainer.className = 'employee-list';
        this.dropdown.appendChild(this.listContainer);

        // Добавляем dropdown в wrapper
        this.wrapper.appendChild(this.dropdown);

        // Рендерим список
        this.renderEmployeeList();
    }

    renderEmployeeList(searchTerm = '') {
        this.listContainer.innerHTML = '';

        // Фильтруем опции
        const filteredOptions = this.options.filter(option => {
            if (option.value === '') return true; // Всегда показываем placeholder
            return option.text.toLowerCase().includes(searchTerm.toLowerCase());
        });

        if (filteredOptions.length === 0) {
            this.listContainer.innerHTML = `
                <div class="employee-empty">
                    Сотрудник не найден
                </div>
            `;
            return;
        }

        // Создаем элементы списка
        filteredOptions.forEach((option, index) => {
            const actualIndex = this.options.indexOf(option);

            if (option.value === '') {
                // Placeholder
                const item = document.createElement('div');
                item.className = 'employee-option placeholder';
                item.innerHTML = `
                    <div class="employee-info">
                        <div class="employee-name" style="color: var(--text-muted);">${option.text}</div>
                    </div>
                `;
                item.dataset.value = option.value;
                item.dataset.index = actualIndex;
                this.listContainer.appendChild(item);
            } else {
                // Обычный сотрудник
                const item = document.createElement('div');
                item.className = 'employee-option';
                if (actualIndex === this.selectedIndex) {
                    item.classList.add('selected');
                }

                // Получаем инициалы
                const initials = this.getInitials(option.text);

                // Генерируем случайный статус для демо (в реальном приложении берем из данных)
                const isOnline = Math.random() > 0.3;

                // Получаем должность (можно хранить в data-атрибутах)
                const position = option.dataset?.position || 'Сотрудник';

                item.innerHTML = `
                    <div class="employee-avatar">
                        ${initials}
                    </div>
                    <div class="employee-info">
                        <div class="employee-name">${option.text}</div>
                        <div class="employee-position">${position}</div>
                    </div>
                    <div class="employee-status ${isOnline ? '' : 'offline'}"></div>
                `;

                item.dataset.value = option.value;
                item.dataset.index = actualIndex;

                this.listContainer.appendChild(item);
            }
        });
    }

    getInitials(name) {
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return parts[0][0] + parts[1][0];
        }
        return name.substring(0, 2).toUpperCase();
    }

    loadEmployeeData() {
        // Здесь можно загрузить дополнительные данные о сотрудниках
        // Например, должности, статусы и т.д.

        // Для демо добавим должности к существующим опциям
        const positions = [
            'Frontend Developer',
            'Backend Developer',
            'Designer',
            'Manager',
            'QA Engineer',
            'DevOps',
            'Product Manager',
            'Data Analyst',
            'Marketing',
            'HR Manager'
        ];

        this.options.forEach((option, index) => {
            if (option.value) {
                option.dataset.position = positions[index % positions.length];
            }
        });
    }

    attachEventListeners() {
        // ВАЖНО: Предотвращаем стандартное поведение select и открываем наш dropdown
        this.select.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        });

        // Также обрабатываем mousedown для полной блокировки нативного select
        this.select.addEventListener('mousedown', (e) => {
            // Блокируем нативный dropdown
            e.preventDefault();
        });

        // Предотвращаем открытие на focus (например при Tab)
        this.select.addEventListener('focus', (e) => {
            this.select.blur();
        });

        // Клик по стрелке
        const arrow = this.wrapper.querySelector('.select-arrow');
        if (arrow) {
            arrow.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggle();
            });
        }

        // Клик по элементу списка
        this.dropdown.addEventListener('click', (e) => {
            const item = e.target.closest('.employee-option');
            if (item && !item.classList.contains('placeholder')) {
                this.selectItem(item);
            }
        });

        // Поиск
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.renderEmployeeList(e.target.value);
            });

            // Предотвращаем закрытие при клике на поиск
            this.searchInput.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // Закрытие при клике вне
        document.addEventListener('click', (e) => {
            if (!this.wrapper.contains(e.target)) {
                this.close();
            }
        });

        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    selectItem(item) {
        const value = item.dataset.value;
        const index = parseInt(item.dataset.index);

        // Обновляем выбранный элемент
        this.select.selectedIndex = index;
        this.selectedIndex = index;

        // Обновляем визуальное состояние
        this.listContainer.querySelectorAll('.employee-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        item.classList.add('selected');

        // Запускаем событие change
        const event = new Event('change', { bubbles: true });
        this.select.dispatchEvent(event);

        // Закрываем dropdown
        this.close();
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.isOpen = true;
        this.wrapper.classList.add('open');
        this.dropdown.classList.add('show');

        // Фокус на поиск если есть
        if (this.searchInput) {
            setTimeout(() => this.searchInput.focus(), 100);
        }

        // Скроллим к выбранному элементу
        const selected = this.listContainer.querySelector('.selected');
        if (selected) {
            setTimeout(() => {
                selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }, 100);
        }
    }

    close() {
        this.isOpen = false;
        this.wrapper.classList.remove('open');
        this.dropdown.classList.remove('show');

        // Очищаем поиск
        if (this.searchInput) {
            this.searchInput.value = '';
            this.renderEmployeeList();
        }
    }
}

// Инициализация для всех селектов сотрудников
document.addEventListener('DOMContentLoaded', function() {
    // Откладываем инициализацию чтобы дать время загрузиться модальным окнам
    setTimeout(() => {
        console.log('🎨 Инициализация улучшенных dropdown для сотрудников');

        // Ищем селекты в модальных окнах
        const employeeSelects = [
            document.getElementById('taskEmployee'),
            document.getElementById('editTaskEmployee')
        ].filter(Boolean);

        employeeSelects.forEach(select => {
            if (select && !select.dataset.dropdownInitialized) {
                // Блокируем нативное поведение
                select.style.appearance = 'none';
                select.style.webkitAppearance = 'none';
                select.style.mozAppearance = 'none';

                new EmployeeDropdown(select);
                select.dataset.dropdownInitialized = 'true';
                console.log('✅ Dropdown инициализирован для:', select.id);
            }
        });
    }, 100);
});

// Также инициализируем при открытии модального окна
window.initEmployeeDropdown = function() {
    const selects = document.querySelectorAll('#taskEmployee, #editTaskEmployee');
    selects.forEach(select => {
        if (select && !select.dataset.dropdownInitialized) {
            new EmployeeDropdown(select);
            select.dataset.dropdownInitialized = 'true';
        }
    });
};