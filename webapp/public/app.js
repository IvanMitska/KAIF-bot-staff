// ============================================
// PREMIUM SAUNA BOOKING APP
// ============================================

const API_BASE = '/api';
let currentUser = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize Telegram WebApp
    if (window.Telegram?.WebApp) {
      Telegram.WebApp.ready();
      Telegram.WebApp.expand();
      Telegram.WebApp.setHeaderColor('#000000');
      Telegram.WebApp.setBackgroundColor('#000000');
    }

    // Set greeting based on time
    setGreeting();

    // Set current date
    setCurrentDate();

    // Setup navigation
    setupNavigation();

    // Setup form handlers
    setupFormHandlers();

    // Setup filter
    document.getElementById('filter-status').addEventListener('change', () => {
      loadAllBookings();
    });

    // Load profile
    await loadProfile();

    // Load data
    await Promise.all([
      loadTodayBookings(),
      loadStats()
    ]);

    // Hide loading
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('main-content').classList.remove('hidden');

  } catch (error) {
    console.error('Init error:', error);
    document.getElementById('loading').innerHTML = `
      <div class="loading-content">
        <div class="empty-icon">⚠️</div>
        <p class="loading-text">${error.message || 'Ошибка загрузки'}</p>
      </div>
    `;
  }
});

function setGreeting() {
  const hour = new Date().getHours();
  let greeting = 'Добрый день';
  if (hour < 6) greeting = 'Доброй ночи';
  else if (hour < 12) greeting = 'Доброе утро';
  else if (hour >= 18) greeting = 'Добрый вечер';
  document.getElementById('greeting').textContent = greeting;
}

function setCurrentDate() {
  const now = new Date();
  const options = { day: 'numeric', month: 'long' };
  document.getElementById('current-date').textContent = now.toLocaleDateString('ru-RU', options);
}

// ============================================
// API
// ============================================

async function apiCall(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (window.Telegram?.WebApp?.initData) {
    headers['X-Telegram-Init-Data'] = Telegram.WebApp.initData;
  }

  const testMode = new URLSearchParams(window.location.search).get('test') === '1';
  const url = `${API_BASE}${endpoint}${testMode ? (endpoint.includes('?') ? '&' : '?') + 'test=1' : ''}`;

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Ошибка сервера');
  }

  return response.json();
}

// ============================================
// DATA LOADING
// ============================================

async function loadProfile() {
  const data = await apiCall('/profile');
  currentUser = data.user;

  const initial = (currentUser.name || 'U').charAt(0).toUpperCase();
  const firstName = currentUser.name?.split(' ')[0] || currentUser.name;

  // Header
  document.getElementById('user-name-header').textContent = firstName;
  document.getElementById('user-avatar').innerHTML = `<span>${initial}</span>`;

  // Profile page
  document.getElementById('profile-avatar').textContent = initial;
  document.getElementById('profile-name').textContent = currentUser.name;

  const roleNames = {
    'admin': 'Администратор',
    'sales': 'Отдел продаж',
    'bath_attendant': 'Банщик'
  };
  document.getElementById('profile-role').textContent = roleNames[currentUser.role] || currentUser.role;

  // FAB visibility
  const fab = document.getElementById('fab-add');
  if (currentUser.role === 'admin' || currentUser.role === 'sales') {
    fab.style.display = 'flex';
    fab.addEventListener('click', () => openModal());
  } else {
    fab.style.display = 'none';
  }
}

async function loadTodayBookings() {
  try {
    const data = await apiCall('/bookings/today');
    renderBookings(data.bookings, 'today-list', true);
  } catch (error) {
    document.getElementById('today-list').innerHTML = renderEmpty('Ошибка загрузки');
  }
}

async function loadWeekBookings() {
  try {
    const data = await apiCall('/bookings/week');
    renderBookingsWithDates(data.bookings, 'week-list');
  } catch (error) {
    document.getElementById('week-list').innerHTML = renderEmpty('Ошибка загрузки');
  }
}

