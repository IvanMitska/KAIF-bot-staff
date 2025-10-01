// Финальное исправление кликабельности задач
console.log('🔧 task-click-fix.js загружен');

(function() {
    'use strict';

    // Глобальный флаг для отслеживания инициализации
    let isInitialized = false;
    let initAttempts = 0;

    // Функция для добавления обработчиков клика на все задачи
    function attachTaskClickHandlers() {
        const taskItems = document.querySelectorAll('.task-item-modern[data-task-id]');

        if (taskItems.length === 0) {
            console.log('⚠️ Задачи не найдены на странице');
            return false;
        }

        console.log(`🎯 Найдено задач для обработки: ${taskItems.length}`);
        let handlersAdded = 0;

        taskItems.forEach((item, index) => {
            // Проверяем, не добавлен ли уже обработчик
            if (item.hasAttribute('data-click-handler-added')) {
                return;
            }

            const taskId = item.getAttribute('data-task-id');
            if (!taskId) {
                console.warn(`⚠️ Задача ${index} не имеет data-task-id`);
                return;
            }

            // Создаем обработчик клика
            const clickHandler = function(e) {
                e.preventDefault();
                e.stopPropagation();

                console.log(`🖱️ Клик по задаче: ${taskId}`);

                // Пробуем вызвать showTaskDetails
                if (typeof window.showTaskDetails === 'function') {
                    try {
                        window.showTaskDetails(taskId);
                        console.log('✅ showTaskDetails вызвана успешно');
                    } catch (error) {
                        console.error('❌ Ошибка при вызове showTaskDetails:', error);
                    }
                } else {
                    console.error('❌ showTaskDetails не найдена!');
                    // Пытаемся подождать и повторить
                    setTimeout(() => {
                        if (typeof window.showTaskDetails === 'function') {
                            window.showTaskDetails(taskId);
                        }
                    }, 500);
                }
            };

            // Удаляем старые обработчики и атрибуты
            item.removeAttribute('onclick');
            item.onclick = null;

            // Добавляем новый обработчик
            item.addEventListener('click', clickHandler);
            item.style.cursor = 'pointer';
            item.style.userSelect = 'none';

            // Добавляем визуальный эффект при наведении
            item.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.15)';
            });

            item.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
            });

            // Помечаем, что обработчик добавлен
            item.setAttribute('data-click-handler-added', 'true');
            handlersAdded++;

            console.log(`✅ Обработчик добавлен для задачи ${taskId}`);
        });

        console.log(`📊 Обработчики добавлены: ${handlersAdded}/${taskItems.length}`);
        return handlersAdded > 0;
    }

    // Функция для наблюдения за изменениями DOM
    function observeTasksContainer() {
        const tasksContainer = document.getElementById('tasksList');

        if (!tasksContainer) {
            console.log('⚠️ Контейнер tasksList не найден');
            return;
        }

        console.log('👁️ Начинаем наблюдение за tasksList');

        // Создаем наблюдатель
        const observer = new MutationObserver((mutations) => {
            let tasksAdded = false;

            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1 && (
                            node.classList?.contains('task-item-modern') ||
                            node.querySelector?.('.task-item-modern')
                        )) {
                            tasksAdded = true;
                        }
                    });
                }
            });

            if (tasksAdded) {
                console.log('🔄 Обнаружены новые задачи, добавляем обработчики...');
                setTimeout(() => {
                    attachTaskClickHandlers();
                }, 100);
            }
        });

        // Начинаем наблюдение
        observer.observe(tasksContainer, {
            childList: true,
            subtree: true
        });

        console.log('✅ Наблюдатель установлен');
    }

    // Функция инициализации
    function initialize() {
        initAttempts++;
        console.log(`🚀 Попытка инициализации #${initAttempts}`);

        // Проверяем, загружена ли страница с задачами
        const tasksPage = document.getElementById('tasks');
        const isTasksPageVisible = tasksPage && !tasksPage.classList.contains('hidden') && tasksPage.style.display !== 'none';

        if (!isTasksPageVisible && initAttempts < 20) {
            console.log('⏳ Страница задач еще не активна, ждем...');
            setTimeout(initialize, 500);
            return;
        }

        // Добавляем обработчики к существующим задачам
        const success = attachTaskClickHandlers();

        if (success) {
            isInitialized = true;
            console.log('✅ Инициализация успешна');
        } else if (initAttempts < 20) {
            console.log('⏳ Задачи еще не загружены, повторяем...');
            setTimeout(initialize, 500);
        }

        // Устанавливаем наблюдатель
        observeTasksContainer();
    }

    // Функция для переинициализации при переходе на страницу задач
    function reinitializeOnTasksPage() {
        // Слушаем клики по навигации
        document.addEventListener('click', function(e) {
            const target = e.target;

            // Проверяем, это клик по кнопке задач?
            if (target.closest('[onclick*="showPage(\'tasks\')"]') ||
                target.closest('[data-page="tasks"]') ||
                (target.textContent && target.textContent.includes('Задачи'))) {

                console.log('🔄 Переход на страницу задач, переинициализация...');

                // Ждем загрузки страницы и добавляем обработчики
                setTimeout(() => {
                    attachTaskClickHandlers();
                    observeTasksContainer();
                }, 500);
            }
        });

        // Также слушаем изменения видимости страницы
        const tasksPage = document.getElementById('tasks');
        if (tasksPage) {
            const visibilityObserver = new MutationObserver(() => {
                if (!tasksPage.classList.contains('hidden') && tasksPage.style.display !== 'none') {
                    console.log('📋 Страница задач стала видимой');
                    setTimeout(attachTaskClickHandlers, 100);
                }
            });

            visibilityObserver.observe(tasksPage, {
                attributes: true,
                attributeFilter: ['class', 'style']
            });
        }
    }

    // Периодическая проверка и восстановление обработчиков
    function periodicCheck() {
        setInterval(() => {
            const tasksPage = document.getElementById('tasks');
            const isVisible = tasksPage && !tasksPage.classList.contains('hidden') && tasksPage.style.display !== 'none';

            if (isVisible) {
                const taskItems = document.querySelectorAll('.task-item-modern[data-task-id]');
                const unhandledItems = document.querySelectorAll('.task-item-modern[data-task-id]:not([data-click-handler-added])');

                if (unhandledItems.length > 0) {
                    console.log(`🔧 Найдено ${unhandledItems.length} задач без обработчиков, добавляем...`);
                    attachTaskClickHandlers();
                }
            }
        }, 2000);
    }

    // Главная функция запуска
    function startTaskClickFix() {
        console.log('🏁 Запуск task-click-fix');

        // Запускаем инициализацию
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialize);
        } else {
            setTimeout(initialize, 100);
        }

        // Запускаем дополнительные механизмы
        reinitializeOnTasksPage();
        periodicCheck();

        // Экспортируем функцию для ручного вызова
        window.fixTaskClicks = function() {
            console.log('🔧 Ручное исправление кликов');
            attachTaskClickHandlers();
        };

        console.log('✅ task-click-fix запущен и работает');
    }

    // Запускаем исправление
    startTaskClickFix();

})();

console.log('✅ task-click-fix.js полностью загружен');