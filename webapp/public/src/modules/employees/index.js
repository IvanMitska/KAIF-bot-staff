// Модуль управления сотрудниками
export class EmployeesModule {
    constructor(api, eventBus, ui, tasksModule) {
        this.api = api;
        this.eventBus = eventBus;
        this.ui = ui;
        this.tasksModule = tasksModule;
        this.employees = [];
        this.setupEventListeners();
    }

    initialize() {
        this.loadEmployees();
    }

    setupEventListeners() {
        this.eventBus.on('page:employees', () => {
            this.renderEmployees();
        });

        this.eventBus.on('employees:updated', () => {
            this.refresh();
        });
    }

    async loadEmployees() {
        try {
            const response = await this.api.get('/employees');
            this.employees = response.employees || response || [];
            await this.updateEmployeesCount();
            return this.employees;
        } catch (error) {
            console.error('Ошибка загрузки сотрудников:', error);
            this.eventBus.emit('notification', 'Ошибка загрузки сотрудников', 'error');
            return [];
        }
    }

    renderEmployees() {
        const container = document.getElementById('employees');
        if (!container) return;

        const grid = container.querySelector('.employees-grid');
        if (!grid) return;

        if (this.employees.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <p>Нет сотрудников</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = this.employees.map(employee => this.createEmployeeCard(employee)).join('');
        this.attachCardListeners();
    }

    createEmployeeCard(employee) {
        return `
            <div class="employee-card" data-employee-id="${employee.id}">
                <div class="employee-header">
                    ${employee.photoUrl ?
                        `<img src="${employee.photoUrl}" alt="${employee.name}" class="employee-avatar">` :
                        `<div class="employee-avatar-placeholder">${this.getInitials(employee.name)}</div>`
                    }
                    <h3>${employee.name}</h3>
                    <span class="employee-role">${employee.position || 'Сотрудник'}</span>
                </div>
                <div class="employee-stats">
                    <div class="stat">
                        <span class="stat-value">${employee.tasksCompleted || 0}</span>
                        <span class="stat-label">Задач выполнено</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${employee.reportsCount || 0}</span>
                        <span class="stat-label">Отчетов</span>
                    </div>
                </div>
                <div class="employee-actions">
                    <button class="btn btn-primary btn-assign-task"
                            data-employee-id="${employee.id}"
                            data-employee-name="${employee.name}">
                        Назначить задачу
                    </button>
                    ${employee.lastSeen ? `
                        <span class="last-seen">
                            Был(а) ${this.formatLastSeen(employee.lastSeen)}
                        </span>
                    ` : ''}
                </div>
            </div>
        `;
    }

    attachCardListeners() {
        // Обработка кликов на кнопки назначения задач
        document.querySelectorAll('.btn-assign-task').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const employeeId = btn.dataset.employeeId;
                const employeeName = btn.dataset.employeeName;
                this.showCreateTaskModal(employeeId, employeeName);
            });
        });

        // Обработка кликов на карточки сотрудников
        document.querySelectorAll('.employee-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('btn-assign-task')) {
                    const employeeId = card.dataset.employeeId;
                    this.showEmployeeDetails(employeeId);
                }
            });
        });
    }

    showCreateTaskModal(employeeId, employeeName) {
        if (this.tasksModule) {
            this.tasksModule.showCreateTaskModal(employeeId, employeeName);
        } else {
            // Fallback для обратной совместимости
            const modal = document.getElementById('taskModal');
            if (modal) {
                const assigneeSelect = modal.querySelector('#taskAssignee');
                if (assigneeSelect) {
                    assigneeSelect.value = employeeId;
                }
                modal.classList.remove('hidden');
                modal.style.display = 'flex';
            }
        }
    }

    async showEmployeeDetails(employeeId) {
        const employee = this.employees.find(e => e.id === employeeId);
        if (!employee) return;

        // Здесь можно показать детальную информацию о сотруднике
        this.eventBus.emit('employee:selected', employee);
    }

    async updateEmployeesCount() {
        const countElement = document.querySelector('.employees-count');
        if (countElement) {
            this.ui.animateCounter(
                countElement,
                parseInt(countElement.textContent) || 0,
                this.employees.length
            );
        }
    }

    getInitials(name) {
        const parts = name.split(' ');
        return parts.map(p => p[0]).join('').toUpperCase().slice(0, 2);
    }

    formatLastSeen(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'только что';
        if (diffMins < 60) return `${diffMins} мин назад`;
        if (diffHours < 24) return `${diffHours} ч назад`;
        if (diffDays < 7) return `${diffDays} дн назад`;

        return date.toLocaleDateString('ru-RU');
    }

    async refresh() {
        await this.loadEmployees();
        this.renderEmployees();
    }

    getEmployeeById(id) {
        return this.employees.find(e => e.id === id);
    }

    getActiveEmployees() {
        const oneDayAgo = new Date(Date.now() - 86400000);
        return this.employees.filter(e =>
            e.lastSeen && new Date(e.lastSeen) > oneDayAgo
        );
    }
}