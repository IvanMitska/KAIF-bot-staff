// ===== КАСТОМНЫЕ КОМПОНЕНТЫ LIQUID GLASS =====

// Кастомный Dropdown
class CustomDropdown {
    constructor(element) {
        this.wrapper = element;
        this.select = element.querySelector('select');
        if (!this.select) return;
        
        this.init();
    }
    
    init() {
        // Скрываем оригинальный select
        this.select.style.display = 'none';
        
        // Создаем кастомный dropdown
        this.createDropdown();
        
        // Обработчики событий
        this.bindEvents();
    }
    
    createDropdown() {
        // Создаем контейнер
        const container = document.createElement('div');
        container.className = 'custom-dropdown';
        
        // Создаем триггер
        const trigger = document.createElement('div');
        trigger.className = 'custom-dropdown-trigger';
        trigger.innerHTML = `
            <span class="dropdown-value">${this.getSelectedText()}</span>
            <i data-lucide="chevron-down" class="custom-dropdown-icon"></i>
        `;
        
        // Создаем меню
        const menu = document.createElement('div');
        menu.className = 'custom-dropdown-menu';
        
        // Добавляем опции
        Array.from(this.select.options).forEach((option, index) => {
            const optionEl = document.createElement('div');
            optionEl.className = 'custom-dropdown-option';
            optionEl.dataset.value = option.value;
            optionEl.style.setProperty('--index', index);
            
            // Специальная обработка для приоритета
            if (this.select.name === 'priority') {
                const priorityClass = option.value === 'Высокий' ? 'high' : 
                                     option.value === 'Средний' ? 'medium' : 'low';
                optionEl.innerHTML = `
                    <span class="priority-indicator ${priorityClass}"></span>
                    <span>${option.text}</span>
                    <i data-lucide="check" class="check-icon"></i>
                `;
            } else {
                optionEl.innerHTML = `
                    <span>${option.text}</span>
                    <i data-lucide="check" class="check-icon"></i>
                `;
            }
            
            if (option.selected) {
                optionEl.classList.add('selected');
            }
            
            menu.appendChild(optionEl);
        });
        
        // Кнопка закрытия для мобильных
        const closeBtn = document.createElement('button');
        closeBtn.className = 'dropdown-mobile-close';
        closeBtn.textContent = 'Выбрать';
        menu.appendChild(closeBtn);
        
        container.appendChild(trigger);
        container.appendChild(menu);
        
        // Вставляем после оригинального select
        this.select.parentNode.insertBefore(container, this.select.nextSibling);
        
        this.container = container;
        this.trigger = trigger;
        this.menu = menu;
        this.closeBtn = closeBtn;
    }
    
