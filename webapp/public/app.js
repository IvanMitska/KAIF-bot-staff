// ============================================
// SAUNA BOOKING APP - MAIN JS
// ============================================

const API_BASE = '/api';
let currentUser = null;
let bookings = [];

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize Telegram WebApp
    if (window.Telegram?.WebApp) {
      Telegram.WebApp.ready();
      Telegram.WebApp.expand();
      Telegram.WebApp.setHeaderColor('#0D0D0D');
      Telegram.WebApp.setBackgroundColor('#0D0D0D');
    }

    // Set current date in header
    setCurrentDate();

    // Setup navigation
    setupNavigation();

    // Setup form handlers
    setupFormHandlers();

    // Setup filter handler
    document.getElementById('filter-status').addEventListener('change', () => {
      loadAllBookings();
    });

    // Load user profile
    await loadProfile();

    // Load initial data
    await Promise.all([
      loadTodayBookings(),
      loadStats()
    ]);

    // Hide loading, show content
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('main-content').classList.remove('hidden');

  } catch (error) {
    console.error('Init error:', error);
    document.getElementById('loading').innerHTML = `
      <div class="empty-icon">⚠️</div>
      <p>Ошибка загрузки</p>
      <span class="empty-hint">${error.message}</span>
    `;
  }
});

function setCurrentDate() {
  const now = new Date();
  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  const dateStr = now.toLocaleDateString('ru-RU', options);
  document.getElementById('current-date').textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
}

// ============================================
// API CALLS
// ============================================

async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  // Add Telegram init data
  if (window.Telegram?.WebApp?.initData) {
    headers['X-Telegram-Init-Data'] = Telegram.WebApp.initData;
  }

  // Test mode
  const testMode = new URLSearchParams(window.location.search).get('test') === '1';
  const finalUrl = testMode ? `${url}${url.includes('?') ? '&' : '?'}test=1` : url;

  const response = await fetch(finalUrl, {
    ...options,
    headers
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'API Error');
  }

  return response.json();
}

// ============================================
// DATA LOADING
// ============================================

async function loadProfile() {
  try {
    const data = await apiCall('/profile');
    currentUser = data.user;

    const initial = (currentUser.name || 'U').charAt(0).toUpperCase();

    // Update header avatar
    document.getElementById('user-avatar').textContent = initial;

    // Update profile page
    document.getElementById('profile-avatar').textContent = initial;
    document.getElementById('profile-name').textContent = currentUser.name;

    const roleNames = {
      'admin': 'Администратор',
      'sales': 'Отдел продаж',
      'bath_attendant': 'Банщик'
    };
    document.getElementById('profile-role').textContent = roleNames[currentUser.role] || currentUser.role;

    // Show/hide add button based on role
    const addBtn = document.getElementById('add-booking-btn');
    if (currentUser.role === 'admin' || currentUser.role === 'sales') {
      addBtn.style.display = 'flex';
      addBtn.addEventListener('click', () => openModal());
    } else {
      addBtn.style.display = 'none';
    }

  } catch (error) {
    console.error('Load profile error:', error);
    throw error;
  }
}

async function loadTodayBookings() {
  try {
    const data = await apiCall('/bookings/today');
    renderBookings(data.bookings, 'today-list', true);
  } catch (error) {
    console.error('Load today error:', error);
    document.getElementById('today-list').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>Ошибка загрузки</p>
      </div>
    `;
  }
}

async function loadWeekBookings() {
  try {
    const data = await apiCall('/bookings/week');
    renderBookingsWithDates(data.bookings, 'week-list');
  } catch (error) {
    console.error('Load week error:', error);
    document.getElementById('week-list').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>Ошибка загрузки</p>
      </div>
    `;
  }
}

