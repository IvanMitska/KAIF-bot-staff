// API клиент
import { Config } from '../config';

export class API {
    constructor(baseURL) {
        this.baseURL = baseURL;
        this.timeout = Config.API_TIMEOUT;
        this.headers = {
            'Content-Type': 'application/json'
        };

        // Добавляем Telegram Init Data если доступно
        const tg = Config.TELEGRAM;
        if (tg?.initData) {
            this.headers['X-Telegram-Init-Data'] = tg.initData;
        }
    }

    async request(endpoint, options = {}) {
        const url = Config.getApiUrl(endpoint);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...this.headers,
                    ...options.headers
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new APIError(
                    error.message || `HTTP Error ${response.status}`,
                    response.status,
                    error
                );
            }

            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                return await response.json();
            }

            return await response.text();

        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new APIError('Превышено время ожидания запроса', 408);
            }

            throw error;
        }
    }

    // GET запрос
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;

        return this.request(url, {
            method: 'GET'
        });
    }

    // POST запрос
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // PUT запрос
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // DELETE запрос
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }

    // PATCH запрос
    async patch(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }
}

// Класс для API ошибок
export class APIError extends Error {
    constructor(message, status, data = null) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }
}