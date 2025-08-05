// Утилиты для работы с временной зоной Пхукета (UTC+7)

/**
 * Получить текущее время в часовом поясе Пхукета
 * @returns {Date} - Дата с учетом смещения для Пхукета
 */
function getPhuketTime() {
  const now = new Date();
  // Пхукет UTC+7, получаем смещение от UTC
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  // Добавляем 7 часов для Пхукета
  const phuketTime = new Date(utcTime + (7 * 60 * 60 * 1000));
  return phuketTime;
}

/**
 * Форматировать время для отображения
 * @param {Date|string} date - Дата для форматирования
 * @returns {string} - Отформатированное время HH:MM
 */
function formatPhuketTime(date) {
  const dateObj = date instanceof Date ? date : new Date(date);
  // Конвертируем в время Пхукета
  const utcTime = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
  const phuketTime = new Date(utcTime + (7 * 60 * 60 * 1000));
  
  const hours = phuketTime.getHours().toString().padStart(2, '0');
  const minutes = phuketTime.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Проверить, опоздал ли сотрудник (после 9:00 по времени Пхукета)
 * @returns {boolean} - true если опоздал
 */
function isLateForWork() {
  const phuketTime = getPhuketTime();
  return phuketTime.getHours() >= 9;
}

/**
 * Получить текущую дату в формате ISO для Пхукета
 * @returns {string} - Дата в формате YYYY-MM-DD
 */
function getPhuketDateISO() {
  const phuketTime = getPhuketTime();
  return phuketTime.toISOString().split('T')[0];
}

module.exports = {
  getPhuketTime,
  formatPhuketTime,
  isLateForWork,
  getPhuketDateISO
};