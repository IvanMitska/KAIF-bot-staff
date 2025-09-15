const xlsx = require('xlsx');
const path = require('path');
require('dotenv').config();

// Подключаем сервисы
const railwayService = require('./src/services/railwayOptimizedService');
const userService = require('./src/services/userService');

// Маппинг имен сотрудников на их Telegram ID
const userMapping = {
  // Основные пользователи из базы
  'Иван': '1734337242',
  'Ivan': '1734337242',
  'Борис': '385436658',
  'Boris': '385436658',
  'Ксения': '1151085087',
  'Егор': '1151085087',  // Ксения в базе, но возможно это Егор
  'Egor': '1151085087',
  'Елена': '726915228',  // В базе как Елена, возможно Михаил
  'Михаил': '726915228',
  'Mikhail': '726915228',
  'Mihail': '726915228',
  'Аля': '642664990',
  'Алексей': '642664990',  // Аля в базе, возможно Алексей
  'Alexey': '642664990',
  'Alexei': '642664990',
  'Дмитрий': '5937587032',
  'Dmitry': '5937587032',
  'Максим': '303267717',
  'Maxim': '303267717',
  'Яков': '893020643',
  'Yakov': '893020643',
  
  // Составные назначения (назначаем на первого или более опытного)
  'Михаил + Всеволод': '726915228', // Назначаем на Елену/Михаила
  'Максим + Дмитрий': '303267717', // Назначаем на Максима
  'Егор + Новый Маркетолог': '1151085087', // Назначаем на Ксению/Егора
  'Егор + Федор': '1151085087', // Назначаем на Ксению/Егора
  'Федор + Михаил': '726915228', // Назначаем на Елену/Михаила
  'Юрист': '385436658', // Назначаем на Бориса как администратора
  
  // Неизвестные сотрудники - назначаем на Бориса для последующего распределения
  'Андрей': '385436658',  // Назначаем на Бориса
  'Николай': '385436658', // Назначаем на Бориса
  'Всеволод': '385436658', // Назначаем на Бориса
  'Федор': '385436658' // Назначаем на Бориса
};

// Функция для поиска Telegram ID по имени
function findTelegramId(name) {
  if (!name) return null;
  
  const normalizedName = name.trim();
  
  // Прямое совпадение
  if (userMapping[normalizedName]) {
    return userMapping[normalizedName];
  }
  
  // Поиск по частичному совпадению
  for (const [key, value] of Object.entries(userMapping)) {
    if (normalizedName.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(normalizedName.toLowerCase())) {
      return value;
    }
  }
  
  console.log(`⚠️ Не найден Telegram ID для сотрудника: ${name}`);
  return null;
}

// Функция для парсинга даты из Excel
function parseExcelDate(excelDate) {
  if (!excelDate) return null;
  
  // Если это число (Excel serial date)
  if (typeof excelDate === 'number') {
    // Excel считает дни с 1 января 1900
    const excelEpoch = new Date(1900, 0, 1);
    const days = excelDate - 2; // Excel считает 1900 год високосным (ошибка)
    const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }
  
  // Если это строка
  if (typeof excelDate === 'string') {
    // Пробуем разные форматы
    const formats = [
      /(\d{2})\.(\d{2})\.(\d{4})/, // DD.MM.YYYY
      /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
      /(\d{4})-(\d{2})-(\d{2})/,   // YYYY-MM-DD
    ];
    
    for (const format of formats) {
      const match = excelDate.match(format);
      if (match) {
        if (format === formats[0] || format === formats[1]) {
          // DD.MM.YYYY или DD/MM/YYYY
          return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        } else {
          // YYYY-MM-DD
          return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        }
      }
    }
  }
  
  // Если это уже Date объект
  if (excelDate instanceof Date) {
    return excelDate.toISOString().split('T')[0];
  }
  
  console.log(`⚠️ Не удалось распарсить дату: ${excelDate}`);
  return new Date().toISOString().split('T')[0]; // Возвращаем сегодняшнюю дату как fallback
}

