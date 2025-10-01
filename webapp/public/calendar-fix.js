// ===== ИСПРАВЛЕНИЕ КАЛЕНДАРЯ =====

class FixedCalendar {
    constructor(element) {
        this.input = element;
        if (!this.input || this.input.type !== 'date') return;
        
        this.selectedDate = null;
        this.currentMonth = new Date();
        this.isOpen = false;
        this.animating = false; // Предотвращаем дерганье
        
        this.init();
    }
    
    init() {
        // Удаляем старые календари если есть
        const existingCalendar = this.input.parentElement?.querySelector('.fixed-calendar-wrapper');
        if (existingCalendar) {
            existingCalendar.remove();
        }
        
        // Скрываем оригинальный input
        this.input.style.display = 'none';
        
        // Создаем новый календарь
        this.createCalendar();
        
        // Устанавливаем начальные значения
        if (this.input.value) {
            this.selectedDate = new Date(this.input.value);
            this.currentMonth = new Date(this.selectedDate);
        } else {
            this.selectedDate = new Date();
            this.currentMonth = new Date();
        }
        
        this.updateDisplay();
        this.renderMonth();
    }
    
    createCalendar() {
        const wrapper = document.createElement('div');
        wrapper.className = 'fixed-calendar-wrapper';
        
        // Кнопка для открытия календаря
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'calendar-toggle-btn';
        button.innerHTML = `
            <i data-lucide="calendar"></i>
            <span class="selected-date">Выберите дату</span>
            <i data-lucide="chevron-down" class="chevron"></i>
        `;
        
        // Контейнер календаря
        const dropdown = document.createElement('div');
        dropdown.className = 'calendar-dropdown';
        dropdown.style.display = 'none';
        
        dropdown.innerHTML = `
            <div class="calendar-inner">
                <div class="calendar-header">
                    <button type="button" class="cal-nav-btn prev-month">
                        <i data-lucide="chevron-left"></i>
                    </button>
                    <div class="month-year-label">
                        <span class="month"></span>
                        <span class="year"></span>
                    </div>
                    <button type="button" class="cal-nav-btn next-month">
                        <i data-lucide="chevron-right"></i>
                    </button>
                </div>
                
                <div class="calendar-weekdays">
                    <div>ПН</div>
                    <div>ВТ</div>
                    <div>СР</div>
                    <div>ЧТ</div>
                    <div>ПТ</div>
                    <div class="weekend">СБ</div>
                    <div class="weekend">ВС</div>
                </div>
                
                <div class="calendar-days"></div>
                
                <div class="calendar-actions">
                    <button type="button" class="cal-action-btn today">
                        <i data-lucide="calendar-check"></i>
                        Сегодня
                    </button>
                </div>
            </div>
        `;
        
        wrapper.appendChild(button);
        wrapper.appendChild(dropdown);
        
        // Вставляем после оригинального input
        this.input.parentNode.insertBefore(wrapper, this.input.nextSibling);
        
        // Сохраняем ссылки
        this.wrapper = wrapper;
        this.button = button;
        this.dropdown = dropdown;
        this.dateDisplay = button.querySelector('.selected-date');
        this.monthLabel = dropdown.querySelector('.month');
        this.yearLabel = dropdown.querySelector('.year');
        this.daysContainer = dropdown.querySelector('.calendar-days');
        
        // Навешиваем события
        this.attachEvents();
        
        // Обновляем иконки
        if (window.lucide) {
            lucide.createIcons();
        }
    }
    
