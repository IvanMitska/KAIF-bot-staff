// Модуль учета рабочего времени
import { Config } from './config.js';
import { UI } from './ui.js';

export const Attendance = {
    // Текущее состояние
    isCheckedIn: false,
    lastLocation: null,

    // Обновление статуса
    async updateStatus() {
        const tg = window.Telegram.WebApp;

        try {
            const response = await fetch(Config.getApiUrl('/api/attendance/status'), {
                headers: {
                    'X-Telegram-Init-Data': tg.initData || ''
                }
            });

            if (response.ok) {
                const status = await response.json();
                this.isCheckedIn = status.isCheckedIn;
                this.updateUI(status);
            }
        } catch (error) {
            console.error('Ошибка получения статуса посещаемости:', error);
        }
    },

    // Обновление UI
    updateUI(status) {
        const checkInBtn = document.getElementById('checkInBtn');
        const checkOutBtn = document.getElementById('checkOutBtn');
        const attendanceStatus = document.getElementById('attendanceStatus');

        if (!checkInBtn || !checkOutBtn) return;

        if (status.isCheckedIn) {
            checkInBtn.style.display = 'none';
            checkOutBtn.style.display = 'block';

            if (attendanceStatus) {
                attendanceStatus.innerHTML = `
                    <div class="status-card checked-in">
                        <i data-lucide="check-circle"></i>
                        <p>Вы на работе</p>
                        <small>с ${UI.formatDate(status.checkInTime, 'time')}</small>
                    </div>
                `;
            }
        } else {
            checkInBtn.style.display = 'block';
            checkOutBtn.style.display = 'none';

            if (attendanceStatus) {
                attendanceStatus.innerHTML = `
                    <div class="status-card checked-out">
                        <i data-lucide="clock"></i>
                        <p>Вы не на работе</p>
                    </div>
                `;
            }
        }

        // Переинициализировать иконки
        if (window.lucide) {
            window.lucide.createIcons();
        }
    },

    // Отметка прихода
    async checkIn() {
        const tg = window.Telegram.WebApp;

        // Получение геолокации
        const location = await this.getLocation();

        const checkInBtn = document.getElementById('checkInBtn');
        if (checkInBtn) {
            checkInBtn.disabled = true;
            checkInBtn.innerHTML = '<div class="spinner"></div> Отмечаем...';
        }

        try {
            const response = await fetch(Config.getApiUrl('/api/attendance/checkin'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Init-Data': tg.initData || ''
                },
                body: JSON.stringify({
                    location: location,
                    timestamp: new Date().toISOString()
                })
            });

            if (response.ok) {
                const result = await response.json();
                this.isCheckedIn = true;
                this.updateUI({ isCheckedIn: true, checkInTime: result.checkInTime });

                UI.showNotification('Вы отметились на работе', 'success');

                if (tg.HapticFeedback) {
                    tg.HapticFeedback.notificationOccurred('success');
                }
            } else {
                throw new Error('Ошибка отметки прихода');
            }
        } catch (error) {
            console.error('Ошибка отметки прихода:', error);
            UI.showNotification('Ошибка отметки прихода', 'error');

            if (checkInBtn) {
                checkInBtn.disabled = false;
                checkInBtn.innerHTML = '<i data-lucide="log-in"></i> Отметить приход';
            }
        }
    },

    // Отметка ухода
    async checkOut() {
        const tg = window.Telegram.WebApp;

        const checkOutBtn = document.getElementById('checkOutBtn');
        if (checkOutBtn) {
            checkOutBtn.disabled = true;
            checkOutBtn.innerHTML = '<div class="spinner"></div> Отмечаем...';
        }

        try {
            const response = await fetch(Config.getApiUrl('/api/attendance/checkout'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Init-Data': tg.initData || ''
                },
                body: JSON.stringify({
                    timestamp: new Date().toISOString()
                })
            });

            if (response.ok) {
                const result = await response.json();
                this.isCheckedIn = false;
                this.updateUI({ isCheckedIn: false });

                // Показать время работы
                if (result.workDuration) {
                    const hours = Math.floor(result.workDuration / 60);
                    const minutes = result.workDuration % 60;
                    UI.showNotification(`Вы отработали: ${hours}ч ${minutes}мин`, 'success');
                } else {
                    UI.showNotification('Вы отметили уход', 'success');
                }

                if (tg.HapticFeedback) {
                    tg.HapticFeedback.notificationOccurred('success');
                }
            } else {
                throw new Error('Ошибка отметки ухода');
            }
        } catch (error) {
            console.error('Ошибка отметки ухода:', error);
            UI.showNotification('Ошибка отметки ухода', 'error');

            if (checkOutBtn) {
                checkOutBtn.disabled = false;
                checkOutBtn.innerHTML = '<i data-lucide="log-out"></i> Отметить уход';
            }
        }
    },

    // Получение геолокации
    async getLocation() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lon: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };
                    this.lastLocation = location;
                    resolve(location);
                },
                (error) => {
                    console.error('Ошибка получения геолокации:', error);
                    resolve(null);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    },

    // Загрузка истории посещаемости
    async loadHistory() {
        const tg = window.Telegram.WebApp;

        try {
            const response = await fetch(Config.getApiUrl('/api/attendance/history'), {
                headers: {
                    'X-Telegram-Init-Data': tg.initData || ''
                }
            });

            if (response.ok) {
                const history = await response.json();
                this.displayHistory(history);
            }
        } catch (error) {
            console.error('Ошибка загрузки истории посещаемости:', error);
        }
    },

    // Отображение истории
    displayHistory(history) {
        const container = document.getElementById('attendanceHistory');
        if (!container) return;

        if (!history || history.length === 0) {
            UI.showEmpty(container, 'История посещаемости пуста');
            return;
        }

        let html = '<div class="attendance-history">';

        history.forEach(record => {
            const duration = record.checkOutTime ?
                this.calculateDuration(record.checkInTime, record.checkOutTime) :
                'В процессе';

            html += `
                <div class="attendance-record">
                    <div class="record-date">
                        ${UI.formatDate(record.checkInTime, 'long')}
                    </div>
                    <div class="record-times">
                        <span class="check-in">
                            <i data-lucide="log-in"></i>
                            ${UI.formatDate(record.checkInTime, 'time')}
                        </span>
                        ${record.checkOutTime ? `
                            <span class="check-out">
                                <i data-lucide="log-out"></i>
                                ${UI.formatDate(record.checkOutTime, 'time')}
                            </span>
                        ` : ''}
                        <span class="duration">${duration}</span>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

        // Переинициализировать иконки
        if (window.lucide) {
            window.lucide.createIcons();
        }
    },

    // Расчет продолжительности
    calculateDuration(startTime, endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        const diff = Math.floor((end - start) / 1000 / 60); // в минутах

        const hours = Math.floor(diff / 60);
        const minutes = diff % 60;

        return `${hours}ч ${minutes}мин`;
    }
};

// Глобальные функции для обратной совместимости
window.checkIn = () => Attendance.checkIn();
window.checkOut = () => Attendance.checkOut();