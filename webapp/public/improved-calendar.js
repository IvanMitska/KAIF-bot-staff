// ===== УЛУЧШЕННЫЙ КАЛЕНДАРЬ =====

class ImprovedDatePicker {
    constructor(element) {
        this.input = element;
        if (!this.input || this.input.type !== 'date') return;
        
        this.selectedDate = null;
        this.currentMonth = new Date();
        this.isOpen = false;
        
        this.init();
    }
    
    init() {
        // Скрываем оригинальный input
        this.input.style.display = 'none';
        
        // Создаем UI
        this.createDatePicker();
        
        // Инициализация событий
        this.bindEvents();
        
        // Устанавливаем начальную дату
        if (this.input.value) {
            this.selectedDate = new Date(this.input.value);
            this.currentMonth = new Date(this.selectedDate);
        } else {
            const today = new Date();
            this.selectedDate = today;
            this.currentMonth = new Date(today);
            this.input.value = this.formatDateForInput(today);
        }
        
        this.updateDisplay();
        this.renderCalendar();
    }
    
    createDatePicker() {
        // Контейнер
        const container = document.createElement('div');
        container.className = 'improved-datepicker';
        
        // Поле отображения даты
        const display = document.createElement('button');
        display.className = 'datepicker-display';
        display.type = 'button';
        display.innerHTML = `
            <i data-lucide="calendar" class="icon-left"></i>
            <span class="date-text">Выберите дату</span>
            <i data-lucide="chevron-down" class="icon-right"></i>
        `;
        
        // Календарь
        const calendar = document.createElement('div');
        calendar.className = 'datepicker-calendar';
        calendar.innerHTML = `
            <div class="calendar-container">
                <div class="calendar-header">
                    <button type="button" class="nav-btn prev-year" title="Предыдущий год">
                        <i data-lucide="chevrons-left"></i>
                    </button>
                    <button type="button" class="nav-btn prev-month" title="Предыдущий месяц">
                        <i data-lucide="chevron-left"></i>
                    </button>
                    <div class="month-year-display">
                        <span class="month-name"></span>
                        <span class="year"></span>
                    </div>
                    <button type="button" class="nav-btn next-month" title="Следующий месяц">
                        <i data-lucide="chevron-right"></i>
                    </button>
                    <button type="button" class="nav-btn next-year" title="Следующий год">
                        <i data-lucide="chevrons-right"></i>
                    </button>
                </div>
                
                <div class="calendar-grid">
                    <div class="weekdays">
                        <div class="weekday">Пн</div>
                        <div class="weekday">Вт</div>
                        <div class="weekday">Ср</div>
                        <div class="weekday">Чт</div>
                        <div class="weekday">Пт</div>
                        <div class="weekday weekend">Сб</div>
                        <div class="weekday weekend">Вс</div>
                    </div>
                    <div class="days-grid"></div>
                </div>
                
                <div class="calendar-footer">
                    <div class="quick-actions">
                        <button type="button" class="quick-btn today-btn">
                            <i data-lucide="calendar-check"></i>
                            Сегодня
                        </button>
                        <button type="button" class="quick-btn tomorrow-btn">
                            Завтра
                        </button>
                        <button type="button" class="quick-btn week-btn">
                            Через неделю
                        </button>
                    </div>
                    <div class="action-buttons">
                        <button type="button" class="btn-clear">Очистить</button>
                        <button type="button" class="btn-apply">Применить</button>
                    </div>
                </div>
            </div>
        `;
        
        container.appendChild(display);
        container.appendChild(calendar);
        
        // Вставляем после оригинального input
        this.input.parentNode.insertBefore(container, this.input.nextSibling);
        
        // Сохраняем ссылки
        this.container = container;
        this.display = display;
        this.calendar = calendar;
        this.dateText = display.querySelector('.date-text');
        this.monthName = calendar.querySelector('.month-name');
        this.year = calendar.querySelector('.year');
        this.daysGrid = calendar.querySelector('.days-grid');
    }
    
