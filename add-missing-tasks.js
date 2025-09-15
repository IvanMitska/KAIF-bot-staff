require('dotenv').config();
const railwayService = require('./src/services/railwayOptimizedService');
const userService = require('./src/services/userService');

// Задачи для добавления/исправления
const missingTasks = [
  {
    title: "Генеральная уборка",
    description: "Провести полную уборку всех зон комплекса\n\nПодразделение: Уборка / Управление",
    assigneeId: '1151085087', // Назначаем на Ксению как менеджера комплекса
    assigneeName: 'Ксения',
    deadline: '2025-09-15',
    priority: 'Высокий'
  },
  // Исправляем задачи с составными исполнителями
  {
    title: "Бочки с водой для обливных (Максим)",
    description: "Установить бочки, насос, чиллер и фундамент\n\nПодразделение: Баня / Тех.отдел\nСовместно с Борисом",
    assigneeId: '303267717', // Максим
    assigneeName: 'Максим',
    deadline: '2025-09-21',
    priority: 'Средний'
  },
  {
    title: "Убрать строительный мусор (Максим)",
    description: "Полная очистка территории от остатков стройки\n\nПодразделение: Уборка / Тех.служба\nСовместно с Борисом",
    assigneeId: '303267717', // Максим
    assigneeName: 'Максим',
    deadline: '2025-09-23',
    priority: 'Высокий'
  },
  {
    title: "Убрать недельный абонемент (Ксения)",
    description: "Изъять недельный абонемент из продажи\n\nПодразделение: Продажи / CRM / IT\nСовместно с Борисом",
    assigneeId: '1151085087', // Ксения
    assigneeName: 'Ксения',
    deadline: '2025-09-24',
    priority: 'Средний'
  },
  {
    title: "Парения в хамаме (Юрист)",
    description: "Добавить парения в приватном хамаме со скидкой\n\nПодразделение: Баня / Продажи\nОтветственные: Ксения + Юрист",
    assigneeId: '385436658', // Борис как юрист
    assigneeName: 'Борис',
    deadline: '2025-09-12',
    priority: 'Средний'
  },
  {
    title: "Реклама парений на столах (Юрист)",
    description: "Разместить рекламу парений на столах в бане\n\nПодразделение: Маркетинг / Баня\nОтветственные: Ксения + Юрист",
    assigneeId: '385436658', // Борис как юрист
    assigneeName: 'Борис',
    deadline: '2025-09-13',
    priority: 'Средний'
  },
  {
    title: "Акции для европейцев (Ксения)",
    description: "Разработать промо (1+1 и др.) для иностранцев\n\nПодразделение: Маркетинг / Продажи\nСовместно с Борисом",
    assigneeId: '1151085087', // Ксения
    assigneeName: 'Ксения',
    deadline: '2025-09-16',
    priority: 'Высокий'
  },
  {
    title: "Навести порядок на складе (Дмитрий)",
    description: "Провести расчистку, сортировку и инвентаризацию склада\n\nПодразделение: Хоз.отдел / Управление\nОтветственные: Ксения + Дмитрий + Борис",
    assigneeId: '5937587032', // Дмитрий
    assigneeName: 'Дмитрий',
    deadline: '2025-09-16',
    priority: 'Средний'
  },
  {
    title: "Настроить шкафчики и браслеты (Максим)",
    description: "Привязать браслеты к шкафчикам, протестировать\n\nПодразделение: IT / Технический отдел\nСовместно с Иваном",
    assigneeId: '303267717', // Максим
    assigneeName: 'Максим',
    deadline: '2025-09-12',
    priority: 'Высокий'
  }
];

async function addMissingTasks() {
  try {
    console.log('🚀 Добавляем недостающие и дополнительные задачи...\n');
    
    await railwayService.initialize();
    
    let added = 0;
    let skipped = 0;
    
    // Получаем существующие задачи
    const existingTasks = await railwayService.getAllTasks();
    
    for (const task of missingTasks) {
      // Проверяем на дубликат
      const duplicate = existingTasks.find(t => 
        t.title === task.title && 
        t.assigneeId === task.assigneeId
      );
      
      if (duplicate) {
        console.log(`⏭️ Пропускаем дубликат: "${task.title}"`);
        skipped++;
        continue;
      }
      
      // Проверяем пользователя
      const user = await userService.getUserByTelegramId(task.assigneeId);
      if (!user) {
        console.log(`❌ Пользователь не найден: ${task.assigneeName} (${task.assigneeId})`);
        skipped++;
        continue;
      }
      
      // Создаем задачу
      const taskData = {
        title: task.title,
        description: task.description,
        assigneeId: task.assigneeId,
        assigneeName: user.name,
        creatorId: '385436658', // Boris
        creatorName: 'Борис',
        priority: task.priority,
        deadline: task.deadline,
        status: 'Новая'
      };
      
      console.log(`📝 Создаю задачу: "${task.title}" для ${user.name}`);
      await railwayService.createTask(taskData);
      added++;
      console.log(`✅ Задача создана\n`);
      
      // Небольшая задержка
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`✅ Добавлено: ${added} задач`);
    console.log(`⏭️ Пропущено: ${skipped} задач`);
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    process.exit(0);
  }
}

addMissingTasks();