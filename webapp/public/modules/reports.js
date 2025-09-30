// Модуль управления отчетами
import { Config } from './config.js';
import { UI } from './ui.js';

export const Reports = {
    // Проверка статуса отчета
    async checkReportStatus() {
        const tg = window.Telegram.WebApp;
        const reportSection = document.getElementById('report');

        if (!reportSection) return;

        try {
            const response = await fetch(Config.getApiUrl('/api/reports/status'), {
                headers: {
                    'X-Telegram-Init-Data': tg.initData || ''
                }
            });

            if (response.ok) {
                const { hasReportedToday } = await response.json();

                if (hasReportedToday) {
                    reportSection.innerHTML = `
                        <div class="report-status success">
                            <i data-lucide="check-circle"></i>
                            <h2>Отчет уже отправлен</h2>
                            <p>Вы уже отправили отчет сегодня. Следующий отчет можно будет отправить завтра.</p>
                        </div>
                    `;
                } else {
                    this.showReportForm();
                }
            }
        } catch (error) {
            console.error('Ошибка проверки статуса отчета:', error);
            this.showReportForm();
        }
    },

    // Показать форму отчета
    showReportForm() {
        const reportSection = document.getElementById('report');
        if (!reportSection) return;

        reportSection.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2>Ежедневный отчет</h2>
                </div>
                <form id="reportForm" class="report-form">
                    <div class="form-group">
                        <label for="accomplishments">Что сделано сегодня *</label>
                        <textarea
                            id="accomplishments"
                            name="accomplishments"
                            required
                            rows="4"
                            placeholder="Опишите выполненные задачи..."
                        ></textarea>
                    </div>

                    <div class="form-group">
                        <label for="plans">Планы на завтра *</label>
                        <textarea
                            id="plans"
                            name="plans"
                            required
                            rows="4"
                            placeholder="Что планируете сделать завтра..."
                        ></textarea>
                    </div>

                    <div class="form-group">
                        <label for="problems">Проблемы (если есть)</label>
                        <textarea
                            id="problems"
                            name="problems"
                            rows="3"
                            placeholder="Опишите проблемы, если они есть..."
                        ></textarea>
                    </div>

                    <button type="submit" class="submit-btn">
                        <i data-lucide="send"></i>
                        Отправить отчет
                    </button>
                </form>
            </div>
        `;

        // Переинициализировать форму
        const form = document.getElementById('reportForm');
        if (form) {
            form.addEventListener('submit', (e) => this.submitReport(e));
        }
    },

    // Отправка отчета
    async submitReport(event) {
        event.preventDefault();
        const tg = window.Telegram.WebApp;

        const formData = new FormData(event.target);
        const reportData = {
            accomplishments: formData.get('accomplishments'),
            plans: formData.get('plans'),
            problems: formData.get('problems') || ''
        };

        const submitBtn = event.target.querySelector('.submit-btn');
        const originalContent = submitBtn.innerHTML;
        submitBtn.innerHTML = '<div class="spinner"></div> Отправка...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(Config.getApiUrl('/api/reports'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Init-Data': tg.initData || ''
                },
                body: JSON.stringify(reportData)
            });

            if (response.ok) {
                const result = await response.json();

                // Показать успешное сообщение
                document.getElementById('report').innerHTML = `
                    <div class="report-status success">
                        <i data-lucide="check-circle"></i>
                        <h2>Отчет успешно отправлен!</h2>
                        <p>Ваш ежедневный отчет был успешно сохранен.</p>
                        <div class="report-summary">
                            <h3>Что сделано:</h3>
                            <p>${reportData.accomplishments}</p>
                            <h3>Планы на завтра:</h3>
                            <p>${reportData.plans}</p>
                            ${reportData.problems ? `
                                <h3>Проблемы:</h3>
                                <p>${reportData.problems}</p>
                            ` : ''}
                        </div>
                    </div>
                `;

                UI.showNotification('Отчет успешно отправлен!', 'success');

                // Вибрация при успехе
                if (tg.HapticFeedback) {
                    tg.HapticFeedback.notificationOccurred('success');
                }
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка отправки отчета');
            }
        } catch (error) {
            console.error('Error submitting report:', error);
            UI.showNotification(error.message || 'Ошибка при отправке отчета', 'error');

            submitBtn.innerHTML = originalContent;
            submitBtn.disabled = false;

            if (tg.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('error');
            }
        }
    },

    // Загрузка истории отчетов
    async loadReportsHistory() {
        const tg = window.Telegram.WebApp;

        try {
            const response = await fetch(Config.getApiUrl('/api/reports/history'), {
                headers: {
                    'X-Telegram-Init-Data': tg.initData || ''
                }
            });

            if (response.ok) {
                const reports = await response.json();
                this.displayReportsHistory(reports);
            }
        } catch (error) {
            console.error('Ошибка загрузки истории отчетов:', error);
        }
    },

    // Отображение истории отчетов
    displayReportsHistory(reports) {
        const container = document.getElementById('reportsHistory');
        if (!container) return;

        if (!reports || reports.length === 0) {
            UI.showEmpty(container, 'История отчетов пуста');
            return;
        }

        let html = '<div class="reports-history">';

        reports.forEach(report => {
            html += `
                <div class="report-card">
                    <div class="report-date">
                        ${UI.formatDate(report.createdAt, 'long')}
                    </div>
                    <div class="report-content">
                        <h4>Выполнено:</h4>
                        <p>${report.accomplishments}</p>
                        <h4>Планы:</h4>
                        <p>${report.plans}</p>
                        ${report.problems ? `
                            <h4>Проблемы:</h4>
                            <p>${report.problems}</p>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }
};