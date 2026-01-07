require('dotenv').config();

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');

const bookingService = require('./src/services/bookingService');
const userService = require('./src/services/userService');
const db = require('./src/services/databasePool');

// ============================================
// CONFIGURATION
// ============================================

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || `http://localhost:${PORT}/webapp`;

const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').filter(Boolean);
const SALES_IDS = (process.env.SALES_IDS || '').split(',').filter(Boolean);
const BATH_ATTENDANT_IDS = (process.env.BATH_ATTENDANT_IDS || '').split(',').filter(Boolean);
const ALLOWED_IDS = [...new Set([...ADMIN_IDS, ...SALES_IDS, ...BATH_ATTENDANT_IDS])];

// ============================================
// BOT INITIALIZATION
// ============================================

// Disable polling for local development (bot runs on Railway)
const DISABLE_BOT = process.env.DISABLE_BOT === 'true';
const bot = DISABLE_BOT ? null : new TelegramBot(BOT_TOKEN, { polling: true });

// ============================================
// EXPRESS SERVER
// ============================================

const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Static files
app.use('/webapp', express.static(path.join(__dirname, 'webapp', 'public')));

// Redirect /webapp/public to /webapp (fix for incorrect URL)
app.get('/webapp/public', (req, res) => res.redirect('/webapp'));
app.get('/webapp/public/*', (req, res) => {
  const newPath = req.path.replace('/webapp/public', '/webapp');
  res.redirect(newPath);
});

// ============================================
// TELEGRAM AUTH MIDDLEWARE
// ============================================

function validateTelegramWebAppData(initData) {
  if (!initData) return null;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) {
      return null;
    }

    const userStr = params.get('user');
    if (userStr) {
      return JSON.parse(userStr);
    }
    return null;
  } catch (error) {
    console.error('Telegram auth error:', error);
    return null;
  }
}