async function loadAllBookings() {
  try {
    const status = document.getElementById('filter-status').value;
    const params = status ? `?status=${status}` : '';
    const data = await apiCall(`/bookings${params}`);
    renderBookingsWithDates(data.bookings, 'all-list');
  } catch (error) {
    console.error('Load all error:', error);
    document.getElementById('all-list').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>Ошибка загрузки</p>
      </div>
    `;
  }
}

async function loadStats() {
  try {
    const data = await apiCall('/bookings/stats');
    const stats = data.stats;

    document.getElementById('stat-today').textContent = stats.today_count || 0;
    document.getElementById('stat-new').textContent = stats.new_count || 0;
    document.getElementById('stat-confirmed').textContent = stats.confirmed_count || 0;

    // Profile stats
    document.getElementById('profile-total').textContent = stats.total_count || 0;
    document.getElementById('profile-completed').textContent = stats.completed_count || 0;
  } catch (error) {
    console.error('Load stats error:', error);
  }
}

// ============================================
// RENDERING
// ============================================

function renderBookings(bookings, containerId, isToday = false) {
  const container = document.getElementById(containerId);

  if (!bookings || bookings.length === 0) {
    const emptyIcon = isToday ? '📋' : '📝';
    const emptyText = isToday ? 'Нет записей на сегодня' : 'Нет записей';
    const hint = isToday ? '<span class="empty-hint">Нажмите + чтобы создать</span>' : '';
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${emptyIcon}</div>
        <p>${emptyText}</p>
        ${hint}
      </div>
    `;
    return;
  }

  container.innerHTML = bookings.map(b => createBookingCard(b)).join('');
}

function renderBookingsWithDates(bookings, containerId) {
  const container = document.getElementById(containerId);

  if (!bookings || bookings.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <p>Нет записей</p>
      </div>
    `;
    return;
  }

  // Group by date
  const grouped = {};
  bookings.forEach(b => {
    const date = b.booking_date.split('T')[0];
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(b);
  });

  let html = '';
  Object.keys(grouped).sort().forEach(date => {
    html += `<div class="date-separator">${formatDateLong(date)}</div>`;
    html += grouped[date].map(b => createBookingCard(b)).join('');
  });

  container.innerHTML = html;
}

function createBookingCard(booking) {
  const statusLabels = {
    'new': 'Новая',
    'confirmed': 'Подтв.',
    'in_progress': 'В работе',
    'completed': 'Готово',
    'cancelled': 'Отмена'
  };

  let metaHtml = '';
  if (booking.steam_type) {
    metaHtml += `<span class="booking-meta-item">🧖 ${escapeHtml(booking.steam_type)}</span>`;
  }
  if (booking.duration) {
    metaHtml += `<span class="booking-meta-item">⏱ ${booking.duration} мин</span>`;
  }
  if (booking.guests_count > 1) {
    metaHtml += `<span class="booking-meta-item">👥 ${booking.guests_count}</span>`;
  }
  if (booking.price) {
    metaHtml += `<span class="booking-meta-item">💰 ${booking.price}₽</span>`;
  }

  return `
    <div class="booking-card" onclick="openDetailModal(${booking.id})">
      <div class="booking-top">
        <div class="booking-time-block">
          <span class="booking-time">${formatTime(booking.booking_time)}</span>
          <span class="booking-date">${formatDate(booking.booking_date)}</span>
        </div>
        <span class="booking-status ${booking.status}">${statusLabels[booking.status] || booking.status}</span>
      </div>
      <div class="booking-client">${escapeHtml(booking.client_name)}</div>
      <div class="booking-phone">${escapeHtml(booking.client_phone)}</div>
      ${metaHtml ? `<div class="booking-meta">${metaHtml}</div>` : ''}
    </div>
  `;
}

// ============================================
// NAVIGATION
// ============================================

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      showPage(page);
    });
  });
}

function showPage(pageName) {
  // Update nav items
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageName);
  });

  // Update pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.toggle('active', page.id === `page-${pageName}`);
  });

  // Load data for the page
  if (pageName === 'today') {
    loadTodayBookings();
    loadStats();
  } else if (pageName === 'week') {
    loadWeekBookings();
  } else if (pageName === 'all') {
    loadAllBookings();
  } else if (pageName === 'profile') {
    loadStats();
  }
}

// ============================================
// MODAL - BOOKING FORM
// ============================================

function openModal(booking = null) {
  const modal = document.getElementById('booking-modal');
  const form = document.getElementById('booking-form');
  const title = document.getElementById('modal-title');

  // Reset form
  form.reset();
  document.getElementById('booking-id').value = '';

  if (booking) {
    title.textContent = 'Редактировать';
    document.getElementById('booking-id').value = booking.id;
    document.getElementById('booking-date').value = booking.booking_date.split('T')[0];
    document.getElementById('booking-time').value = booking.booking_time;
    document.getElementById('client-name').value = booking.client_name;
    document.getElementById('client-phone').value = booking.client_phone;
    document.getElementById('steam-type').value = booking.steam_type || '';
    document.getElementById('duration').value = booking.duration || 60;
    document.getElementById('guests-count').value = booking.guests_count || 1;
    document.getElementById('price').value = booking.price || '';
    document.getElementById('prepayment').value = booking.prepayment || 0;
    document.getElementById('comment').value = booking.comment || '';
  } else {
    title.textContent = 'Новая запись';
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('booking-date').value = today;
  }

  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('booking-modal').classList.add('hidden');
}

function setupFormHandlers() {
  document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const bookingId = document.getElementById('booking-id').value;
    const data = {
      booking_date: document.getElementById('booking-date').value,
      booking_time: document.getElementById('booking-time').value,
      client_name: document.getElementById('client-name').value,
      client_phone: document.getElementById('client-phone').value,
      steam_type: document.getElementById('steam-type').value || null,
      duration: parseInt(document.getElementById('duration').value) || 60,
      guests_count: parseInt(document.getElementById('guests-count').value) || 1,
      price: parseFloat(document.getElementById('price').value) || null,
      prepayment: parseFloat(document.getElementById('prepayment').value) || 0,
      comment: document.getElementById('comment').value || null
    };

    try {
      if (bookingId) {
        await apiCall(`/bookings/${bookingId}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
        showSuccess('Запись обновлена');
      } else {
        await apiCall('/bookings', {
          method: 'POST',
          body: JSON.stringify(data)
        });
        showSuccess('Запись создана');
      }

      closeModal();
      refreshCurrentPage();
      loadStats();

    } catch (error) {
      console.error('Save error:', error);
      showError('Ошибка: ' + error.message);
    }
  });
}

