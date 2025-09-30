// Модуль авторизации
export class AuthModule {
    constructor(api, eventBus) {
        this.api = api;
        this.eventBus = eventBus;
        this.currentUser = null;
    }

    async initialize() {
        // Получаем данные пользователя из Telegram WebApp
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;

        if (tgUser) {
            this.currentUser = {
                id: tgUser.id,
                firstName: tgUser.first_name,
                lastName: tgUser.last_name,
                username: tgUser.username,
                photoUrl: tgUser.photo_url,
                isBot: tgUser.is_bot || false
            };

            // Авторизуем на сервере
            await this.authenticate();
        }

        return this.currentUser;
    }

    async authenticate() {
        try {
            const response = await this.api.post('/auth/telegram', {
                initData: window.Telegram?.WebApp?.initData
            });

            if (response.user) {
                this.currentUser = { ...this.currentUser, ...response.user };
                this.eventBus.emit('auth:success', this.currentUser);
            }

            return response;
        } catch (error) {
            console.error('Ошибка авторизации:', error);
            this.eventBus.emit('auth:error', error);
            throw error;
        }
    }

    getUser() {
        return this.currentUser;
    }

    isAuthenticated() {
        return !!this.currentUser;
    }

    logout() {
        this.currentUser = null;
        this.eventBus.emit('auth:logout');
    }

    hasPermission(permission) {
        if (!this.currentUser) return false;

        // Проверка прав доступа
        return this.currentUser.permissions?.includes(permission) || false;
    }

    isAdmin() {
        return this.hasPermission('admin') || this.currentUser?.role === 'admin';
    }

    updateUserInfo(updates) {
        if (this.currentUser) {
            this.currentUser = { ...this.currentUser, ...updates };
            this.eventBus.emit('user:updated', this.currentUser);
        }
    }
}