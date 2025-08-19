const express = require('express');
const router = express.Router();
const optimizedNotionService = require('../../src/services/optimizedNotionService');
const { formatPhuketTime, getPhuketDateISO } = require('../../src/utils/timezone');

// Получить статус check-in за сегодня
router.get('/status/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    console.log('Getting attendance status for:', telegramId);
    
    // Используем оптимизированный сервис - мгновенный ответ из кэша
    const attendance = await optimizedNotionService.getTodayAttendance(telegramId);
    
    if (attendance) {
      console.log('Found attendance record:', {
        checkIn: attendance.checkIn,
        checkOut: attendance.checkOut,
        isPresent: attendance.isPresent
      });
      
      res.json({
        success: true,
        hasCheckedIn: true,
        checkInTime: attendance.checkIn ? formatPhuketTime(attendance.checkIn) : null,
        checkOutTime: attendance.checkOut ? formatPhuketTime(attendance.checkOut) : null,
        isPresent: attendance.isPresent,
        workHours: attendance.workHours
      });
    } else {
      console.log('No attendance record found for today');
      res.json({
        success: true,
        hasCheckedIn: false,
        isPresent: false
      });
    }
  } catch (error) {
    console.error('Error getting attendance status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Check In - Пришел на работу
router.post('/checkin', async (req, res) => {
  try {
    const { telegramId, employeeName, location } = req.body;
    console.log('Check-in request:', { telegramId, employeeName, location });
    
    // Проверяем, не был ли уже check-in сегодня (из кэша - мгновенно)
    const existingAttendance = await optimizedNotionService.getTodayAttendance(telegramId);
    
    if (existingAttendance && existingAttendance.checkIn) {
      console.log('Already checked in today');
      return res.json({
        success: false,
        error: 'Вы уже отметили приход сегодня',
        checkInTime: formatPhuketTime(existingAttendance.checkIn)
      });
    }
    
    const now = new Date();
    const todayISO = getPhuketDateISO();
    
    // Создаем запись в оптимизированном сервисе (мгновенно в кэш, потом в Notion)
    const attendance = await optimizedNotionService.createAttendance({
      employeeId: telegramId,
      employeeName: employeeName,
      date: todayISO,
      checkIn: now.toISOString(),
      location: location
    });
    
    const checkInTime = formatPhuketTime(now);
    console.log('Check-in successful:', { 
      id: attendance.id,
      time: checkInTime 
    });
    
    res.json({
      success: true,
      message: `✅ Вы пришли в ${checkInTime}`,
      checkInTime: checkInTime,
      attendanceId: attendance.id
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при отметке прихода: ' + error.message
    });
  }
});

// Check Out - Ушел с работы
router.post('/checkout', async (req, res) => {
  try {
    const { telegramId, location } = req.body;
    console.log('Check-out request:', { telegramId, location });
    
    // Получаем запись за сегодня (из кэша - мгновенно)
    const attendance = await optimizedNotionService.getTodayAttendance(telegramId);
    
    if (!attendance || !attendance.checkIn) {
      console.log('No check-in found for today');
      return res.json({
        success: false,
        error: 'Сначала нужно отметить приход'
      });
    }
    
    if (attendance.checkOut) {
      console.log('Already checked out today');
      return res.json({
        success: false,
        error: 'Вы уже отметили уход сегодня',
        checkOutTime: formatPhuketTime(attendance.checkOut)
      });
    }
    
    const now = new Date();
    const todayISO = getPhuketDateISO();
    
    // Обновляем check-out (мгновенно в кэш, потом в Notion)
    const workHours = await optimizedNotionService.updateAttendanceCheckOut(
      attendance.id,
      now.toISOString(),
      location
    );
    
    const checkOutTime = formatPhuketTime(now);
    console.log('Check-out successful:', {
      time: checkOutTime,
      workHours: workHours
    });
    
    res.json({
      success: true,
      message: `✅ Вы ушли в ${checkOutTime}. Отработано: ${workHours} часов`,
      checkOutTime: checkOutTime,
      workHours: workHours
    });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при отметке ухода: ' + error.message
    });
  }
});

// Получить текущий статус всех сотрудников (для менеджеров)
router.get('/current-status', async (req, res) => {
  try {
    console.log('Getting current attendance status for all employees');
    
    // Для статуса всех сотрудников обращаемся к Notion напрямую
    // так как это редкая операция для менеджеров
    const attendanceStatus = await optimizedNotionService.getCurrentAttendanceStatus();
    
    const present = attendanceStatus.filter(a => a.isPresent);
    const absent = attendanceStatus.filter(a => !a.isPresent);
    
    res.json({
      success: true,
      totalPresent: present.length,
      totalAbsent: absent.length,
      employees: attendanceStatus.map(a => ({
        name: a.employeeName,
        isPresent: a.isPresent,
        checkIn: a.checkIn ? formatPhuketTime(a.checkIn) : null,
        checkOut: a.checkOut ? formatPhuketTime(a.checkOut) : null,
        workHours: a.workHours
      }))
    });
  } catch (error) {
    console.error('Error getting current status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получить статистику за период (для менеджеров)
router.get('/report', async (req, res) => {
  try {
    const { startDate, endDate, employeeId } = req.query;
    console.log('Getting attendance report:', { startDate, endDate, employeeId });
    
    // Для отчетов обращаемся к Notion напрямую
    const attendanceRecords = await optimizedNotionService.getAttendanceForPeriod(
      startDate,
      endDate,
      employeeId
    );
    
    // Подсчитываем статистику
    const stats = {
      totalDays: 0,
      totalHours: 0,
      lateDays: 0,
      records: []
    };
    
    attendanceRecords.forEach(record => {
      if (record.checkIn) {
        stats.totalDays++;
        if (record.workHours) {
          stats.totalHours += record.workHours;
        }
        if (record.late) {
          stats.lateDays++;
        }
      }
      
      stats.records.push({
        date: record.date,
        employeeName: record.employeeName,
        checkIn: record.checkIn ? formatPhuketTime(record.checkIn) : null,
        checkOut: record.checkOut ? formatPhuketTime(record.checkOut) : null,
        workHours: record.workHours,
        late: record.late
      });
    });
    
    stats.averageHours = stats.totalDays > 0 ? 
      (stats.totalHours / stats.totalDays).toFixed(1) : 0;
    
    res.json({
      success: true,
      stats,
      records: stats.records
    });
  } catch (error) {
    console.error('Error getting attendance report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Форсировать синхронизацию (для администраторов)
router.post('/sync', async (req, res) => {
  try {
    console.log('Force sync requested');
    
    await optimizedNotionService.forceSync();
    
    res.json({
      success: true,
      message: 'Синхронизация запущена'
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получить статистику кэша (для администраторов)
router.get('/cache-stats', async (req, res) => {
  try {
    const stats = await optimizedNotionService.getStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;