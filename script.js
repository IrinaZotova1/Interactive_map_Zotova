'use strict';

/* ===== ДАННЫЕ ===== */
const PERFORMANCES = [
  { id: 'p1', title: 'Жизель', date: '07 ноября', time: '19:00', type: 'Балет' },
  { id: 'p2', title: 'Спартак', date: '12 ноября', time: '19:00', type: 'Балет' },
  { id: 'p3', title: 'Евгений Онегин', date: '15 ноября', time: '18:00', type: 'Опера' },
  { id: 'p4', title: 'Дон Кихот', date: '22 ноября', time: '19:00', type: 'Балет' }
];

/* ===== ГЕНЕРАЦИЯ СХЕМЫ ЗАЛА ===== */
const SEATS = [];

// 1. Партер (Центр, начинается с 10 мест и расширяется до 28)
const PARTERRE_ROWS = 10;
for (let r = 1; r <= PARTERRE_ROWS; r++) {
  let seatsInRow = 10 + ((r - 1) * 2); 
  if (seatsInRow > 28) seatsInRow = 28;
  
  let price = 8000 - ((r - 1) * 300); // 8000 -> 5300
  
  for (let s = 1; s <= seatsInRow; s++) {
    SEATS.push({ id: `par-r${r}-s${s}`, row: r, seat: s, sector: 'Партер', category: 'premium', price: price });
  }
}

// 2. Амфитеатр (Сразу за партером, фиксированная ширина)
const AMFI_ROWS = 5;
for (let r = 1; r <= AMFI_ROWS; r++) {
  let seatsInRow = 28;
  let price = 4000 - ((r - 1) * 300); // 4000 -> 2800
  let globalRow = r + PARTERRE_ROWS; 
  
  for (let s = 1; s <= seatsInRow; s++) {
    SEATS.push({ id: `amf-r${r}-s${s}`, row: globalRow, seat: s, sector: 'Амфитеатр', category: 'standard', price: price });
  }
}

// 3. Балкон (Самый верх)
const BALCONY_ROWS = 3;
for (let r = 1; r <= BALCONY_ROWS; r++) {
  let seatsInRow = 28;
  let price = 2000 - ((r - 1) * 200); // 2000 -> 1600
  let globalRow = r + PARTERRE_ROWS + AMFI_ROWS;
  
  for (let s = 1; s <= seatsInRow; s++) {
    SEATS.push({ id: `bal-r${r}-s${s}`, row: globalRow, seat: s, sector: 'Балкон', category: 'economy', price: price });
  }
}

// Занятые места (генерируются случайно для каждого спектакля при загрузке)
const OCCUPIED = {};
PERFORMANCES.forEach(perf => {
  OCCUPIED[perf.id] = SEATS
    .filter(() => Math.random() < 0.25) 
    .map(s => s.id);
});

/* ===== СОСТОЯНИЕ ===== */
let state = {
  activePerfId: 'p1',
  selectedSeats: [], 
  bookings: [],
  filter: { min: 1500, max: 8000 }
};

const STORAGE_KEY = 'grand_aurora_v3';
let seatToCancelId = null;

/* ===== УТИЛИТЫ ===== */
const $ = (sel) => document.querySelector(sel);
const formatMoney = (val) => val.toLocaleString('ru-RU') + ' ₽';

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      bookings: state.bookings,
      activePerfId: state.activePerfId
    }));
  } catch (e) {}
}

function loadFromStorage() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data) {
      if (Array.isArray(data.bookings)) state.bookings = data.bookings;
      if (PERFORMANCES.some(p => p.id === data.activePerfId)) {
        state.activePerfId = data.activePerfId;
      }
    }
  } catch (e) {}
}

function getOccupiedSeats() {
  const baseOccupied = OCCUPIED[state.activePerfId] || [];
  const bookedSeats = state.bookings
    .filter(b => b.perfId === state.activePerfId)
    .flatMap(b => b.seatIds);
  return new Set([...baseOccupied, ...bookedSeats]);
}

function showSuccess(text) {
  $('#success-text').textContent = text;
  $('#modal-success').classList.add('active');
}