    attachEvents() {
        // Открытие/закрытие календаря
        this.button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        });
        
        // Навигация по месяцам
        this.dropdown.querySelector('.prev-month').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.navigateMonth(-1);
        });
        
        this.dropdown.querySelector('.next-month').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.navigateMonth(1);
        });
        
        // Кнопка "Сегодня"
        this.dropdown.querySelector('.today').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.selectToday();
        });
        
        // Закрытие при клике вне календаря
        document.addEventListener('click', (e) => {
            if (!this.wrapper.contains(e.target) && this.isOpen) {
                this.close();
            }
        });
        
        // Предотвращаем закрытие при клике на календарь
        this.dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    toggle() {
        if (this.animating) return;
        
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    open() {
        if (this.isOpen || this.animating) return;
        
        this.animating = true;
        this.isOpen = true;
        
        // Показываем календарь
        this.dropdown.style.display = 'block';
        this.dropdown.style.opacity = '0';
        this.dropdown.style.transform = 'translateY(-10px)';
        
        // Анимация появления
        requestAnimationFrame(() => {
            this.dropdown.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
            this.dropdown.style.opacity = '1';
            this.dropdown.style.transform = 'translateY(0)';
            
            setTimeout(() => {
                this.animating = false;
            }, 200);
        });
        
        // Меняем иконку
        const chevron = this.button.querySelector('.chevron');
        if (chevron) {
            chevron.setAttribute('data-lucide', 'chevron-up');
            if (window.lucide) lucide.createIcons();
        }
    }
    
    close() {
        if (!this.isOpen || this.animating) return;
        
        this.animating = true;
        
        // Анимация скрытия
        this.dropdown.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        this.dropdown.style.opacity = '0';
        this.dropdown.style.transform = 'translateY(-10px)';
        
        setTimeout(() => {
            this.dropdown.style.display = 'none';
            this.isOpen = false;
            this.animating = false;
        }, 200);
        
        // Меняем иконку
        const chevron = this.button.querySelector('.chevron');
        if (chevron) {
            chevron.setAttribute('data-lucide', 'chevron-down');
            if (window.lucide) lucide.createIcons();
        }
    }
    
    navigateMonth(direction) {
        if (this.animating) return;
        
        this.animating = true;
        
        // Плавная анимация смены месяца
        this.daysContainer.style.transition = 'opacity 0.15s ease';
        this.daysContainer.style.opacity = '0';
        
        setTimeout(() => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() + direction);
            this.renderMonth();
            
            this.daysContainer.style.opacity = '1';
            
            setTimeout(() => {
                this.animating = false;
            }, 150);
        }, 150);
    }
    
    renderMonth() {
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        
        // Обновляем заголовок
        const monthNames = [
            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
        ];
        this.monthLabel.textContent = monthNames[month];
        this.yearLabel.textContent = year;
        
        // Первый день месяца
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // Определяем день недели первого числа (понедельник = 0)
        let startDay = firstDay.getDay() - 1;
        if (startDay < 0) startDay = 6;
        
        // Очищаем контейнер
        this.daysContainer.innerHTML = '';
        
        // Добавляем пустые ячейки до первого дня
        for (let i = 0; i < startDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'calendar-day empty';
            this.daysContainer.appendChild(empty);
        }
        
        // Добавляем дни месяца
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dayElement = document.createElement('button');
            dayElement.type = 'button';
            dayElement.className = 'calendar-day';
            dayElement.textContent = day;
            
            const currentDate = new Date(year, month, day);
            currentDate.setHours(0, 0, 0, 0);
            
            // Выделяем сегодняшний день
            if (currentDate.getTime() === today.getTime()) {
                dayElement.classList.add('today');
            }
            
            // Выделяем выбранный день
            if (this.selectedDate) {
                const selected = new Date(this.selectedDate);
                selected.setHours(0, 0, 0, 0);
                if (currentDate.getTime() === selected.getTime()) {
                    dayElement.classList.add('selected');
                }
            }
            
            // Выделяем выходные
            const dayOfWeek = currentDate.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                dayElement.classList.add('weekend');
            }
            
            // Обработчик клика
            dayElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.selectDate(currentDate);
            });
            
            this.daysContainer.appendChild(dayElement);
        }
    }
    
    selectDate(date) {
        this.selectedDate = date;
        
        // Обновляем оригинальный input
        this.input.value = this.formatDateForInput(date);
        
        // Вызываем событие change
        const event = new Event('change', { bubbles: true });
        this.input.dispatchEvent(event);
        
        // Обновляем отображение
        this.updateDisplay();
        
        // Перерисовываем календарь
        this.renderMonth();
        
        // Закрываем через небольшую задержку
        setTimeout(() => {
            this.close();
        }, 150);
    }
    
    selectToday() {
        const today = new Date();
        this.currentMonth = new Date(today);
        this.selectDate(today);
    }
    
    updateDisplay() {
        if (!this.selectedDate) {
            this.dateDisplay.textContent = 'Выберите дату';
            return;
        }
        
        const options = { 
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        };
        
        this.dateDisplay.textContent = this.selectedDate.toLocaleDateString('ru-RU', options);
    }
    
    formatDateForInput(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}

