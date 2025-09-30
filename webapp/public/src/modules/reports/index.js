// Модуль управления отчетами
export class ReportsModule {
    constructor(api, eventBus, ui) {
        this.api = api;
        this.eventBus = eventBus;
        this.ui = ui;
        this.currentUser = null;
        this.setupEventListeners();
    }

    initialize(currentUser) {
        this.currentUser = currentUser;
        this.setupForm();
    }

    setupEventListeners() {
        this.eventBus.on('page:reports', () => {
            this.loadReports();
        });

        this.eventBus.on('reports:updated', () => {
            this.refresh();
        });
    }

    setupForm() {
        const form = document.getElementById('reportForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitReport(e);
        });
    }

    async submitReport(event) {
        const form = event.target;
        const submitBtn = form.querySelector('button[type="submit"]');

        try {
            // Блокируем повторную отправку
            submitBtn.disabled = true;
            submitBtn.textContent = 'Отправка...';

            const formData = new FormData(form);
            const reportData = {
                employeeId: this.currentUser?.id,
                employeeName: formData.get('employeeName') || this.currentUser?.firstName,
                date: formData.get('date') || new Date().toISOString().split('T')[0],
                tasks: formData.get('tasks'),
                problems: formData.get('problems'),
                plans: formData.get('plans'),
                mood: formData.get('mood')
            };

            const response = await this.api.post('/reports', reportData);

            this.eventBus.emit('notification', 'Отчет успешно отправлен', 'success');
            this.eventBus.emit('reports:created', response);

            // Очищаем форму
            form.reset();

            // Обновляем статистику
            await this.updateReportsCount();
        } catch (error) {
            console.error('Ошибка отправки отчета:', error);
            this.eventBus.emit('notification', 'Ошибка отправки отчета', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Отправить отчет';
        }
    }

    async loadReports() {
        try {
            const loader = this.ui.showLoading(document.getElementById('reports'));
            const reports = await this.api.get('/reports');
            this.renderReports(reports);
            this.ui.hideLoading(loader);
        } catch (error) {
            console.error('Ошибка загрузки отчетов:', error);
            this.eventBus.emit('notification', 'Ошибка загрузки отчетов', 'error');
        }
    }

    renderReports(reports) {
        const container = document.querySelector('.reports-list');
        if (!container) return;

        if (reports.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Нет отчетов</p>
                </div>
            `;
            return;
        }

        container.innerHTML = reports.map(report => `
            <div class="report-card">
                <div class="report-header">
                    <h3>${report.employeeName}</h3>
                    <span class="report-date">${this.formatDate(report.date)}</span>
                </div>
                <div class="report-content">
                    <div class="report-section">
                        <h4>Выполненные задачи</h4>
                        <p>${report.tasks}</p>
                    </div>
                    ${report.problems ? `
                        <div class="report-section">
                            <h4>Проблемы</h4>
                            <p>${report.problems}</p>
                        </div>
                    ` : ''}
                    ${report.plans ? `
                        <div class="report-section">
                            <h4>Планы</h4>
                            <p>${report.plans}</p>
                        </div>
                    ` : ''}
                </div>
                <div class="report-mood mood-${report.mood || 'neutral'}">
                    ${this.getMoodEmoji(report.mood)}
                </div>
            </div>
        `).join('');
    }

    async updateReportsCount() {
        try {
            const stats = await this.api.get('/reports/stats');
            const countElement = document.querySelector('.reports-count');
            if (countElement && stats.today !== undefined) {
                this.ui.animateCounter(countElement,
                    parseInt(countElement.textContent) || 0,
                    stats.today
                );
            }
        } catch (error) {
            console.error('Ошибка обновления статистики отчетов:', error);
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    getMoodEmoji(mood) {
        const moods = {
            great: '😊',
            good: '🙂',
            neutral: '😐',
            bad: '😔',
            terrible: '😢'
        };
        return moods[mood] || moods.neutral;
    }

    async refresh() {
        await Promise.all([
            this.loadReports(),
            this.updateReportsCount()
        ]);
    }
}