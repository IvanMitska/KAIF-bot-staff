// Модуль управления сотрудниками
import { Config } from './config.js';
import { UI } from './ui.js';

export const Employees = {
    // Список сотрудников
    employeesList: [],

    // Загрузка списка сотрудников
    async loadEmployees() {
        const tg = window.Telegram.WebApp;
        const container = document.getElementById('employeesList');

        if (!container) return;

        UI.showLoading(container, 'Загрузка сотрудников...');

        try {
            const response = await fetch(Config.getApiUrl('/api/employees'), {
                headers: {
                    'X-Telegram-Init-Data': tg.initData || ''
                }
            });

            if (response.ok) {
                this.employeesList = await response.json();
                this.displayEmployees(this.employeesList);
            } else {
                throw new Error('Ошибка загрузки сотрудников');
            }
        } catch (error) {
            console.error('Ошибка загрузки сотрудников:', error);
            UI.showError(container, 'Ошибка загрузки сотрудников', 'KaifApp.Employees.loadEmployees()');
        }
    },

    // Отображение сотрудников
    displayEmployees(employees) {
        const container = document.getElementById('employeesList');
        if (!container) return;

        if (!employees || employees.length === 0) {
            UI.showEmpty(container, 'Нет сотрудников для отображения');
            return;
        }

        let html = '<div class="employees-grid">';

        employees.forEach(employee => {
            const statusClass = employee.isPresent ? 'present' : 'absent';
            const statusText = employee.isPresent ? 'На месте' : 'Отсутствует';

            html += `
                <div class="employee-card ${statusClass}">
                    <div class="employee-header">
                        <h3>${employee.name}</h3>
                        <span class="employee-status">${statusText}</span>
                    </div>
                    <div class="employee-info">
                        <p class="employee-position">${employee.position || 'Сотрудник'}</p>
                        ${employee.lastSeen ? `
                            <p class="employee-last-seen">
                                Последний раз: ${UI.formatDate(employee.lastSeen, 'time')}
                            </p>
                        ` : ''}
                    </div>
                    <div class="employee-actions">
                        <button onclick="KaifApp.Tasks.showCreateTaskModal(${employee.telegramId}, '${employee.name}')"
                                class="btn-action">
                            <i data-lucide="plus-circle"></i>
                            Создать задачу
                        </button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

        // Переинициализировать иконки Lucide
        if (window.lucide) {
            window.lucide.createIcons();
        }
    },

    // Загрузка сотрудников для select
    async loadEmployeesForSelect(selectId) {
        const tg = window.Telegram.WebApp;
        const select = document.getElementById(selectId);

        if (!select) return;

        // Добавляем опцию загрузки
        select.innerHTML = '<option value="">Загрузка...</option>';

        try {
            const response = await fetch(Config.getApiUrl('/api/employees'), {
                headers: {
                    'X-Telegram-Init-Data': tg.initData || ''
                }
            });

            if (response.ok) {
                const employees = await response.json();

                // Очищаем select
                select.innerHTML = '<option value="">Выберите сотрудника</option>';

                // Добавляем сотрудников
                employees.forEach(employee => {
                    const option = document.createElement('option');
                    option.value = employee.telegramId;
                    option.textContent = employee.name;
                    select.appendChild(option);
                });

                // Добавляем текущего пользователя если его нет в списке
                const currentUserId = tg.initDataUnsafe?.user?.id;
                if (currentUserId && !employees.find(e => e.telegramId === currentUserId)) {
                    const option = document.createElement('option');
                    option.value = currentUserId;
                    option.textContent = tg.initDataUnsafe.user.first_name + ' (Вы)';
                    select.appendChild(option);
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки сотрудников для select:', error);
            select.innerHTML = '<option value="">Ошибка загрузки</option>';
        }
    },

    // Поиск сотрудника по ID
    getEmployeeById(id) {
        return this.employeesList.find(e => e.telegramId === id);
    },

    // Обновление статуса сотрудника
    async updateEmployeeStatus(employeeId, isPresent) {
        const tg = window.Telegram.WebApp;

        try {
            const response = await fetch(Config.getApiUrl(`/api/employees/${employeeId}/status`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Init-Data': tg.initData || ''
                },
                body: JSON.stringify({ isPresent })
            });

            if (response.ok) {
                await this.loadEmployees();
                UI.showNotification('Статус сотрудника обновлен', 'success');
            } else {
                throw new Error('Ошибка обновления статуса');
            }
        } catch (error) {
            console.error('Ошибка обновления статуса сотрудника:', error);
            UI.showNotification('Ошибка обновления статуса', 'error');
        }
    }
};