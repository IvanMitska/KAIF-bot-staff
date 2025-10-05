// ===== ИСПРАВЛЕНИЕ ПРОБЛЕМ С ЗАДАЧАМИ =====
// Этот файл исправляет проблемы с открытием задач, дублированием и двойным сохранением

console.log('📋 Loading task-fixes.js');

// Ждем загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Applying task fixes...');

    // 1. ИСПРАВЛЕНИЕ КЛИКА ПО ЗАДАЧАМ
    // Убедимся, что функция showTaskDetails доступна глобально
    if (typeof window.showTaskDetails !== 'function') {
        console.log('⚠️ showTaskDetails not found, creating fallback...');

        window.showTaskDetails = async function(taskId) {
            console.log('📋 Opening task details:', taskId);

            // Проверяем, есть ли функция openTaskDetail
            if (typeof window.openTaskDetail === 'function') {
                await window.openTaskDetail(taskId);
                return;
            }

            // Иначе показываем простое модальное окно
            const task = window.currentTasks?.find(t => String(t.id) === String(taskId));
            if (task) {
                alert(`Задача: ${task.title}\n\nОписание: ${task.description || 'Нет описания'}\n\nСтатус: ${task.status}\nДедлайн: ${task.deadline}`);
            } else {
                console.error('Task not found:', taskId);
                alert('Задача не найдена');
            }
        };
    }

    // 2. ИСПРАВЛЕНИЕ ДУБЛИРОВАНИЯ ЗАДАЧ
    // Добавляем защиту от двойной отправки формы
    let isSubmittingTask = false;
    let lastSubmittedTask = null;

    const originalSubmitTask = window.submitTask;
    window.submitTask = async function(event) {
        console.log('🔧 Enhanced submitTask called');
        event.preventDefault();

        // Проверка на повторную отправку
        if (isSubmittingTask) {
            console.log('⚠️ Task submission already in progress, blocking duplicate');
            return;
        }

        const formData = new FormData(event.target);
        const taskData = {
            title: formData.get('title'),
            description: formData.get('description'),
            deadline: formData.get('deadline'),
            priority: formData.get('priority'),
            assigneeId: formData.get('employee')
        };

        // Проверка на дубликат по содержимому
        if (lastSubmittedTask &&
            lastSubmittedTask.title === taskData.title &&
            lastSubmittedTask.assigneeId === taskData.assigneeId &&
            (Date.now() - lastSubmittedTask.timestamp) < 5000) {
            console.log('⚠️ Duplicate task detected, blocking submission');
            alert('Эта задача уже была создана');
            return;
        }

        isSubmittingTask = true;

        // Сохраняем информацию о последней отправленной задаче
        lastSubmittedTask = {
            ...taskData,
            timestamp: Date.now()
        };

        try {
            // Вызываем оригинальную функцию если она есть
            if (originalSubmitTask) {
                await originalSubmitTask.call(this, event);
            } else {
                // Иначе выполняем отправку сами
                const tg = window.Telegram?.WebApp;
                const response = await fetch('/api/tasks', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Telegram-Init-Data': tg?.initData || ''
                    },
                    body: JSON.stringify(taskData)
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Task created:', result);

                    // Закрываем модальное окно
                    if (typeof closeTaskModal === 'function') {
                        closeTaskModal();
                    }

                    // Перезагружаем список задач
                    if (typeof loadTasks === 'function') {
                        await loadTasks();
                    }

                    // Уведомление
                    if (tg?.HapticFeedback) {
                        tg.HapticFeedback.notificationOccurred('success');
                    }
                    alert('Задача успешно создана');
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            }
        } catch (error) {
            console.error('❌ Error creating task:', error);
            alert('Ошибка при создании задачи: ' + error.message);
        } finally {
            isSubmittingTask = false;

            // Сбрасываем блокировку через 2 секунды
            setTimeout(() => {
                isSubmittingTask = false;
            }, 2000);
        }
    };

    // 3. ИСПРАВЛЕНИЕ EVENT DELEGATION ДЛЯ ЗАДАЧ
    // Убеждаемся, что клики по задачам работают
    const tasksList = document.getElementById('tasksList');
    if (tasksList) {
        // Удаляем старые обработчики
        const oldHandler = tasksList.onclick;
        tasksList.onclick = null;

        // Добавляем новый обработчик
        tasksList.addEventListener('click', function(e) {
            // Ищем ближайший элемент с data-task-id
            const taskElement = e.target.closest('[data-task-id]');
            if (taskElement) {
                const taskId = taskElement.getAttribute('data-task-id');
                console.log('🖱️ Task clicked:', taskId);

                // Предотвращаем всплытие если клик был по кнопке действия
                if (e.target.closest('.task-action-btn, .btn-action, button')) {
                    console.log('🔘 Action button clicked, not opening details');
                    return;
                }

                // Открываем детали задачи
                if (typeof window.showTaskDetails === 'function') {
                    window.showTaskDetails(taskId);
                } else if (typeof window.handleTaskClick === 'function') {
                    window.handleTaskClick(taskId);
                } else {
                    console.error('No task detail handler found');
                }
            }
        }, true); // Используем capture phase
    }

    // 4. ИСПРАВЛЕНИЕ ЗАГРУЗКИ ЗАДАЧ
    const originalLoadTasks = window.loadTasks;
    window.loadTasks = async function() {
        console.log('🔧 Enhanced loadTasks called');

        try {
            // Вызываем оригинальную функцию если есть
            if (originalLoadTasks) {
                await originalLoadTasks();
            }

            // Убеждаемся что задачи доступны глобально
            if (!window.currentTasks && window.KaifApp?.tasks) {
                window.currentTasks = window.KaifApp.tasks;
            }

            console.log('✅ Tasks loaded:', window.currentTasks?.length || 0);
        } catch (error) {
            console.error('❌ Error loading tasks:', error);
        }
    };

    // 5. ИСПРАВЛЕНИЕ ОБНОВЛЕНИЯ СТАТУСА ЗАДАЧ
    const originalUpdateTaskStatus = window.updateTaskStatus;
    window.updateTaskStatus = async function(taskId, newStatus) {
        console.log('🔧 Updating task status:', taskId, newStatus);

        try {
            const tg = window.Telegram?.WebApp;
            const response = await fetch(`/api/tasks/${taskId}/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-Init-Data': tg?.initData || ''
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                console.log('✅ Task status updated');

                // Обновляем локальный кэш
                if (window.currentTasks) {
                    const task = window.currentTasks.find(t => String(t.id) === String(taskId));
                    if (task) {
                        task.status = newStatus;
                    }
                }

                // Перезагружаем список задач
                if (typeof loadTasks === 'function') {
                    await loadTasks();
                }

                // Уведомление
                if (tg?.HapticFeedback) {
                    tg.HapticFeedback.impactOccurred('light');
                }
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Error updating task status:', error);
            alert('Ошибка при обновлении статуса задачи');
        }
    };

    console.log('✅ Task fixes applied successfully');
});

// Экспортируем функции для глобального использования
window.TaskFixes = {
    version: '1.0.0',
    initialized: true
};