/* ===== РЕНДЕР ===== */
function renderAfisha() {
  const grid = $('#performance-grid');
  grid.innerHTML = PERFORMANCES.map(p => `
    <div class="perf-card ${p.id === state.activePerfId ? 'is-active' : ''}" data-id="${p.id}">
      <div class="perf-date-badge">${p.date} • ${p.time}</div>
      <div class="perf-title">${p.title}</div>
      <div class="perf-meta-text">${p.type}</div>
      <div class="perf-price-hint">Билеты от <span>${formatMoney(1600)}</span></div>
    </div>
  `).join('');

  grid.querySelectorAll('.perf-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      if (id === state.activePerfId) return;
      state.activePerfId = id;
      state.selectedSeats = [];
      saveToStorage();
      renderAll();
    });
  });
}

function createSeatElement(seatData, occupiedSet) {
  const isOccupied = occupiedSet.has(seatData.id);
  const isSelected = state.selectedSeats.includes(seatData.id);
  const { min, max } = state.filter;
  const inPriceRange = seatData.price >= min && seatData.price <= max;
  const isHidden = !inPriceRange && !isSelected && !isOccupied;

  const btn = document.createElement('button');
  btn.className = `seat cat-${seatData.category}`;
  if (isOccupied) btn.classList.add('is-occupied');
  if (isSelected) btn.classList.add('is-selected');
  if (isHidden) btn.classList.add('is-hidden');
  
  if (!isOccupied && !isHidden) {
    const tooltip = document.createElement('div');
    tooltip.className = 'seat-tooltip';
    tooltip.textContent = `${seatData.price.toLocaleString('ru-RU')} ₽`;
    btn.appendChild(tooltip);
    btn.addEventListener('click', () => toggleSeat(seatData.id));
  }
  return btn;
}

function renderHall() {
  const hall = $('#hall');
  
  hall.innerHTML = `
    <div class="stage-curve">Сцена</div>
    <div class="hall-content" id="hall-content">
      <div class="sector" id="sector-parterre"><div class="sector-title">Партер</div></div>
      <div class="sector" id="sector-amfi"><div class="sector-title">Амфитеатр</div></div>
      <div class="sector" id="sector-balcony"><div class="sector-title">Балкон</div></div>
    </div>
  `;

  const occupiedSet = getOccupiedSeats();

  // 1. Рендер Партера
  const parterreDiv = $('#sector-parterre');
  for (let r = 1; r <= PARTERRE_ROWS; r++) {
    const rowWrapper = document.createElement('div'); rowWrapper.className = 'row-wrapper';
    const label = document.createElement('div'); label.className = 'row-label'; label.textContent = r;
    const seatsContainer = document.createElement('div'); seatsContainer.className = 'seats-container';
    
    const rowSeats = SEATS.filter(x => x.sector === 'Партер' && x.row === r);
    const half = Math.floor(rowSeats.length / 2);

    rowSeats.forEach((seat, idx) => {
      if (idx === half) {
        const aisle = document.createElement('div'); aisle.className = 'aisle-center';
        seatsContainer.appendChild(aisle);
      }
      seatsContainer.appendChild(createSeatElement(seat, occupiedSet));
    });

    rowWrapper.appendChild(label);
    rowWrapper.appendChild(seatsContainer);
    parterreDiv.appendChild(rowWrapper);
  }

  // 2. Рендер Амфитеатра
  const amfiDiv = $('#sector-amfi');
  for (let r = 1; r <= AMFI_ROWS; r++) {
    const rowWrapper = document.createElement('div'); rowWrapper.className = 'row-wrapper';
    const label = document.createElement('div'); label.className = 'row-label'; label.textContent = r + PARTERRE_ROWS;
    const seatsContainer = document.createElement('div'); seatsContainer.className = 'seats-container';
    
    const rowSeats = SEATS.filter(x => x.sector === 'Амфитеатр' && x.row === r + PARTERRE_ROWS);
    const half = Math.floor(rowSeats.length / 2);

    rowSeats.forEach((seat, idx) => {
      if (idx === half) {
        const aisle = document.createElement('div'); aisle.className = 'aisle-center';
        seatsContainer.appendChild(aisle);
      }
      seatsContainer.appendChild(createSeatElement(seat, occupiedSet));
    });

    rowWrapper.appendChild(label);
    rowWrapper.appendChild(seatsContainer);
    amfiDiv.appendChild(rowWrapper);
  }

  // 3. Рендер Балкона
  const balcDiv = $('#sector-balcony');
  for (let r = 1; r <= BALCONY_ROWS; r++) {
    const rowWrapper = document.createElement('div'); rowWrapper.className = 'row-wrapper';
    const label = document.createElement('div'); label.className = 'row-label'; label.textContent = r + PARTERRE_ROWS + AMFI_ROWS;
    const seatsContainer = document.createElement('div'); seatsContainer.className = 'seats-container';
    
    const rowSeats = SEATS.filter(x => x.sector === 'Балкон' && x.row === r + PARTERRE_ROWS + AMFI_ROWS);
    const third = Math.floor(rowSeats.length / 3);

    rowSeats.forEach((seat, idx) => {
      if (idx === third || idx === third * 2) {
        const aisle = document.createElement('div'); aisle.className = 'aisle-side';
        seatsContainer.appendChild(aisle);
      }
      seatsContainer.appendChild(createSeatElement(seat, occupiedSet));
    });

    rowWrapper.appendChild(label);
    rowWrapper.appendChild(seatsContainer);
    balcDiv.appendChild(rowWrapper);
  }
}

