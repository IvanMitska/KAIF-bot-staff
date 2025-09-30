// API для работы с задачами
export class TasksAPI {
    constructor(apiClient) {
        this.api = apiClient;
    }

    async getTasks(filters = {}) {
        const params = new URLSearchParams();

        if (filters.status) params.append('status', filters.status);
        if (filters.assigneeId) params.append('assigneeId', filters.assigneeId);
        if (filters.priority) params.append('priority', filters.priority);

        return this.api.get(`/tasks?${params}`);
    }

    async getTask(id) {
        return this.api.get(`/tasks/${id}`);
    }

    async createTask(taskData) {
        return this.api.post('/tasks', taskData);
    }

    async updateTask(id, updates) {
        return this.api.patch(`/tasks/${id}`, updates);
    }

    async updateTaskStatus(id, status) {
        return this.api.patch(`/tasks/${id}/status`, { status });
    }

    async deleteTask(id) {
        return this.api.delete(`/tasks/${id}`);
    }

    async getTasksStats() {
        return this.api.get('/tasks/stats');
    }

    async assignTask(taskId, userId) {
        return this.api.post(`/tasks/${taskId}/assign`, { userId });
    }

    async addComment(taskId, comment) {
        return this.api.post(`/tasks/${taskId}/comments`, { text: comment });
    }
}