// ============================================
// MODAL - BOOKING DETAIL
// ============================================

let currentDetailBooking = null;

async function openDetailModal(bookingId) {
  try {
    const data = await apiCall(`/bookings/${bookingId}`);
    currentDetailBooking = data.booking;

    renderDetailModal(currentDetailBooking);
    document.getElementById('detail-modal').classList.remove('hidden');

  } catch (error) {
    console.error('Load booking error:', error);
    showError('Ошибка загрузки');
  }
}

function closeDetailModal() {
  document.getElementById('detail-modal').classList.add('hidden');
  currentDetailBooking = null;
}

function renderDetailModal(booking) {
  const statusLabels = {
    'new': 'Новая',
    'confirmed': 'Подтверждена',
    'in_progress': 'В процессе',
    'completed': 'Завершена',
    'cancelled': 'Отменена'
  };

  let html = `
    <div class="detail-row">
      <span class="detail-label">Статус</span>
      <span class="booking-status ${booking.status}">${statusLabels[booking.status]}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Дата</span>
      <span class="detail-value">${formatDateLong(booking.booking_date)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Время</span>
      <span class="detail-value">${formatTime(booking.booking_time)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Клиент</span>
      <span class="detail-value">${escapeHtml(booking.client_name)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Телефон</span>
      <span class="detail-value"><a href="tel:${booking.client_phone}" style="color: var(--primary)">${escapeHtml(booking.client_phone)}</a></span>
    </div>
  `;

  if (booking.steam_type) {
    html += `
      <div class="detail-row">
        <span class="detail-label">Тип парения</span>
        <span class="detail-value">${escapeHtml(booking.steam_type)}</span>
      </div>
    `;
  }

  if (booking.duration) {
    html += `
      <div class="detail-row">
        <span class="detail-label">Длительность</span>
        <span class="detail-value">${booking.duration} мин</span>
      </div>
    `;
  }

  if (booking.guests_count > 1) {
    html += `
      <div class="detail-row">
        <span class="detail-label">Гостей</span>
        <span class="detail-value">${booking.guests_count}</span>
      </div>
    `;
  }

  if (booking.price) {
    html += `
      <div class="detail-row">
        <span class="detail-label">Цена</span>
        <span class="detail-value">${booking.price} ₽</span>
      </div>
    `;
  }

  if (booking.prepayment) {
    html += `
      <div class="detail-row">
        <span class="detail-label">Предоплата</span>
        <span class="detail-value">${booking.prepayment} ₽</span>
      </div>
    `;
  }

  if (booking.comment) {
    html += `
      <div class="detail-row">
        <span class="detail-label">Комментарий</span>
        <span class="detail-value">${escapeHtml(booking.comment)}</span>
      </div>
    `;
  }

  // Action buttons based on status and user role
  html += '<div class="detail-actions">';

  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'sales');
  const canChangeStatus = currentUser && (currentUser.role === 'admin' || currentUser.role === 'bath_attendant');

  if (booking.status === 'new') {
    if (canChangeStatus) {
      html += '<button class="btn-status confirm" onclick="changeStatus(\'confirmed\')">Подтвердить</button>';
    }
    if (canEdit) {
      html += '<button class="btn-status cancel" onclick="changeStatus(\'cancelled\')">Отменить</button>';
    }
  } else if (booking.status === 'confirmed') {
    if (canChangeStatus) {
      html += '<button class="btn-status start" onclick="changeStatus(\'in_progress\')">Начать</button>';
    }
    if (canEdit) {
      html += '<button class="btn-status cancel" onclick="changeStatus(\'cancelled\')">Отменить</button>';
    }
  } else if (booking.status === 'in_progress') {
    if (canChangeStatus) {
      html += '<button class="btn-status complete" onclick="changeStatus(\'completed\')">Завершить</button>';
    }
  }

  if (canEdit && booking.status !== 'completed' && booking.status !== 'cancelled') {
    html += `<button class="btn-secondary" onclick="editBooking()">Изменить</button>`;
  }

  html += '</div>';

  document.getElementById('detail-content').innerHTML = html;
}