async function authMiddleware(req, res, next) {
  const initData = req.headers['x-telegram-init-data'];

  // Test mode
  if (process.env.NODE_ENV === 'development' && req.query.test === '1') {
    req.user = {
      telegram_id: ADMIN_IDS[0] || '1734337242',
      name: 'Test Admin',
      role: 'admin'
    };
    return next();
  }

  const telegramUser = validateTelegramWebAppData(initData);
  if (!telegramUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user is allowed
  const telegramId = String(telegramUser.id);
  if (ALLOWED_IDS.length > 0 && !ALLOWED_IDS.includes(telegramId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Get user from database
  let user = await userService.getUserByTelegramId(telegramId);

  if (!user) {
    // Determine role
    let role = 'sales';
    if (ADMIN_IDS.includes(telegramId)) role = 'admin';
    else if (BATH_ATTENDANT_IDS.includes(telegramId)) role = 'bath_attendant';

    // Create user
    user = await userService.createUser({
      telegram_id: telegramId,
      name: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') || 'User',
      username: telegramUser.username,
      role
    });
  }

  req.user = user;
  req.telegramUser = telegramUser;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
}

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Profile
app.get('/api/profile', authMiddleware, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// ============================================
// BOOKINGS API
// ============================================

// Get bookings list
app.get('/api/bookings', authMiddleware, async (req, res) => {
  try {
    const { date, status, limit, offset } = req.query;
    const bookings = await bookingService.getBookings({
      date,
      status,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    });
    res.json({ success: true, bookings });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to get bookings' });
  }
});

// Get today's bookings
app.get('/api/bookings/today', authMiddleware, async (req, res) => {
  try {
    const bookings = await bookingService.getTodayBookings();
    res.json({ success: true, bookings });
  } catch (error) {
    console.error('Get today bookings error:', error);
    res.status(500).json({ error: 'Failed to get bookings' });
  }
});

// Get week bookings
app.get('/api/bookings/week', authMiddleware, async (req, res) => {
  try {
    const bookings = await bookingService.getWeekBookings();
    res.json({ success: true, bookings });
  } catch (error) {
    console.error('Get week bookings error:', error);
    res.status(500).json({ error: 'Failed to get bookings' });
  }
});

// Get booking stats
app.get('/api/bookings/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await bookingService.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Get single booking
app.get('/api/bookings/:id', authMiddleware, async (req, res) => {
  try {
    const booking = await bookingService.getBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json({ success: true, booking });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Failed to get booking' });
  }
});

// Create booking
app.post('/api/bookings', authMiddleware, requireRole('admin', 'sales'), async (req, res) => {
  try {
    const bookingData = {
      ...req.body,
      created_by: req.user.telegram_id
    };

    const booking = await bookingService.createBooking(bookingData);

    // Send notification to bath attendants
    await sendBookingNotification(booking, 'new');

    res.json({ success: true, booking });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Update booking
app.put('/api/bookings/:id', authMiddleware, requireRole('admin', 'sales'), async (req, res) => {
  try {
    const booking = await bookingService.updateBooking(req.params.id, req.body);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json({ success: true, booking });
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// Update booking status
app.put('/api/bookings/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await bookingService.updateBookingStatus(req.params.id, status);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Notify about status change
    await sendBookingNotification(booking, 'status_changed');

    res.json({ success: true, booking });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Delete booking (admin only)
app.delete('/api/bookings/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const booking = await bookingService.deleteBooking(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json({ success: true, message: 'Booking deleted' });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// ============================================
// USERS API (admin only)
// ============================================

app.get('/api/users', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json({ success: true, users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

app.post('/api/users', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const user = await userService.createUser(req.body);
    res.json({ success: true, user });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/users/:telegramId', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const user = await userService.updateUser(req.params.telegramId, req.body);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ============================================
// NOTIFICATIONS
// ============================================

async function sendBookingNotification(booking, type) {
  try {
    const bathAttendants = await userService.getBathAttendants();

    if (bathAttendants.length === 0 && BATH_ATTENDANT_IDS.length > 0) {
      // Use IDs from env if no users in DB
      for (const id of BATH_ATTENDANT_IDS) {
        await sendNotificationToUser(id, booking, type);
      }
    } else {
      for (const attendant of bathAttendants) {
        await sendNotificationToUser(attendant.telegram_id, booking, type);
      }
    }
  } catch (error) {
    console.error('Send notification error:', error);
  }
}

async function sendNotificationToUser(telegramId, booking, type) {
  const statusEmoji = {
    'new': '🆕',
    'confirmed': '✅',
    'in_progress': '🔄',
    'completed': '✨',
    'cancelled': '❌'
  };

  const statusText = {
    'new': 'Новая',
    'confirmed': 'Подтверждена',
    'in_progress': 'В процессе',
    'completed': 'Завершена',
    'cancelled': 'Отменена'
  };

  let message = '';

  if (type === 'new') {
    message = `🆕 *Новая запись на парение!*\n\n`;
  } else if (type === 'status_changed') {
    message = `${statusEmoji[booking.status]} *Статус изменён*\n\n`;
  }

  message += `📅 *Дата:* ${formatDate(booking.booking_date)}\n`;
  message += `🕐 *Время:* ${booking.booking_time}\n`;
  message += `👤 *Клиент:* ${booking.client_name}\n`;
  message += `📱 *Телефон:* ${booking.client_phone}\n`;

  if (booking.steam_type) {
    message += `🧖 *Тип:* ${booking.steam_type}\n`;
  }
  if (booking.duration) {
    message += `⏱ *Длительность:* ${booking.duration} мин\n`;
  }
  if (booking.guests_count > 1) {
    message += `👥 *Гостей:* ${booking.guests_count}\n`;
  }
  if (booking.price) {
    message += `💰 *Цена:* ${booking.price} ฿\n`;
  }
  if (booking.prepayment > 0) {
    message += `💳 *Предоплата:* ${booking.prepayment} ฿\n`;
  }
  if (booking.comment) {
    message += `💬 *Комментарий:* ${booking.comment}\n`;
  }

  message += `\n📊 *Статус:* ${statusText[booking.status] || booking.status}`;

  const keyboard = {
    inline_keyboard: []
  };

  // Add status change buttons
  if (booking.status === 'new') {
    keyboard.inline_keyboard.push([
      { text: '✅ Подтвердить', callback_data: `confirm_${booking.id}` },
      { text: '❌ Отклонить', callback_data: `cancel_${booking.id}` }
    ]);
  } else if (booking.status === 'confirmed') {
    keyboard.inline_keyboard.push([
      { text: '🔄 Начать', callback_data: `start_${booking.id}` }
    ]);
  } else if (booking.status === 'in_progress') {
    keyboard.inline_keyboard.push([
      { text: '✨ Завершить', callback_data: `complete_${booking.id}` }
    ]);
  }

  if (!bot) return; // Bot disabled for local dev

  try {
    await bot.sendMessage(telegramId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
    console.error(`Failed to send notification to ${telegramId}:`, error.message);
  }
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// ============================================
// BOT HANDLERS
// ============================================

if (bot) {
// /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);

  // Check access
  if (ALLOWED_IDS.length > 0 && !ALLOWED_IDS.includes(telegramId)) {
    return bot.sendMessage(chatId, '⛔ Доступ запрещён. Обратитесь к администратору.');
  }

  // Get or create user
  let user = await userService.getUserByTelegramId(telegramId);

  if (!user) {
    let role = 'sales';
    if (ADMIN_IDS.includes(telegramId)) role = 'admin';
    else if (BATH_ATTENDANT_IDS.includes(telegramId)) role = 'bath_attendant';

    user = await userService.createUser({
      telegram_id: telegramId,
      name: [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || 'User',
      username: msg.from.username,
      role
    });
  }

  const roleNames = {
    'admin': 'Администратор',
    'sales': 'Отдел продаж',
    'bath_attendant': 'Банщик'
  };

  const welcomeMessage = `🧖 *Добро пожаловать в систему записи на парение!*\n\n` +
    `👤 *${user.name}*\n` +
    `📋 Роль: ${roleNames[user.role] || user.role}\n\n` +
    `Нажмите кнопку ниже, чтобы открыть приложение.`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '📱 Открыть приложение', web_app: { url: WEBAPP_URL } }]
    ]
  };

  bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
});

// Callback handlers for status changes
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    let newStatus = null;
    let bookingId = null;

    if (data.startsWith('confirm_')) {
      bookingId = data.replace('confirm_', '');
      newStatus = 'confirmed';
    } else if (data.startsWith('cancel_')) {
      bookingId = data.replace('cancel_', '');
      newStatus = 'cancelled';
    } else if (data.startsWith('start_')) {
      bookingId = data.replace('start_', '');
      newStatus = 'in_progress';
    } else if (data.startsWith('complete_')) {
      bookingId = data.replace('complete_', '');
      newStatus = 'completed';
    }

    if (newStatus && bookingId) {
      const booking = await bookingService.updateBookingStatus(bookingId, newStatus);

      if (booking) {
        const statusText = {
          'confirmed': 'подтверждена ✅',
          'cancelled': 'отменена ❌',
          'in_progress': 'начата 🔄',
          'completed': 'завершена ✨'
        };

        await bot.answerCallbackQuery(query.id, {
          text: `Запись ${statusText[newStatus]}`,
          show_alert: false
        });

        // Update message
        await sendNotificationToUser(chatId, booking, 'status_changed');

        // Delete old message
        try {
          await bot.deleteMessage(chatId, query.message.message_id);
        } catch (e) {
          // Ignore delete errors
        }
      }
    }
  } catch (error) {
    console.error('Callback error:', error);
    await bot.answerCallbackQuery(query.id, {
      text: 'Ошибка обработки',
      show_alert: true
    });
  }
});
} // end if (bot)

// ============================================
// START SERVER
// ============================================

async function startServer() {
  try {
    // Initialize database
    await db.initialize();
    console.log('✅ Database connected');

    // Start Express server
    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`📱 WebApp URL: ${WEBAPP_URL}`);
      console.log(`🤖 Bot: ${bot ? 'polling...' : 'DISABLED (DISABLE_BOT=true)'}`);
      console.log(`\n👥 Allowed users: ${ALLOWED_IDS.length || 'all'}`);
      console.log(`   Admins: ${ADMIN_IDS.join(', ') || 'none'}`);
      console.log(`   Sales: ${SALES_IDS.join(', ') || 'none'}`);
      console.log(`   Bath attendants: ${BATH_ATTENDANT_IDS.join(', ') || 'none'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