function renderCart() {
  const listEl = $('#selected-list');
  const totalEl = $('#total-price');
  const confirmBtn = $('#confirm-btn');
  const errorEl = $('#error-msg');
  const nameInput = $('#user-name');
  const phoneInput = $('#user-phone');

  let total = 0;
  if (state.selectedSeats.length === 0) {
    listEl.innerHTML = '<li class="empty-cart">Выберите места на схеме</li>';
    totalEl.textContent = '0 ₽';
  } else {
    listEl.innerHTML = state.selectedSeats.map(id => {
      const seat = SEATS.find(s => s.id === id);
      total += seat.price;
      return `
        <li class="selected-item">
          <div class="item-info">
            <span class="item-name">${seat.sector}, Ряд ${seat.row}, Место ${seat.seat}</span>
            <span class="item-cat">${seat.category}</span>
          </div>
          <div style="display:flex; align-items:center;">
            <span class="item-price">${formatMoney(seat.price)}</span>
            <button class="btn-remove" data-id="${id}">✕</button>
          </div>
        </li>
      `;
    }).join('');
    totalEl.textContent = formatMoney(total);

    listEl.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSeat(btn.dataset.id);
      });
    });
  }

  const validateForm = () => {
    const hasSeats = state.selectedSeats.length > 0;
    const hasName = nameInput.value.trim().length >= 2;
    const hasPhone = phoneInput.value.trim().length >= 10;

    if (hasSeats && hasName && hasPhone) {
      confirmBtn.disabled = false;
      errorEl.textContent = '';
    } else {
      confirmBtn.disabled = true;
      if (!hasSeats) errorEl.textContent = '';
      else if (!hasName) errorEl.textContent = 'Введите ваше имя';
      else if (!hasPhone) errorEl.textContent = 'Введите корректный телефон';
    }
  };

  nameInput.oninput = validateForm;
  phoneInput.oninput = validateForm;
  validateForm();

  confirmBtn.onclick = () => {
    confirmBtn.disabled = true;
    const perf = PERFORMANCES.find(p => p.id === state.activePerfId);
    const bookingId = 'ГА-' + Math.floor(1000 + Math.random() * 9000);
    
    state.bookings.push({
      id: bookingId,
      perfId: state.activePerfId,
      perfTitle: perf.title,
      perfDate: perf.date,
      seatIds: [...state.selectedSeats],
      total: total,
      userName: nameInput.value.trim(),
      userPhone: phoneInput.value.trim(),
      createdAt: new Date().toISOString()
    });
    
    state.selectedSeats = [];
    nameInput.value = '';
    phoneInput.value = '';
    saveToStorage();
    renderAll();
    showSuccess(`Бронь ${bookingId} успешно оформлена! Ждем вас в театре.`);
  };
}

