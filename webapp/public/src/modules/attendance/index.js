// Модуль учета рабочего времени
export class AttendanceModule {
    constructor(api, eventBus, ui) {
        this.api = api;
        this.eventBus = eventBus;
        this.ui = ui;
        this.currentSession = null;
        this.setupEventListeners();
    }

    initialize(currentUser) {
        this.currentUser = currentUser;
        this.checkCurrentSession();
        this.setupAttendanceButtons();
    }

    setupEventListeners() {
        this.eventBus.on('page:attendance', () => {
            this.loadAttendanceHistory();
        });

        this.eventBus.on('attendance:updated', () => {
            this.refresh();
        });
    }

    setupAttendanceButtons() {
        const startBtn = document.getElementById('startWork');
        const endBtn = document.getElementById('endWork');

        if (startBtn) {
            startBtn.addEventListener('click', () => this.startWork());
        }

        if (endBtn) {
            endBtn.addEventListener('click', () => this.endWork());
        }
    }

    async checkCurrentSession() {
        try {
            const response = await this.api.get('/attendance/current');
            this.currentSession = response.session;
            this.updateUI();
        } catch (error) {
            console.error('Ошибка проверки текущей сессии:', error);
        }
    }

    async startWork() {
        try {
            const response = await this.api.post('/attendance/start', {
                employeeId: this.currentUser?.id,
                startTime: new Date().toISOString()
            });

            this.currentSession = response.session;
            this.updateUI();

            this.eventBus.emit('notification', 'Рабочий день начат', 'success');
            this.eventBus.emit('attendance:started', this.currentSession);
        } catch (error) {
            console.error('Ошибка начала рабочего дня:', error);
            this.eventBus.emit('notification', 'Ошибка начала рабочего дня', 'error');
        }
    }

    async endWork() {
        if (!this.currentSession) {
            this.eventBus.emit('notification', 'Рабочий день не начат', 'warning');
            return;
        }

        try {
            const response = await this.api.post('/attendance/end', {
                sessionId: this.currentSession.id,
                endTime: new Date().toISOString()
            });

            this.currentSession = null;
            this.updateUI();

            const duration = this.formatDuration(response.duration);
            this.eventBus.emit('notification',
                `Рабочий день завершен. Отработано: ${duration}`,
                'success'
            );
            this.eventBus.emit('attendance:ended', response);

            // Обновляем историю
            await this.loadAttendanceHistory();
        } catch (error) {
            console.error('Ошибка завершения рабочего дня:', error);
            this.eventBus.emit('notification', 'Ошибка завершения рабочего дня', 'error');
        }
    }

    updateUI() {
        const startBtn = document.getElementById('startWork');
        const endBtn = document.getElementById('endWork');
        const statusElement = document.querySelector('.attendance-status');

        if (this.currentSession) {
            if (startBtn) {
                startBtn.disabled = true;
                startBtn.style.display = 'none';
            }
            if (endBtn) {
                endBtn.disabled = false;
                endBtn.style.display = 'block';
            }
            if (statusElement) {
                statusElement.textContent = 'На работе';
                statusElement.className = 'attendance-status status-active';
            }

            // Запускаем таймер
            this.startTimer();
        } else {
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.style.display = 'block';
            }
            if (endBtn) {
                endBtn.disabled = true;
                endBtn.style.display = 'none';
            }
            if (statusElement) {
                statusElement.textContent = 'Не на работе';
                statusElement.className = 'attendance-status status-inactive';
            }

            // Останавливаем таймер
            this.stopTimer();
        }
    }

    startTimer() {
        if (this.timerInterval) return;

        const timerElement = document.querySelector('.attendance-timer');
        if (!timerElement) return;

        const startTime = new Date(this.currentSession.startTime);

        this.timerInterval = setInterval(() => {
            const now = new Date();
            const diff = now - startTime;
            timerElement.textContent = this.formatDuration(diff);
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        const timerElement = document.querySelector('.attendance-timer');
        if (timerElement) {
            timerElement.textContent = '00:00:00';
        }
    }

    async loadAttendanceHistory() {
        try {
            const loader = this.ui.showLoading(document.getElementById('attendance'));
            const history = await this.api.get('/attendance/history');
            this.renderAttendanceHistory(history);
            this.ui.hideLoading(loader);
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
            this.eventBus.emit('notification', 'Ошибка загрузки истории', 'error');
        }
    }

    renderAttendanceHistory(history) {
        const container = document.querySelector('.attendance-history');
        if (!container) return;

        if (history.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Нет записей о посещаемости</p>
                </div>
            `;
            return;
        }

        container.innerHTML = history.map(record => `
            <div class="attendance-record">
                <div class="record-date">
                    ${this.formatDate(record.date)}
                </div>
                <div class="record-times">
                    <span class="time-in">
                        Приход: ${this.formatTime(record.startTime)}
                    </span>
                    <span class="time-out">
                        Уход: ${record.endTime ? this.formatTime(record.endTime) : '-'}
                    </span>
                </div>
                <div class="record-duration">
                    Отработано: ${this.formatDuration(record.duration)}
                </div>
            </div>
        `).join('');
    }

    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        });
    }

    formatTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    async refresh() {
        await Promise.all([
            this.checkCurrentSession(),
            this.loadAttendanceHistory()
        ]);
    }
}