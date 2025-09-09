// ===== CUSTOM SELECT DROPDOWN =====
// Кастомный выпадающий список в стиле liquid glass

class CustomSelect {
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
        
        // Добавляем обработчики событий
        this.addEventListeners();
        
        // Обновляем при изменении оригинального select
        this.select.addEventListener('change', () => {
            this.updateDropdown();
        });
    }
    
    createDropdown() {
        // Создаем контейнер для dropdown
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'custom-dropdown';
        
        // Добавляем поиск если опций больше 5
        if (this.options.length > 5) {
            const searchContainer = document.createElement('div');
            searchContainer.className = 'custom-dropdown-search';
            
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.placeholder = 'Поиск...';
            searchInput.className = 'custom-dropdown-search-input';
            
            searchContainer.appendChild(searchInput);
            this.dropdown.appendChild(searchContainer);
            
            this.searchInput = searchInput;
        }
        
        // Создаем контейнер для опций
        this.optionsContainer = document.createElement('div');
        this.optionsContainer.className = 'custom-dropdown-options';
        
        // Добавляем опции
        this.renderOptions();
        
        this.dropdown.appendChild(this.optionsContainer);
        this.wrapper.appendChild(this.dropdown);
    }
    
    renderOptions(filter = '') {
        this.optionsContainer.innerHTML = '';
        
        const filteredOptions = filter 
            ? this.options.filter(opt => 
                opt.text.toLowerCase().includes(filter.toLowerCase()))
            : this.options;
        
        if (filteredOptions.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'custom-dropdown-item';
            noResults.textContent = 'Ничего не найдено';
            noResults.style.color = 'var(--text-muted)';
            noResults.style.pointerEvents = 'none';
            this.optionsContainer.appendChild(noResults);
            return;
        }
        
        filteredOptions.forEach((option, index) => {
            const item = document.createElement('div');
            item.className = 'custom-dropdown-item';
            
            if (option.value === this.select.value) {
                item.classList.add('selected');
            }
            
            item.textContent = option.text;
            item.dataset.value = option.value;
            item.dataset.index = this.options.indexOf(option);
            
            item.addEventListener('click', () => {
                this.selectOption(item.dataset.index);
            });
            
            this.optionsContainer.appendChild(item);
        });
    }
    
    selectOption(index) {
        // Обновляем оригинальный select
        this.select.selectedIndex = index;
        this.selectedIndex = index;
        
        // Триггерим событие change
        const event = new Event('change', { bubbles: true });
        this.select.dispatchEvent(event);
        
        // Обновляем визуальное состояние
        this.updateDropdown();
        
        // Закрываем dropdown
        this.close();
    }
    
    updateDropdown() {
        // Обновляем выделение в dropdown
        const items = this.optionsContainer.querySelectorAll('.custom-dropdown-item');
        items.forEach(item => {
            if (item.dataset.value === this.select.value) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }
    
    addEventListeners() {
        // Клик по select для открытия/закрытия
        this.select.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        });
        
        // Поиск
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.renderOptions(e.target.value);
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
        
        // Навигация с клавиатуры
        this.select.addEventListener('keydown', (e) => {
            if (!this.isOpen && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                this.open();
            }
        });
    }
    
    open() {
        if (this.isOpen) return;
        
        this.dropdown.classList.add('active');
        this.isOpen = true;
        
        // Фокус на поиск если есть
        if (this.searchInput) {
            setTimeout(() => this.searchInput.focus(), 100);
        }
        
        // Скроллим к выбранному элементу
        const selected = this.dropdown.querySelector('.selected');
        if (selected) {
            selected.scrollIntoView({ block: 'center' });
        }
    }
    
    close() {
        if (!this.isOpen) return;
        
        this.dropdown.classList.remove('active');
        this.isOpen = false;
        
        // Очищаем поиск
        if (this.searchInput) {
            this.searchInput.value = '';
            this.renderOptions();
        }
    }
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
}

// Инициализация для всех select на странице
document.addEventListener('DOMContentLoaded', () => {
    // Инициализируем все custom-select
    const selects = document.querySelectorAll('.custom-select');
    selects.forEach(select => {
        // Проверяем, не инициализирован ли уже
        if (!select.dataset.customSelectInit) {
            new CustomSelect(select);
            select.dataset.customSelectInit = 'true';
        }
    });
});

// Функция для динамической инициализации
window.initCustomSelect = function(selectElement) {
    if (!selectElement.dataset.customSelectInit) {
        new CustomSelect(selectElement);
        selectElement.dataset.customSelectInit = 'true';
    }
};

// Обновление при динамическом добавлении опций
window.updateCustomSelect = function(selectElement) {
    // Переинициализируем если нужно
    const wrapper = selectElement.closest('.custom-select-wrapper');
    const dropdown = wrapper.querySelector('.custom-dropdown');
    
    if (dropdown) {
        // Обновляем существующий dropdown
        const customSelect = new CustomSelect(selectElement);
        customSelect.renderOptions();
    }
};