    bindEvents() {
        // Открытие/закрытие
        this.display.addEventListener('click', () => this.toggle());
        
        // Навигация
        this.calendar.querySelector('.prev-year').addEventListener('click', () => {
            this.currentMonth.setFullYear(this.currentMonth.getFullYear() - 1);
            this.renderCalendar();
        });
        
        this.calendar.querySelector('.prev-month').addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
            this.renderCalendar();
        });
        
        this.calendar.querySelector('.next-month').addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
            this.renderCalendar();
        });
        
        this.calendar.querySelector('.next-year').addEventListener('click', () => {
            this.currentMonth.setFullYear(this.currentMonth.getFullYear() + 1);
            this.renderCalendar();
        });
        
        // Быстрые действия
        this.calendar.querySelector('.today-btn').addEventListener('click', () => {
            const today = new Date();
            this.selectDate(today);
        });
        
        this.calendar.querySelector('.tomorrow-btn').addEventListener('click', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            this.selectDate(tomorrow);
        });
        
        this.calendar.querySelector('.week-btn').addEventListener('click', () => {
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            this.selectDate(nextWeek);
        });
        
        // Кнопки действий
        this.calendar.querySelector('.btn-clear').addEventListener('click', () => {
            this.selectedDate = null;
            this.input.value = '';
            this.updateDisplay();
            this.renderCalendar();
        });
        
        this.calendar.querySelector('.btn-apply').addEventListener('click', () => {
            this.close();
        });
        
        // Закрытие при клике вне
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.close();
            }
        });
        
        // ESC для закрытия
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
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
        this.calendar.classList.add('show');
        this.display.classList.add('active');
        
        // Обновляем иконку
        const chevron = this.display.querySelector('.icon-right');
        if (chevron) {
            chevron.setAttribute('data-lucide', 'chevron-up');
            if (window.lucide) lucide.createIcons();
        }
        
        // Позиционирование для мобильных
        if (window.innerWidth <= 480) {
            document.body.style.overflow = 'hidden';
        }
    }
    
    close() {
        this.isOpen = false;
        this.calendar.classList.remove('show');
        this.display.classList.remove('active');
        
        // Обновляем иконку
        const chevron = this.display.querySelector('.icon-right');
        if (chevron) {
            chevron.setAttribute('data-lucide', 'chevron-down');
            if (window.lucide) lucide.createIcons();
        }
        
        // Восстанавливаем скролл
        if (window.innerWidth <= 480) {
            document.body.style.overflow = '';
        }
    }
    
    renderCalendar() {
        // Обновляем заголовок
        const months = [
            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
        ];
        
        this.monthName.textContent = months[this.currentMonth.getMonth()];
        this.year.textContent = this.currentMonth.getFullYear();
        
        // Очищаем сетку
        this.daysGrid.innerHTML = '';
        
        // Первый и последний день месяца
        const firstDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
        const lastDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);
        
        // Первый день недели (понедельник = 0)
        let startDay = firstDay.getDay() - 1;
        if (startDay < 0) startDay = 6;
        
        // Дни предыдущего месяца
        const prevMonth = new Date(firstDay);
        prevMonth.setDate(0);
        const prevMonthDays = prevMonth.getDate();
        
        for (let i = startDay - 1; i >= 0; i--) {
            const dayBtn = this.createDayButton(prevMonthDays - i, true, false);
            this.daysGrid.appendChild(dayBtn);
        }
        
        // Дни текущего месяца
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), day);
            const isToday = date.getTime() === today.getTime();
            const isSelected = this.selectedDate && 
                               date.getTime() === new Date(this.selectedDate.getFullYear(), 
                                                          this.selectedDate.getMonth(), 
                                                          this.selectedDate.getDate()).getTime();
            
            const dayBtn = this.createDayButton(day, false, false, isToday, isSelected, date);
            this.daysGrid.appendChild(dayBtn);
        }
        
        // Дни следующего месяца
        const remainingDays = 42 - this.daysGrid.children.length;
        for (let day = 1; day <= remainingDays; day++) {
            const dayBtn = this.createDayButton(day, true, true);
            this.daysGrid.appendChild(dayBtn);
        }
        
        // Обновляем иконки
        if (window.lucide) lucide.createIcons();
    }
    
    createDayButton(day, isOtherMonth, isNextMonth, isToday, isSelected, date) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'day-btn';
        btn.textContent = day;
        
        if (isOtherMonth) {
            btn.classList.add('other-month');
        }
        
        if (isToday) {
            btn.classList.add('today');
        }
        
        if (isSelected) {
            btn.classList.add('selected');
        }
        
        // Выходные
        if (date) {
            const dayOfWeek = date.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                btn.classList.add('weekend');
            }
        }
        
        if (!isOtherMonth && date) {
            btn.addEventListener('click', () => this.selectDate(date));
        }
        
        return btn;
    }
    
    selectDate(date) {
        this.selectedDate = date;
        this.currentMonth = new Date(date);
        this.input.value = this.formatDateForInput(date);
        
        // Триггерим change событие
        this.input.dispatchEvent(new Event('change', { bubbles: true }));
        
        this.updateDisplay();
        this.renderCalendar();
    }
    
    updateDisplay() {
        if (this.selectedDate) {
            this.dateText.textContent = this.formatDateDisplay(this.selectedDate);
            this.dateText.classList.add('has-value');
        } else {
            this.dateText.textContent = 'Выберите дату';
            this.dateText.classList.remove('has-value');
        }
    }
    
    formatDateDisplay(date) {
        const months = [
            'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
        ];
        
        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        
        // Добавляем день недели
        const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        const weekday = weekdays[date.getDay()];
        
        return `${weekday}, ${day} ${month} ${year}`;
    }
    
    formatDateForInput(date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}

// Замена старого календаря
document.addEventListener('DOMContentLoaded', function() {
    // Удаляем старые обработчики
    const oldDatePickers = document.querySelectorAll('.custom-datepicker');
    oldDatePickers.forEach(picker => picker.remove());
    
    // Инициализируем новый календарь
    document.querySelectorAll('input[type="date"]').forEach(input => {
        // Показываем скрытые инпуты
        input.style.display = '';
        new ImprovedDatePicker(input);
    });
    
    // Обновляем иконки
    if (window.lucide) lucide.createIcons();
});

// Экспорт
window.ImprovedDatePicker = ImprovedDatePicker;