async function loadAllBookings() {
  try {
    const status = document.getElementById('filter-status').value;
    const params = status ? `?status=${status}` : '';
    const data = await apiCall(`/bookings${params}`);
    renderBookingsWithDates(data.bookings, 'all-list');
  } catch (error) {
    document.getElementById('all-list').innerHTML = renderEmpty('Ошибка загрузки');
  }
}

async function loadStats() {
  try {
    const data = await apiCall('/bookings/stats');
    const stats = data.stats;

    document.getElementById('stat-today').textContent = stats.today_count || 0;
    document.getElementById('stat-new').textContent = stats.new_count || 0;
    document.getElementById('stat-confirmed').textContent = stats.confirmed_count || 0;

    document.getElementById('profile-total').textContent = stats.total_count || 0;
    document.getElementById('profile-completed').textContent = stats.completed_count || 0;
  } catch (error) {
    console.error('Stats error:', error);
  }
}

// ============================================
// RENDERING
// ============================================

function renderEmpty(text = 'Нет записей', showHint = false) {
  return `
    <div class="empty-state">
      <div class="empty-icon">📋</div>
      <p class="empty-title">${text}</p>
      ${showHint ? '<p class="empty-text">Нажмите + чтобы создать</p>' : ''}
    </div>
  `;
}

function renderBookings(bookings, containerId, isToday = false) {
  const container = document.getElementById(containerId);

  if (!bookings?.length) {
    container.innerHTML = renderEmpty(isToday ? 'Нет записей на сегодня' : 'Нет записей', isToday);
    return;
  }

  container.innerHTML = bookings.map(b => createBookingCard(b)).join('');
}

function renderBookingsWithDates(bookings, containerId) {
  const container = document.getElementById(containerId);

  if (!bookings?.length) {
    container.innerHTML = renderEmpty();
    return;
  }

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

  let tags = '';
  if (booking.steam_type) tags += `<span class="booking-tag">${booking.steam_type}</span>`;
  if (booking.duration) tags += `<span class="booking-tag">${booking.duration} мин</span>`;
  if (booking.guests_count > 1) tags += `<span class="booking-tag">${booking.guests_count} гостей</span>`;
  if (booking.price) tags += `<span class="booking-tag">${booking.price} ₽</span>`;

  return `
    <div class="booking-card" onclick="openDetailModal(${booking.id})">
      <div class="booking-row">
        <div>
          <div class="booking-time">${formatTime(booking.booking_time)}</div>
          <div class="booking-date">${formatDate(booking.booking_date)}</div>
        </div>
        <span class="booking-status ${booking.status}">${statusLabels[booking.status]}</span>
      </div>
      <div class="booking-client">${escapeHtml(booking.client_name)}</div>
      <div class="booking-phone">${escapeHtml(booking.client_phone)}</div>
      ${tags ? `<div class="booking-meta">${tags}</div>` : ''}
    </div>
  `;
}

// ============================================
// NAVIGATION
// ============================================

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
  });
}

function showPage(page) {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  document.querySelectorAll('.page').forEach(p => {
    p.classList.toggle('active', p.id === `page-${page}`);
  });

  // Show/hide FAB
  const fab = document.getElementById('fab-add');
  if (fab && currentUser?.role !== 'bath_attendant') {
    fab.style.display = page === 'profile' ? 'none' : 'flex';
  }

  // Load data
  if (page === 'today') { loadTodayBookings(); loadStats(); }
  else if (page === 'week') loadWeekBookings();
  else if (page === 'all') loadAllBookings();
  else if (page === 'profile') loadStats();
}

// ============================================
// MODAL - BOOKING FORM
// ============================================

function openModal(booking = null) {
  const modal = document.getElementById('booking-modal');
  const form = document.getElementById('booking-form');
  const title = document.getElementById('modal-title');

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
    document.getElementById('booking-date').value = new Date().toISOString().split('T')[0];
  }

  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('booking-modal').classList.add('hidden');
}