    bindEvents() {
        // Открытие/закрытие dropdown
        this.trigger.addEventListener('click', () => this.toggle());
        
        // Выбор опции
        this.menu.querySelectorAll('.custom-dropdown-option').forEach(option => {
            option.addEventListener('click', (e) => {
                if (!e.target.classList.contains('dropdown-mobile-close')) {
                    this.selectOption(option);
                }
            });
        });
        
        // Закрытие на мобильных
        this.closeBtn.addEventListener('click', () => this.close());
        
        // Закрытие при клике вне
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.close();
            }
        });
        
        // Обновление иконок
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
    
    toggle() {
        const isOpen = this.menu.classList.contains('show');
        if (isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    open() {
        this.menu.classList.add('show');
        this.trigger.classList.add('active');
        this.container.classList.add('active');
    }
    
    close() {
        this.menu.classList.remove('show');
        this.trigger.classList.remove('active');
        this.container.classList.remove('active');
    }
    
    selectOption(optionEl) {
        // Убираем выделение с других опций
        this.menu.querySelectorAll('.custom-dropdown-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // Выделяем выбранную опцию
        optionEl.classList.add('selected');
        
        // Обновляем значение
        const value = optionEl.dataset.value;
        this.select.value = value;
        
        // Обновляем текст в триггере
        this.trigger.querySelector('.dropdown-value').textContent = optionEl.querySelector('span:not(.priority-indicator)').textContent;
        
        // Закрываем dropdown
        if (!window.matchMedia('(max-width: 480px)').matches) {
            this.close();
        }
        
        // Триггерим change событие
        this.select.dispatchEvent(new Event('change'));
    }
    
    getSelectedText() {
        const selected = this.select.options[this.select.selectedIndex];
        return selected ? selected.text : 'Выберите...';
    }
}

// Кастомный Date Picker
class CustomDatePicker {
    constructor(element) {
        this.input = element;
        if (!this.input || this.input.type !== 'date') return;
        
        this.init();
    }
    
    init() {
        // Скрываем оригинальный input
        this.input.style.display = 'none';
        
        // Создаем кастомный date picker
        this.createDatePicker();
        
        // Обработчики событий
        this.bindEvents();
        
        // Устанавливаем начальное значение
        if (this.input.value) {
            this.selectedDate = new Date(this.input.value);
        } else {
            this.selectedDate = new Date();
        }
        
        this.currentMonth = new Date(this.selectedDate);
        this.updateCalendar();
    }
    
    createDatePicker() {
        // Создаем контейнер
        const container = document.createElement('div');
        container.className = 'custom-datepicker';
        
        // Создаем триггер
        const trigger = document.createElement('div');
        trigger.className = 'custom-datepicker-trigger';
        trigger.innerHTML = `
            <span class="datepicker-value">${this.formatDate(new Date())}</span>
            <i data-lucide="calendar" class="calendar-icon"></i>
        `;
        
        // Создаем календарь
        const calendar = document.createElement('div');
        calendar.className = 'custom-calendar';
        calendar.innerHTML = `
            <div class="calendar-header">
                <span class="calendar-month-year"></span>
                <div class="calendar-nav">
                    <button class="calendar-nav-btn prev">
                        <i data-lucide="chevron-left"></i>
                    </button>
                    <button class="calendar-nav-btn next">
                        <i data-lucide="chevron-right"></i>
                    </button>
                </div>
            </div>
            <div class="calendar-weekdays">
                <div class="calendar-weekday">Пн</div>
                <div class="calendar-weekday">Вт</div>
                <div class="calendar-weekday">Ср</div>
                <div class="calendar-weekday">Чт</div>
                <div class="calendar-weekday">Пт</div>
                <div class="calendar-weekday">Сб</div>
                <div class="calendar-weekday">Вс</div>
            </div>
            <div class="calendar-days"></div>
            <button class="dropdown-mobile-close">Выбрать</button>
        `;
        
        container.appendChild(trigger);
        container.appendChild(calendar);
        
        // Вставляем после оригинального input
        this.input.parentNode.insertBefore(container, this.input.nextSibling);
        
        this.container = container;
        this.trigger = trigger;
        this.calendar = calendar;
        this.monthYearEl = calendar.querySelector('.calendar-month-year');
        this.daysEl = calendar.querySelector('.calendar-days');
    }
    
    bindEvents() {
        // Открытие/закрытие календаря
        this.trigger.addEventListener('click', () => this.toggle());
        
        // Навигация по месяцам
        this.calendar.querySelector('.prev').addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
            this.updateCalendar();
        });
        
        this.calendar.querySelector('.next').addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
            this.updateCalendar();
        });
        
        // Закрытие на мобильных
        this.calendar.querySelector('.dropdown-mobile-close').addEventListener('click', () => this.close());
        
        // Закрытие при клике вне
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.close();
            }
        });
        
        // Обновление иконок
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
    
    toggle() {
        const isOpen = this.calendar.classList.contains('show');
        if (isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    open() {
        this.calendar.classList.add('show');
        this.trigger.classList.add('active');
        this.container.classList.add('active');
    }
    
    close() {
        this.calendar.classList.remove('show');
        this.trigger.classList.remove('active');
        this.container.classList.remove('active');
    }
    
    updateCalendar() {
        // Обновляем заголовок
        const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                          'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        this.monthYearEl.textContent = `${monthNames[this.currentMonth.getMonth()]} ${this.currentMonth.getFullYear()}`;
        
        // Очищаем дни
        this.daysEl.innerHTML = '';
        
        // Получаем первый день месяца
        const firstDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
        const lastDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);
        
        // Добавляем пустые ячейки для выравнивания
        let startDay = firstDay.getDay() - 1; // Понедельник = 0
        if (startDay < 0) startDay = 6;
        
        for (let i = 0; i < startDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day other-month';
            this.daysEl.appendChild(emptyDay);
        }
        
        // Добавляем дни месяца
        const today = new Date();
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dayEl = document.createElement('button');
            dayEl.className = 'calendar-day';
            dayEl.textContent = day;
            
            const currentDate = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), day);
            
            // Подсветка сегодня
            if (currentDate.toDateString() === today.toDateString()) {
                dayEl.classList.add('today');
            }
            
            // Подсветка выбранной даты
            if (this.selectedDate && currentDate.toDateString() === this.selectedDate.toDateString()) {
                dayEl.classList.add('selected');
            }
            
            // Обработчик выбора даты
            dayEl.addEventListener('click', () => this.selectDate(currentDate));
            
            this.daysEl.appendChild(dayEl);
        }
    }
    
    selectDate(date) {
        this.selectedDate = date;
        this.input.value = this.formatDateForInput(date);
        this.trigger.querySelector('.datepicker-value').textContent = this.formatDate(date);
        
        // Обновляем календарь
        this.updateCalendar();
        
        // Закрываем на десктопе
        if (!window.matchMedia('(max-width: 480px)').matches) {
            this.close();
        }
        
        // Триггерим change событие
        this.input.dispatchEvent(new Event('change'));
    }
    
    formatDate(date) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }
    
    formatDateForInput(date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}

// Инициализация компонентов
document.addEventListener('DOMContentLoaded', function() {
    // Инициализируем все кастомные селекты
    document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
        new CustomDropdown(wrapper);
    });
    
    // Инициализируем все date pickers
    document.querySelectorAll('input[type="date"]').forEach(input => {
        new CustomDatePicker(input);
    });
    
    // Обновляем иконки Lucide
    if (window.lucide) {
        window.lucide.createIcons();
    }
});

// Экспортируем для использования в других скриптах
window.CustomDropdown = CustomDropdown;
window.CustomDatePicker = CustomDatePicker;