async function changeStatus(newStatus) {
  if (!currentDetailBooking) return;

  try {
    await apiCall(`/bookings/${currentDetailBooking.id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });

    showSuccess('Статус изменён');
    closeDetailModal();
    refreshCurrentPage();
    loadStats();

  } catch (error) {
    console.error('Status change error:', error);
    showError('Ошибка: ' + error.message);
  }
}

function editBooking() {
  if (!currentDetailBooking) return;
  closeDetailModal();
  openModal(currentDetailBooking);
}

// ============================================
// UTILITIES
// ============================================

function refreshCurrentPage() {
  const activePage = document.querySelector('.page.active');
  if (activePage) {
    const pageName = activePage.id.replace('page-', '');
    if (pageName === 'today') loadTodayBookings();
    else if (pageName === 'week') loadWeekBookings();
    else if (pageName === 'all') loadAllBookings();
  }
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  return timeStr.substring(0, 5);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function formatDateLong(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Сегодня';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Завтра';
  }

  return date.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long'
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showSuccess(message) {
  if (window.Telegram?.WebApp) {
    Telegram.WebApp.showAlert(message);
  } else {
    alert(message);
  }
}

function showError(message) {
  if (window.Telegram?.WebApp) {
    Telegram.WebApp.showAlert(message);
  } else {
    alert(message);
  }
}