function setupFormHandlers() {
  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', () => {
      closeModal();
      closeDetailModal();
    });
  });

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
        await apiCall(`/bookings/${bookingId}`, { method: 'PUT', body: JSON.stringify(data) });
        showToast('Запись обновлена');
      } else {
        await apiCall('/bookings', { method: 'POST', body: JSON.stringify(data) });
        showToast('Запись создана');
      }

      closeModal();
      refreshCurrentPage();
      loadStats();
    } catch (error) {
      showToast('Ошибка: ' + error.message);
    }
  });
}

// ============================================
// MODAL - DETAIL
// ============================================

let currentDetailBooking = null;

async function openDetailModal(bookingId) {
  try {
    const data = await apiCall(`/bookings/${bookingId}`);
    currentDetailBooking = data.booking;
    renderDetailModal(currentDetailBooking);
    document.getElementById('detail-modal').classList.remove('hidden');
  } catch (error) {
    showToast('Ошибка загрузки');
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
      <span class="detail-value"><a href="tel:${booking.client_phone}">${escapeHtml(booking.client_phone)}</a></span>
    </div>
  `;

  if (booking.steam_type) {
    html += `<div class="detail-row"><span class="detail-label">Тип парения</span><span class="detail-value">${escapeHtml(booking.steam_type)}</span></div>`;
  }
  if (booking.duration) {
    html += `<div class="detail-row"><span class="detail-label">Длительность</span><span class="detail-value">${booking.duration} мин</span></div>`;
  }
  if (booking.guests_count > 1) {
    html += `<div class="detail-row"><span class="detail-label">Гостей</span><span class="detail-value">${booking.guests_count}</span></div>`;
  }
  if (booking.price) {
    html += `<div class="detail-row"><span class="detail-label">Цена</span><span class="detail-value">${booking.price} ₽</span></div>`;
  }
  if (booking.prepayment) {
    html += `<div class="detail-row"><span class="detail-label">Предоплата</span><span class="detail-value">${booking.prepayment} ₽</span></div>`;
  }
  if (booking.comment) {
    html += `<div class="detail-row"><span class="detail-label">Комментарий</span><span class="detail-value">${escapeHtml(booking.comment)}</span></div>`;
  }

  // Actions
  html += '<div class="detail-actions">';

  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'sales';
  const canChangeStatus = currentUser?.role === 'admin' || currentUser?.role === 'bath_attendant';

  if (booking.status === 'new') {
    if (canChangeStatus) html += '<button class="btn btn-confirm" onclick="changeStatus(\'confirmed\')">Подтвердить</button>';
    if (canEdit) html += '<button class="btn btn-cancel" onclick="changeStatus(\'cancelled\')">Отменить</button>';
  } else if (booking.status === 'confirmed') {
    if (canChangeStatus) html += '<button class="btn btn-start" onclick="changeStatus(\'in_progress\')">Начать</button>';
    if (canEdit) html += '<button class="btn btn-cancel" onclick="changeStatus(\'cancelled\')">Отменить</button>';
  } else if (booking.status === 'in_progress') {
    if (canChangeStatus) html += '<button class="btn btn-complete" onclick="changeStatus(\'completed\')">Завершить</button>';
  }

  if (canEdit && !['completed', 'cancelled'].includes(booking.status)) {
    html += '<button class="btn btn-secondary" onclick="editBooking()">Изменить</button>';
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

    showToast('Статус изменён');
    closeDetailModal();
    refreshCurrentPage();
    loadStats();
  } catch (error) {
    showToast('Ошибка: ' + error.message);
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
    const page = activePage.id.replace('page-', '');
    if (page === 'today') loadTodayBookings();
    else if (page === 'week') loadWeekBookings();
    else if (page === 'all') loadAllBookings();
  }
}

function formatTime(timeStr) {
  return timeStr?.substring(0, 5) || '';
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

  if (date.toDateString() === today.toDateString()) return 'Сегодня';
  if (date.toDateString() === tomorrow.toDateString()) return 'Завтра';

  return date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message) {
  if (window.Telegram?.WebApp) {
    Telegram.WebApp.showAlert(message);
  } else {
    alert(message);
  }
}
