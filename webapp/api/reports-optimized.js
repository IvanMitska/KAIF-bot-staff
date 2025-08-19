const express = require('express');
const router = express.Router();
const optimizedNotionService = require('../../src/services/optimizedNotionService');

// Отправить отчет
router.post('/submit', async (req, res) => {
  try {
    const { telegramId, employeeName, whatDone, problems, goals } = req.body;
    
    console.log('Report submission from:', employeeName);
    
    // Проверяем, не отправлен ли уже отчет сегодня (из кэша - мгновенно)
    const existingReport = await optimizedNotionService.getTodayReport(telegramId);
    
    if (existingReport) {
      return res.json({
        success: false,
        error: 'Вы уже отправили отчет сегодня'
      });
    }
    
    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];
    
    // Создаем отчет (мгновенно в кэш, потом синхронизируется с Notion)
    const report = await optimizedNotionService.createReport({
      employeeName,
      telegramId,
      whatDone,
      problems: problems || '',
      goals: goals || '',
      date: todayISO,
      timestamp: today.toISOString(),
      status: 'Отправлен'
    });
    
    console.log('Report saved successfully:', report.id);
    
    res.json({
      success: true,
      message: '✅ Отчет успешно отправлен',
      reportId: report.id
    });
  } catch (error) {
    console.error('Report submission error:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при отправке отчета: ' + error.message
    });
  }
});

// Получить отчет за сегодня
router.get('/today/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    
    // Получаем из кэша - мгновенно
    const report = await optimizedNotionService.getTodayReport(telegramId);
    
    if (report) {
      res.json({
        success: true,
        hasReport: true,
        report: {
          whatDone: report.what_done || report.whatDone,
          problems: report.problems,
          goals: report.goals,
          status: report.status,
          timestamp: report.timestamp
        }
      });
    } else {
      res.json({
        success: true,
        hasReport: false
      });
    }
  } catch (error) {
    console.error('Error getting today report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получить историю отчетов
router.get('/history/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const limit = parseInt(req.query.limit) || 7;
    
    // Получаем из кэша - мгновенно
    const reports = await optimizedNotionService.getUserReports(telegramId, limit);
    
    res.json({
      success: true,
      reports: reports.map(report => ({
        date: report.date,
        whatDone: report.whatDone,
        problems: report.problems,
        goals: report.goals,
        status: report.status
      }))
    });
  } catch (error) {
    console.error('Error getting report history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получить отчеты за период (для менеджеров)
router.get('/period', async (req, res) => {
  try {
    const { startDate, endDate, employeeId } = req.query;
    
    console.log('Getting reports for period:', { startDate, endDate, employeeId });
    
    // Для периодических отчетов обращаемся к Notion
    // так как это аналитическая функция для менеджеров
    const reports = await optimizedNotionService.getReportsForPeriod(
      startDate,
      endDate,
      employeeId
    );
    
    res.json({
      success: true,
      count: reports.length,
      reports: reports.map(report => ({
        date: report.date,
        employeeName: report.employeeName,
        whatDone: report.whatDone,
        problems: report.problems,
        goals: report.goals,
        status: report.status
      }))
    });
  } catch (error) {
    console.error('Error getting period reports:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получить статистику отчетов
router.get('/stats', async (req, res) => {
  try {
    const { employeeId } = req.query;
    
    // Получаем отчеты за последние 30 дней
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const startDateISO = startDate.toISOString().split('T')[0];
    
    const reports = await optimizedNotionService.getReportsForPeriod(
      startDateISO,
      endDate,
      employeeId
    );
    
    // Подсчитываем статистику
    const stats = {
      totalReports: reports.length,
      lastReportDate: reports.length > 0 ? reports[0].date : null,
      averageLength: 0,
      problemsCount: 0,
      completionRate: 0
    };
    
    if (reports.length > 0) {
      let totalLength = 0;
      reports.forEach(report => {
        totalLength += (report.whatDone || '').length;
        if (report.problems && report.problems.trim()) {
          stats.problemsCount++;
        }
      });
      stats.averageLength = Math.round(totalLength / reports.length);
      stats.completionRate = Math.round((reports.length / 30) * 100);
    }
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting report stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;