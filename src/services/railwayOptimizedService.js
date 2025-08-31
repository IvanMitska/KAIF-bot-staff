// Используем SQLite вместо PostgreSQL для локальной разработки
const sqliteService = require('./optimizedSQLiteService');

// Прокси класс - перенаправляет все вызовы в SQLite сервис
// Это позволяет не менять код во всех обработчиках
class RailwayOptimizedService {
  async initialize() {
    return await sqliteService.initialize();
  }

  // ========== USER METHODS ==========
  async createUser(userData) {
    return await sqliteService.createUser(userData);
  }

  async getUserByTelegramId(telegramId) {
    return await sqliteService.getUserByTelegramId(telegramId);
  }

  async getAllActiveUsers() {
    return await sqliteService.getAllActiveUsers();
  }

  async getUser(telegramId) {
    return await sqliteService.getUser(telegramId);
  }

  async getUsers() {
    return await sqliteService.getUsers();
  }

  // ========== REPORT METHODS ==========
  async createReport(reportData) {
    return await sqliteService.createReport(reportData);
  }

  async getTodayReport(telegramId) {
    return await sqliteService.getTodayReport(telegramId);
  }

  async getUserReports(telegramId, limit = 5) {
    return await sqliteService.getUserReports(telegramId, limit);
  }

  async getReportsForPeriod(startDate, endDate, employeeId = null) {
    return await sqliteService.getReportsForPeriod(startDate, endDate, employeeId);
  }

  // ========== ATTENDANCE METHODS ==========
  async createAttendance(attendanceData) {
    return await sqliteService.createAttendance(attendanceData);
  }

  async getTodayAttendance(employeeId) {
    return await sqliteService.getTodayAttendance(employeeId);
  }

  async updateAttendanceCheckOut(attendanceId, checkOut, location = null) {
    return await sqliteService.updateAttendanceCheckOut(attendanceId, checkOut, location);
  }

  async getCurrentAttendanceStatus() {
    return await sqliteService.getCurrentAttendanceStatus();
  }

  async getAttendanceForPeriod(startDate, endDate, employeeId = null) {
    return await sqliteService.getAttendanceForPeriod(startDate, endDate, employeeId);
  }

  // ========== TASK METHODS ==========
  async createTask(taskData) {
    return await sqliteService.createTask(taskData);
  }

  async getTasksByAssignee(telegramId, status = null) {
    return await sqliteService.getTasksByAssignee(telegramId, status);
  }

  async getTasksByCreator(telegramId) {
    return await sqliteService.getTasksByCreator(telegramId);
  }

  async updateTaskStatus(taskId, status) {
    return await sqliteService.updateTaskStatus(taskId, status);
  }

  async completeTask(taskId, completionNote) {
    return await sqliteService.completeTask(taskId, completionNote);
  }

  async updateTask(taskId, updates) {
    return await sqliteService.updateTask(taskId, updates);
  }

  async addPhotoToTask(taskId, photoUrl, caption = '') {
    return await sqliteService.addPhotoToTask(taskId, photoUrl, caption);
  }

  // Методы для отладки
  async debugGetAllTasks() {
    return await sqliteService.debugGetAllTasks();
  }

  async testTasksDatabase() {
    return await sqliteService.testTasksDatabase();
  }

  async getAllTasks(statusFilter = null) {
    return await sqliteService.getAllTasks(statusFilter);
  }

  // ========== STATS ==========
  async getStats() {
    return await sqliteService.getStats();
  }

  async forceSync() {
    return await sqliteService.forceSync();
  }
}

// Создаем singleton
const railwayService = new RailwayOptimizedService();

module.exports = railwayService;