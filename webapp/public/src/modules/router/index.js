// Router для навигации по страницам
export class Router {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.currentPage = 'home';
        this.pages = new Map();
        this.setupNavigation();
    }

    registerPage(name, handler) {
        this.pages.set(name, handler);
    }

    navigate(page) {
        // Скрываем все страницы
        document.querySelectorAll('.page').forEach(p => {
            p.classList.add('hidden');
            p.style.display = 'none';
        });

        // Показываем нужную страницу
        const pageElement = document.getElementById(page);
        if (pageElement) {
            pageElement.classList.remove('hidden');
            pageElement.style.display = 'block';
        }

        // Обновляем активную навигацию
        this.updateNavigation(page);

        // Сохраняем текущую страницу
        this.currentPage = page;

        // Генерируем событие навигации
        this.eventBus.emit(`page:${page}`);
        this.eventBus.emit('navigation', { page });

        // Вызываем обработчик страницы
        const handler = this.pages.get(page);
        if (handler) {
            handler();
        }
    }

    updateNavigation(page) {
        // Обновляем активный элемент в навигации
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        const activeItem = document.querySelector(`[data-page="${page}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }

    setupNavigation() {
        // Обработка клика по навигации
        document.addEventListener('click', (e) => {
            const navItem = e.target.closest('[data-page]');
            if (navItem) {
                e.preventDefault();
                const page = navItem.dataset.page;
                this.navigate(page);
            }
        });

        // Обработка истории браузера
        window.addEventListener('popstate', (e) => {
            if (e.state?.page) {
                this.navigate(e.state.page);
            }
        });
    }

    getCurrentPage() {
        return this.currentPage;
    }

    back() {
        window.history.back();
    }

    forward() {
        window.history.forward();
    }
}