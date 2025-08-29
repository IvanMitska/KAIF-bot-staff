#!/usr/bin/env node

/**
 * Финальный скрипт импорта - точное следование таблице
 */

require('dotenv').config();

// Используем оптимизированный сервис или обычный
let notionService;
try {
    notionService = require('./src/services/optimizedNotionService');
    console.log('Using optimized Notion service');
} catch (error) {
    notionService = require('./src/services/notionService');
    console.log('Using regular Notion service');
}

// Маппинг имен из таблицы на Telegram ID
const USER_MAPPING = {
    'Ксения': '1151085087',
    'Борис': '385436658',
    'Иван': '1734337242',
    'Игорь': '321654987',
    'Максим': '303267717',
    'Дмитрий': '5937587032',
    'Аля': '642664990',
    'Елена': '726915228',
};

// Все задачи из таблицы - точно как есть
const TASKS = [
    // МАРКЕТИНГ
    {
        title: "Реклама ресторана Блюда/Атмосфера/Акции",
        details: "Креативы, таргет, локальная аудитория",
        deadline: "1-2 недели",
        assignee: "Ксения",
        priority: "Высокий",
        category: "Маркетинг"
    },
    {
        title: "Фото террасы для банкетов",
        details: "Организовать фотосессию, использовать в соцсетях",
        deadline: "1 неделя",
        assignee: "Ксения",
        priority: "Средний",
        category: "Маркетинг"
    },
    {
        title: "Чайные церемонии от Панда Ти",
        details: "Сценарий, график, продвижение",
        deadline: "2 недели",
        assignee: "Борис",
        priority: "Средний",
        category: "Маркетинг"
    },
    {
        title: "Инста фотозона",
        details: "Концепция, закупка, монтаж",
        deadline: "2 недели",
        assignee: "Ксения",
        priority: "Средний",
        category: "Маркетинг"
    },
    {
        title: "Истории про групповые парения",
        details: "Фото/видео контент, сторис-шаблоны",
        deadline: "Постоянно, старт сразу",
        assignee: "Ксения",
        priority: "Высокий",
        category: "Маркетинг"
    },
    {
        title: "Единый формат афиш оффлайн / олайн",
        details: "Создать шаблон (цвета, логотип)",
        deadline: "1 неделя",
        assignee: "Ксения", // Ксения + Аля -> основной Ксения
        priority: "Высокий",
        category: "Маркетинг"
    },
    {
        title: "Северное сияние в снежной",
        details: "Подсветка с эффектом, монтаж",
        deadline: "3-4 недели",
        assignee: "Максим", // Максим + Борис -> основной Максим
        priority: "Средний",
        category: "Маркетинг"
    },
    {
        title: "Сандей бранч",
        details: "Составить меню, запустить промо. Планируемый запуск сентябрь",
        deadline: "2 недели",
        assignee: "Борис", // Борис + Ксения -> основной Борис
        priority: "Средний",
        category: "Маркетинг"
    },
    {
        title: "Приведи клиента (друга)",
        details: "Реферальная система, фиксация в CRM. Придумать и внедрить",
        deadline: "1 неделя",
        assignee: "Борис", // Борис + Ксения -> основной Борис
        priority: "Средний",
        category: "Маркетинг"
    },
    {
        title: "Анкетирование ресепшн - Откуда о нас узнали",
        details: "Опросник, интеграция с CRM. Работа с данными для отслеживания источника трафика",
        deadline: "1 неделя",
        assignee: "Иван",
        priority: "Высокий",
        category: "Маркетинг"
    },
    
    // БАР / РЕСТОРАН
    {
        title: "Поднять цены на бар на 10-15%",
        details: "Проверка себестоимости, обновление меню",
        deadline: "3-5 дней",
        assignee: "Игорь", // Игорь + Борис -> основной Игорь
        priority: "Высокий",
        category: "Бар / ресторан"
    },
    {
        title: "Чайная карта (Panda Tea)",
        details: "Подбор сортов, дизайн, обучение, продажи",
        deadline: "2 недели",
        assignee: "Борис", // Борис + Игорь -> основной Борис
        priority: "Высокий",
        category: "Бар / ресторан"
    },
    {
        title: "Меню массажа для террасы. Оборудование мест под массаж на террассе",
        details: "Краткая карта услуг, распечатки",
        deadline: "1 неделя",
        assignee: "Ксения",
        priority: "Высокий",
        category: "Бар / ресторан"
    },
    {
        title: "Папки для счетов",
        details: "Заказать стильные папки с логотипом",
        deadline: "2 недели",
        assignee: "Борис",
        priority: "Средний",
        category: "Бар / ресторан"
    },
    {
        title: "Табличка «Приятного аппетита» и не кормить для Юнкера",
        details: "Макет и печать",
        deadline: "3 дня",
        assignee: "Борис",
        priority: "Низкий",
        category: "Бар / ресторан"
    },
    {
        title: "QR на чаевые для пармастеров",
        details: "Таблички с QR для мастеров",
        deadline: "1 неделя",
        assignee: "Борис",
        priority: "Низкий",
        category: "Бар / ресторан"
    },
    {
        title: "Новые цены на вход с учетом браслетов",
        details: "Обновить прайс в CRM, соцсетях",
        deadline: "3 дня",
        assignee: "Борис", // Борис + Ксения -> основной Борис
        priority: "Средний",
        category: "Бар / ресторан"
    },
    {
        title: "Цены аренды баня/2 этаж",
        details: "Подготовить тарифы, согласовать",
        deadline: "1 неделя",
        assignee: "Борис", // Борис + Ксения -> основной Борис
        priority: "Высокий",
        category: "Бар / ресторан"
    },
    {
        title: "Витрина с инвентарем. Заказ мерча",
        details: "Закупить товар, оформить витрину",
        deadline: "3-4 недели",
        assignee: "Борис", // Борис + Ксения + Аля + Елена -> основной Борис
        priority: "Средний",
        category: "Бар / ресторан"
    },
    {
        title: "Брендированный пергамент",
        details: "Найти поставщика, заказать",
        deadline: "2 недели",
        assignee: "Дмитрий",
        priority: "Высокий",
        category: "Бар / ресторан"
    },
    {
        title: "Мангал на втором этаже + зона для работы",
        details: "Организовать зону мангала на террасе. Оборудование, крыша, коммуникации",
        deadline: "2 недели",
        assignee: "Дмитрий", // Дмитрий + Максим -> основной Дмитрий
        priority: "Высокий",
        category: "Бар / ресторан"
    },
    
    // ОПЕРАЦИОНКА
    {
        title: "Новая CRM система для фитнеса",
        details: "Внедрить новую систему чек ин чек аут для абонементов. Карточка клиента. Групповые. Аналог мобифитнес но без фин части",
        deadline: "2 недели",
        assignee: "Иван", // Иван + Борис -> основной Иван
        priority: "Высокий",
        category: "Операционка"
    },
    {
        title: "Беспроводные принтеры. На второй этаж. Предчеки. Чеки",
        details: "Купить и настроить",
        deadline: "1 неделя",
        assignee: "Борис", // Борис + Иван + Дмитрий -> основной Борис
        priority: "Высокий",
        category: "Операционка"
    },
    {
        title: "Эквайринг машинки. Беспроводная оплата вне ресепшен",
        details: "Заказать у банка",
        deadline: "2 недели",
        assignee: "Борис",
        priority: "Высокий",
        category: "Операционка"
    },
    {
        title: "Отдел заботы КАЙФ. Куары на бота в тг и ватсап для моментальной обратной связи от гостей",
        details: "Определить функции, назначить ответственных",
        deadline: "3 недели",
        assignee: "Иван", // Иван + Борис + Ксения + Аля + Елена -> основной Иван
        priority: "Высокий",
        category: "Операционка"
    },
    {
        title: "Пест контроль. Проверить контракт. Переподписать контракт на обработку",
        details: "Контракт с сервисом",
        deadline: "1 неделя",
        assignee: "Борис",
        priority: "Средний",
        category: "Операционка"
    },
    {
        title: "Тест на наркотики для линейного персонала",
        details: "Найти клинику, ввести проверки",
        deadline: "2 недели",
        assignee: "Борис",
        priority: "Средний",
        category: "Операционка"
    },
    {
        title: "Анализ крови для линейного персонала",
        details: "Найти клинику, регулярные проверки",
        deadline: "2 недели",
        assignee: "Борис",
        priority: "Средний",
        category: "Операционка"
    },
    {
        title: "Оцифровка трафика. Необходимо оцифровать весь входящий трафик для удобного анализа",
        details: "Таблицы / CRM для гостей",
        deadline: "2 недели",
        assignee: "Иван",
        priority: "Высокий",
        category: "Операционка"
    },
    {
        title: "Финансовый бот для отчетов по выручке",
        details: "Автосбор данных по выручке и посещениям. Настройка смарт бота от айко под наши задачи. Выручка в день/неделю. Успеваемость официантов. Кол-во гостей в день/неделя. Выручка по категориям",
        deadline: "3 недели",
        assignee: "Иван", // Иван + Борис -> основной Иван
        priority: "Высокий",
        category: "Операционка"
    },
    {
        title: "Финансовый порядок. Основная проблема это разрозненные не запланированные закупки",
        details: "Ввести регламент закупок",
        deadline: "1 неделя",
        assignee: "Борис",
        priority: "Высокий",
        category: "Операционка"
    },
    {
        title: "Внедрить систему отчетов о задачах на ежедневной/еженедельной основе",
        details: "Формат встречи с админ составом ежедневно. 1 на 1. Отчет по задачам. Общие вопросы. Нужен регламент и фиксация каждой встречи",
        deadline: "1 неделя",
        assignee: "Борис",
        priority: "Высокий",
        category: "Операционка"
    },
    {
        title: "Правила работы в КАЙФ. Регламенты для линейного персонала",
        details: "Составить, распечатать",
        deadline: "3 недели",
        assignee: "Борис", // Борис + Ксения -> основной Борис
        priority: "Средний",
        category: "Операционка"
    },
    
    // ПЕРСОНАЛ
    {
        title: "Мятный пар. Ввести новый вид арома парений",
        details: "Закупить, внедрить в стандарт",
        deadline: "1 неделя",
        assignee: "Ксения",
        priority: "Средний",
        category: "Персонал"
    },
    {
        title: "Лед в купель перед каждой групповой сессией",
        details: "Организовать закидку льда перед каждой пар сессией",
        deadline: "3 дня",
        assignee: "Ксения",
        priority: "Средний",
        category: "Персонал"
    },
    {
        title: "Табличка «Уважаемые родители». Про ответственность за детей в комплексе",
        details: "Макет, печать",
        deadline: "1 неделя",
        assignee: "Ксения",
        priority: "Высокий",
        category: "Персонал"
    },
    {
        title: "Регламенты подразделений для администрации",
        details: "Подробные регламенты для всех менеджеров",
        deadline: "4 недели",
        assignee: "Борис",
        priority: "Высокий",
        category: "Персонал"
    },
    {
        title: "Распечатки официантам",
        details: "Меню. Бар. Стандарты. Базовая инфа по услугам. Разбито по категориям услуг. Нештатные ситуации. Действия при сложных ситуациях. Оказание первой помощи",
        deadline: "2 недели",
        assignee: "Ксения",
        priority: "Высокий",
        category: "Персонал"
    },
    
    // СТРОЙКА / РЕМОНТ
    {
        title: "Жим + кардио. Инвенторизация / Доукомплектовка / Перестановка",
        details: "Доукомплектовать тренажерку",
        deadline: "2 недели",
        assignee: "Аля",
        priority: "Средний",
        category: "Стройка / ремонт"
    },
    {
        title: "Смета на ремонт. Герметизация второго этажа / Заделка потолка в зале",
        details: "Подготовить расчет",
        deadline: "1 неделя",
        assignee: "Борис", // Борис + Максим -> основной Борис
        priority: "Высокий",
        category: "Стройка / ремонт"
    },
    {
        title: "Потолок + герметизация + косметика",
        details: "Ночные работы без закрытия зала",
        deadline: "3-4 недели",
        assignee: "Максим",
        priority: "Средний",
        category: "Стройка / ремонт"
    },
    {
        title: "Вывеска на въезде. Добавить слот под фото. Добавить стрелку указатель",
        details: "Новый дизайн + щит сверху",
        deadline: "3 недели",
        assignee: "Борис",
        priority: "Средний",
        category: "Стройка / ремонт"
    },
    
    // ЮРИДИЧЕСКИЕ / ПАРТНЁРСКИЕ
    {
        title: "Контракт без work permit для тренеров и пар мастеров",
        details: "Консультация юристов",
        deadline: "2 недели",
        assignee: "Борис",
        priority: "Низкий",
        category: "Юридические / партнёрские"
    },
    {
        title: "Цветы в комплекс. Озеленение комплекса возможно за рекламу",
        details: "Договориться с флористами",
        deadline: "2 недели",
        assignee: "Борис", // Борис + Ксения -> основной Борис
        priority: "Средний",
        category: "Юридические / партнёрские"
    },
    {
        title: "Партнёрские офферы (Shark, недвижимость, Padel Bay)",
        details: "Составить и презентовать",
        deadline: "3 недели",
        assignee: "Борис",
        priority: "Средний",
        category: "Юридические / партнёрские"
    }
];

