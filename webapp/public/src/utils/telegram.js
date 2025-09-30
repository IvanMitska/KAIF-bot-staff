// Утилита для работы с Telegram Web App
import { Config } from '../config';

export class TelegramWebApp {
    static tg = window.Telegram?.WebApp;

    static init() {
        if (!this.tg) {
            console.warn('Telegram Web App не доступен');
            return;
        }

        // Готовность приложения
        this.tg.ready();

        // Разворачиваем на весь экран
        this.tg.expand();

        // Устанавливаем темную тему
        this.setDarkTheme();

        // Настройка кнопок
        this.setupButtons();

        console.log('✅ Telegram Web App инициализирован');
    }

    static setDarkTheme() {
        // Принудительно темная тема
        document.documentElement.style.setProperty('--tg-theme-bg-color', '#0F0F14');
        document.documentElement.style.setProperty('--tg-theme-text-color', '#FFFFFF');
        document.documentElement.style.setProperty('--tg-theme-hint-color', '#999999');
        document.documentElement.style.setProperty('--tg-theme-link-color', '#00D4FF');
        document.documentElement.style.setProperty('--tg-theme-button-color', '#00D4FF');
        document.documentElement.style.setProperty('--tg-theme-button-text-color', '#FFFFFF');
    }

    static setupButtons() {
        // Настройка кнопки "Назад"
        if (this.tg?.BackButton) {
            this.tg.BackButton.hide();
        }

        // Настройка главной кнопки
        if (this.tg?.MainButton) {
            this.tg.MainButton.hide();
        }
    }

    static showMainButton(text, callback) {
        if (!this.tg?.MainButton) return;

        this.tg.MainButton.setText(text);
        this.tg.MainButton.onClick(callback);
        this.tg.MainButton.show();
    }

    static hideMainButton() {
        if (this.tg?.MainButton) {
            this.tg.MainButton.hide();
        }
    }

    static showBackButton(callback) {
        if (!this.tg?.BackButton) return;

        this.tg.BackButton.onClick(callback);
        this.tg.BackButton.show();
    }

    static hideBackButton() {
        if (this.tg?.BackButton) {
            this.tg.BackButton.hide();
        }
    }

    static showAlert(message) {
        if (this.tg?.showAlert) {
            this.tg.showAlert(message);
        } else {
            alert(message);
        }
    }

    static showConfirm(message, callback) {
        if (this.tg?.showConfirm) {
            this.tg.showConfirm(message, callback);
        } else {
            const result = confirm(message);
            callback(result);
        }
    }

    static hapticFeedback(type = 'impact', style = 'light') {
        if (!this.tg?.HapticFeedback) return;

        switch(type) {
            case 'impact':
                this.tg.HapticFeedback.impactOccurred(style);
                break;
            case 'notification':
                this.tg.HapticFeedback.notificationOccurred(style);
                break;
            case 'selection':
                this.tg.HapticFeedback.selectionChanged();
                break;
        }
    }

    static get initData() {
        return this.tg?.initData || null;
    }

    static get initDataUnsafe() {
        return this.tg?.initDataUnsafe || {};
    }

    static get user() {
        return this.initDataUnsafe.user || null;
    }

    static get isExpanded() {
        return this.tg?.isExpanded || false;
    }

    static get viewportHeight() {
        return this.tg?.viewportHeight || window.innerHeight;
    }

    static get viewportStableHeight() {
        return this.tg?.viewportStableHeight || window.innerHeight;
    }

    static get platform() {
        return this.tg?.platform || 'unknown';
    }

    static get colorScheme() {
        return this.tg?.colorScheme || 'dark';
    }

    static close() {
        if (this.tg?.close) {
            this.tg.close();
        }
    }
}