// CSS стили для исправленного календаря
const calendarStyles = document.createElement('style');
calendarStyles.textContent = `
    .fixed-calendar-wrapper {
        position: relative;
        width: 100%;
    }
    
    .calendar-toggle-btn {
        width: 100%;
        padding: 14px 16px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        color: white;
        font-size: 15px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .calendar-toggle-btn:hover {
        background: rgba(255, 255, 255, 0.12);
        border-color: rgba(139, 92, 246, 0.5);
    }
    
    .calendar-toggle-btn .selected-date {
        flex: 1;
        text-align: left;
    }
    
    .calendar-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        z-index: 1000;
        background: rgba(30, 20, 50, 0.98);
        backdrop-filter: blur(20px) saturate(150%);
        border: 1px solid rgba(139, 92, 246, 0.3);
        border-radius: 16px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        overflow: hidden;
    }
    
    .calendar-inner {
        padding: 20px;
    }
    
    .calendar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
    }
    
    .cal-nav-btn {
        width: 32px;
        height: 32px;
        border: none;
        background: rgba(255, 255, 255, 0.1);
        color: white;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .cal-nav-btn:hover {
        background: rgba(139, 92, 246, 0.3);
        transform: scale(1.1);
    }
    
    .month-year-label {
        font-size: 16px;
        font-weight: 600;
        color: white;
        display: flex;
        gap: 8px;
    }
    
    .calendar-weekdays {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
        margin-bottom: 8px;
    }
    
    .calendar-weekdays div {
        text-align: center;
        font-size: 12px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.5);
        padding: 8px 0;
    }
    
    .calendar-weekdays .weekend {
        color: rgba(236, 72, 153, 0.7);
    }
    
    .calendar-days {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
    }
    
    .calendar-day {
        aspect-ratio: 1;
        border: none;
        background: rgba(255, 255, 255, 0.05);
        color: white;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .calendar-day:hover:not(.empty):not(.selected) {
        background: rgba(139, 92, 246, 0.2);
        transform: scale(1.05);
    }
    
    .calendar-day.empty {
        cursor: default;
        background: transparent;
    }
    
    .calendar-day.today {
        background: rgba(139, 92, 246, 0.2);
        border: 1px solid rgba(139, 92, 246, 0.5);
    }
    
    .calendar-day.selected {
        background: linear-gradient(135deg, #8b5cf6, #ec4899);
        font-weight: 600;
    }
    
    .calendar-day.weekend {
        color: rgba(236, 72, 153, 0.8);
    }
    
    .calendar-actions {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .cal-action-btn {
        width: 100%;
        padding: 10px;
        background: rgba(139, 92, 246, 0.2);
        border: 1px solid rgba(139, 92, 246, 0.3);
        color: white;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.2s ease;
    }
    
    .cal-action-btn:hover {
        background: rgba(139, 92, 246, 0.3);
        transform: scale(1.02);
    }
`;
document.head.appendChild(calendarStyles);

// Инициализация календарей
document.addEventListener('DOMContentLoaded', () => {
    // Заменяем все date input на наш календарь
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        new FixedCalendar(input);
    });
    
    console.log('✅ Calendar fix applied');
});

// Экспорт для использования в других модулях
window.FixedCalendar = FixedCalendar;