async function importTasks() {
  try {
    console.log('🚀 Начинаем импорт задач из Excel...\n');
    
    // Инициализация сервисов
    await railwayService.initialize();
    console.log('✅ Сервисы инициализированы\n');
    
    // Читаем Excel файл
    const filePath = '/Users/ivan/Downloads/Задачи_KAIF.xlsx';
    const workbook = xlsx.readFile(filePath);
    
    // Получаем первый лист
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Конвертируем в JSON
    const tasks = xlsx.utils.sheet_to_json(worksheet);
    
    console.log(`📊 Найдено ${tasks.length} задач в файле\n`);
    
    // Счетчики для статистики
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    // Получаем существующие задачи для проверки дубликатов
    const existingTasks = await railwayService.getAllTasks();
    console.log(`📋 В базе уже есть ${existingTasks.length} задач\n`);
    
    // Обрабатываем каждую задачу
    for (const task of tasks) {
      try {
        // Извлекаем данные из строки Excel (используем правильные названия колонок)
        const title = task['Задача'];
        const assigneeName = task['Ответственный'];
        const deadline = task['сроки'];
        const description = task['Описание'] || '';
        const department = task['Подразделение'] || '';
        const priority = task['Приоритет'] || 'Средний';
        
        // Добавляем подразделение к описанию если есть
        const fullDescription = department ? `${description}\n\nПодразделение: ${department}` : description;
        
        if (!title || !assigneeName) {
          console.log(`⏭️ Пропускаем строку - нет названия или исполнителя`);
          skipped++;
          continue;
        }
        
        // Находим Telegram ID сотрудника
        const telegramId = findTelegramId(assigneeName);
        
        if (!telegramId) {
          console.log(`⏭️ Пропускаем задачу "${title}" - не найден Telegram ID для ${assigneeName}`);
          skipped++;
          continue;
        }
        
        // Получаем данные пользователя
        const user = await userService.getUserByTelegramId(telegramId);
        
        if (!user) {
          console.log(`⏭️ Пропускаем задачу "${title}" - пользователь ${assigneeName} не найден в системе`);
          skipped++;
          continue;
        }
        
        // Проверяем на дубликат
        const duplicate = existingTasks.find(t => 
          t.title === title && 
          t.assigneeId === telegramId
        );
        
        if (duplicate) {
          console.log(`⏭️ Пропускаем дубликат: "${title}" для ${assigneeName}`);
          skipped++;
          continue;
        }
        
        // Подготавливаем данные для создания задачи
        const taskData = {
          title: title,
          description: fullDescription || '',
          assigneeId: telegramId,
          assigneeName: user.name,
          creatorId: '385436658', // Boris как создатель по умолчанию
          creatorName: 'Борис',
          priority: priority,
          deadline: parseExcelDate(deadline),
          status: 'Новая'
        };
        
        // Создаем задачу
        console.log(`📝 Создаю задачу: "${title}" для ${user.name} (срок: ${taskData.deadline})`);
        await railwayService.createTask(taskData);
        
        imported++;
        console.log(`✅ Задача создана успешно\n`);
        
        // Небольшая задержка чтобы не перегружать API
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Ошибка при обработке задачи:`, error.message);
        errors++;
      }
    }
    
    // Итоговая статистика
    console.log('\n' + '='.repeat(50));
    console.log('📊 ИТОГИ ИМПОРТА:');
    console.log('='.repeat(50));
    console.log(`✅ Успешно импортировано: ${imported} задач`);
    console.log(`⏭️ Пропущено: ${skipped} задач`);
    console.log(`❌ Ошибок: ${errors}`);
    console.log(`📋 Всего обработано: ${tasks.length} строк`);
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ Критическая ошибка при импорте:', error);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

// Запускаем импорт
importTasks();