function renderBookings() {
  const listEl = $('#bookings-list');
  if (state.bookings.length === 0) {
    listEl.innerHTML = '<div class="empty-cart">Нет активных броней</div>';
    return;
  }

  const sorted = [...state.bookings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  listEl.innerHTML = sorted.map(b => `
    <div class="booking-card">
      <div class="booking-header">
        <span>Бронь ${b.id}</span>
        <span>${formatMoney(b.total)}</span>
      </div>
      <div style="font-size: 14px; margin-bottom: 4px;">${b.perfTitle} <span style="color:var(--text-muted)">(${b.perfDate})</span></div>
      <div style="font-size: 12px; color: var(--gold-muted); margin-bottom: 4px;">Гость: ${b.userName || '—'}</div>
      <div class="booking-seats">${b.seatIds.map(id => {
        const s = SEATS.find(x => x.id === id);
        return `${s.sector} Р${s.row} М${s.seat}`;
      }).join(', ')}</div>
      <button class="btn-cancel" data-id="${b.id}">Отменить бронь</button>
    </div>
  `).join('');

  listEl.querySelectorAll('.btn-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      seatToCancelId = btn.dataset.id;
      $('#modal-confirm').classList.add('active');
    });
  });
}

/* ===== МОДАЛЬНЫЕ ОКНА ===== */
$('#btn-modal-cancel').addEventListener('click', () => {
  $('#modal-confirm').classList.remove('active');
  seatToCancelId = null;
});

$('#btn-modal-confirm').addEventListener('click', () => {
  if (seatToCancelId) {
    state.bookings = state.bookings.filter(b => b.id !== seatToCancelId);
    saveToStorage();
    renderAll();
    $('#modal-confirm').classList.remove('active');
    showSuccess('Бронь отменена. Места снова доступны.');
    seatToCancelId = null;
  }
});

/* ===== ВЗАИМОДЕЙСТВИЕ ===== */
function toggleSeat(seatId) {
  const idx = state.selectedSeats.indexOf(seatId);
  if (idx >= 0) {
    state.selectedSeats.splice(idx, 1);
  } else {
    if (state.selectedSeats.length >= 6) {
      $('#error-msg').textContent = 'Максимум 6 мест за раз.';
      return;
    }
    state.selectedSeats.push(seatId);
  }
  renderAll();
}

function initSlider() {
  const minSlider = $('#slider-min');
  const maxSlider = $('#slider-max');
  const minValEl = $('#price-min-val');
  const maxValEl = $('#price-max-val');
  const trackActive = $('#range-track-active');

  const MIN = 1500;
  const MAX = 8000;

  function updateSlider() {
    let min = parseInt(minSlider.value);
    let max = parseInt(maxSlider.value);
    
    if (min > max) {
      if (this === minSlider) min = max;
      else max = min;
      minSlider.value = min;
      maxSlider.value = max;
    }

    state.filter = { min, max };
    minValEl.textContent = min.toLocaleString('ru-RU');
    maxValEl.textContent = max.toLocaleString('ru-RU');

    const leftPercent = ((min - MIN) / (MAX - MIN)) * 100;
    const rightPercent = 100 - ((max - MIN) / (MAX - MIN)) * 100;
    trackActive.style.left = leftPercent + '%';
    trackActive.style.right = rightPercent + '%';

    renderHall();
  }

  minSlider.addEventListener('input', updateSlider);
  maxSlider.addEventListener('input', updateSlider);
  updateSlider.call(minSlider);
}

function renderAll() {
  renderAfisha();
  renderHall();
  renderCart();
  renderBookings();
}

function init() {
  loadFromStorage();
  initSlider();
  renderAll();

  setTimeout(() => {
    $('#preloader').classList.add('hidden');
  }, 1000);
}

init();