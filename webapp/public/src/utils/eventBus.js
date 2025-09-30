// Event Bus для коммуникации между модулями
export class EventBus {
    constructor() {
        this.events = new Map();
    }

    // Подписка на событие
    on(event, handler) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(handler);

        // Возвращаем функцию отписки
        return () => this.off(event, handler);
    }

    // Одноразовая подписка
    once(event, handler) {
        const wrapper = (...args) => {
            handler(...args);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }

    // Отписка от события
    off(event, handler) {
        if (!this.events.has(event)) return;

        const handlers = this.events.get(event);
        const index = handlers.indexOf(handler);

        if (index > -1) {
            handlers.splice(index, 1);
        }

        if (handlers.length === 0) {
            this.events.delete(event);
        }
    }

    // Генерация события
    emit(event, ...args) {
        if (!this.events.has(event)) return;

        const handlers = this.events.get(event);
        handlers.forEach(handler => {
            try {
                handler(...args);
            } catch (error) {
                console.error(`Ошибка в обработчике события ${event}:`, error);
            }
        });
    }

    // Очистка всех подписок
    clear() {
        this.events.clear();
    }

    // Получение количества подписчиков
    getListenerCount(event) {
        return this.events.has(event) ? this.events.get(event).length : 0;
    }
}