/**
 * Преобразует срок в дату
 */
function calculateDeadline(deadline) {
    const today = new Date();
    
    // "3 дня" или "3-5 дней"
    if (deadline.includes('дн')) {
        const matches = deadline.match(/\d+/g);
        const days = matches ? Math.max(...matches.map(n => parseInt(n))) : 3;
        today.setDate(today.getDate() + days);
        return today.toISOString().split('T')[0];
    }
    
    // "1 неделя" или "3-4 недели"
    if (deadline.includes('недел')) {
        const matches = deadline.match(/\d+/g);
        const weeks = matches ? Math.max(...matches.map(n => parseInt(n))) : 1;
        today.setDate(today.getDate() + (weeks * 7));
        return today.toISOString().split('T')[0];
    }
    
    // "Постоянно, старт сразу"
    if (deadline.toLowerCase().includes('постоянно') || deadline.toLowerCase().includes('сразу')) {
        today.setDate(today.getDate() + 3); // Срочная задача - через 3 дня
        return today.toISOString().split('T')[0];
    }
    
    // По умолчанию - через неделю
    today.setDate(today.getDate() + 7);
    return today.toISOString().split('T')[0];
}

/**
 * Основная функция импорта
 */
async function importTasks() {
    console.log('🚀 Импорт задач из таблицы');
    console.log(`📋 Всего задач для импорта: ${TASKS.length}`);
    console.log('=' .repeat(50));
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < TASKS.length; i++) {
        const task = TASKS[i];
        
        try {
            const telegramId = USER_MAPPING[task.assignee];
            
            if (!telegramId) {
                console.log(`⚠️ Задача ${i + 1}: не найден ID для ${task.assignee}`);
                errorCount++;
                continue;
            }
            
            const taskData = {
                title: task.title,
                description: task.details ? `📋 ${task.details}\n\n📁 Категория: ${task.category}` : `📁 Категория: ${task.category}`,
                assigneeId: telegramId,
                assigneeName: task.assignee,
                creatorId: 'import_script',
                creatorName: 'Импорт из таблицы август',
                status: 'Новая',
                priority: task.priority,
                deadline: calculateDeadline(task.deadline)
            };
            
            console.log(`\n📝 Задача ${i + 1}/${TASKS.length}:`);
            console.log(`   "${task.title}"`);
            console.log(`   Исполнитель: ${task.assignee}`);
            console.log(`   Срок: ${task.deadline} → ${taskData.deadline}`);
            
            await notionService.createTask(taskData);
            successCount++;
            console.log(`   ✅ Создана`);
            
            // Небольшая задержка
            await new Promise(resolve => setTimeout(resolve, 200));
            
        } catch (error) {
            console.log(`   ❌ Ошибка: ${error.message}`);
            errorCount++;
        }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 ИТОГИ:');
    console.log(`✅ Успешно создано: ${successCount} задач`);
    console.log(`❌ Ошибок: ${errorCount}`);
}

// Запуск
importTasks().catch(console.error);