'use strict';

const STORAGE_KEY = 'habit-tracker:v1';

const CATEGORIES = {
  health: { name: '健康', color: '#22c55e' },
  study: { name: '学习', color: '#3b82f6' },
  work: { name: '工作', color: '#f59e0b' },
  life: { name: '生活', color: '#a855f7' }
};

// ---------- 纯函数（便于 Node 测试） ----------

function pad(n) {
  return String(n).padStart(2, '0');
}

function dateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function dateFromKey(key) {
  const parts = key.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function addDaysKey(key, delta) {
  const d = dateFromKey(key);
  d.setDate(d.getDate() + delta);
  return dateKey(d);
}

function hasAnyCompleted(records, key) {
  const day = records[key];
  return !!day && Object.keys(day).some(function (id) { return !!day[id]; });
}

function computeTodayCount(records, habits, key) {
  const day = records[key] || {};
  let done = 0;
  for (let i = 0; i < habits.length; i++) {
    if (day[habits[i].id]) done++;
  }
  return { done: done, total: habits.length };
}

function computeStreak(records, key) {
  let anchor = null;
  if (hasAnyCompleted(records, key)) {
    anchor = key;
  } else {
    const yesterday = addDaysKey(key, -1);
    if (hasAnyCompleted(records, yesterday)) anchor = yesterday;
  }
  if (!anchor) return 0;
  let count = 0;
  let cursor = anchor;
  while (hasAnyCompleted(records, cursor)) {
    count++;
    cursor = addDaysKey(cursor, -1);
  }
  return count;
}

function getCompletedHabits(records, habits, key) {
  const day = records[key] || {};
  return habits.filter(function (h) { return !!day[h.id]; });
}

function shiftMonth(year, month, delta) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function getCalendarCells(year, month) {
  const startWeekday = new Date(year, month - 1, 1).getDay();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month - 1, i - startWeekday + 1);
    cells.push({
      key: dateKey(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month - 1
    });
  }
  return cells;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STORAGE_KEY: STORAGE_KEY,
    CATEGORIES: CATEGORIES,
    dateKey: dateKey,
    dateFromKey: dateFromKey,
    addDaysKey: addDaysKey,
    hasAnyCompleted: hasAnyCompleted,
    computeTodayCount: computeTodayCount,
    computeStreak: computeStreak,
    getCompletedHabits: getCompletedHabits,
    shiftMonth: shiftMonth,
    getCalendarCells: getCalendarCells
  };
}

// ---------- 浏览器逻辑 ----------

if (typeof document !== 'undefined') {
  let state = null;
  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth() + 1;
  let selectedDay = null;

  const els = {
    date: document.getElementById('dateText'),
    done: document.getElementById('doneCount'),
    total: document.getElementById('totalCount'),
    streak: document.getElementById('streak'),
    progress: document.getElementById('progressFill'),
    list: document.getElementById('habitList'),
    form: document.getElementById('addForm'),
    nameInput: document.getElementById('habitName'),
    categorySelect: document.getElementById('habitCategory'),
    monthLabel: document.getElementById('monthLabel'),
    calendarGrid: document.getElementById('calendarGrid'),
    calendarDetail: document.getElementById('calendarDetail'),
    prevMonthBtn: document.getElementById('prevMonth'),
    nextMonthBtn: document.getElementById('nextMonth')
  };

  function uid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function defaultState() {
    const now = new Date().toISOString();
    return {
      version: 1,
      habits: [
        { id: uid(), name: '喝水', category: 'health', createdAt: now },
        { id: uid(), name: '阅读30分钟', category: 'study', createdAt: now },
        { id: uid(), name: '早睡', category: 'life', createdAt: now }
      ],
      records: {}
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.habits) && parsed.records && typeof parsed.records === 'object') {
          return parsed;
        }
      }
    } catch (e) {}
    const seeded = defaultState();
    saveState(seeded);
    return seeded;
  }

  function saveState(next) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function todayKey() {
    return dateKey(new Date());
  }

  function buildCategorySelect() {
    Object.keys(CATEGORIES).forEach(function (key) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = CATEGORIES[key].name;
      els.categorySelect.appendChild(opt);
    });
  }

  function renderDate() {
    const fmt = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'long' });
    els.date.textContent = fmt.format(new Date());
  }

  function habitItemHTML(habit, done) {
    const pencil = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
    const trash = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    return (
      '<div class="habit-item' + (done ? ' done' : '') + '" data-id="' + habit.id + '">' +
        '<button type="button" class="check' + (done ? ' checked' : '') + '" data-action="toggle" aria-label="' + (done ? '标记为未完成' : '标记为已完成') + '" aria-pressed="' + done + '"></button>' +
        '<span class="habit-name" data-action="toggle">' + escapeHtml(habit.name) + '</span>' +
        '<div class="habit-actions">' +
          '<button type="button" class="icon-btn" data-action="edit" aria-label="重命名" title="重命名">' + pencil + '</button>' +
          '<button type="button" class="icon-btn danger" data-action="delete" aria-label="删除" title="删除">' + trash + '</button>' +
        '</div>' +
      '</div>'
    );
  }

  function renderHabitList(today) {
    const day = state.records[today] || {};
    if (!state.habits.length) {
      els.list.innerHTML = '<div class="empty">还没有习惯，添加一个开始吧 ✨</div>';
      return;
    }
    const order = ['health', 'study', 'work', 'life'];
    let html = '';
    order.forEach(function (cat) {
      const items = state.habits.filter(function (h) { return h.category === cat; });
      if (!items.length) return;
      const meta = CATEGORIES[cat];
      const doneCount = items.filter(function (h) { return !!day[h.id]; }).length;
      html += '<section class="group">' +
        '<div class="group-header">' +
          '<span class="dot" style="background:' + meta.color + '"></span>' +
          '<h2>' + meta.name + '</h2>' +
          '<span class="group-count">' + doneCount + '/' + items.length + '</span>' +
        '</div>' +
        '<div class="group-items">';
      items.forEach(function (h) {
        html += habitItemHTML(h, !!day[h.id]);
      });
      html += '</div></section>';
    });
    els.list.innerHTML = html;
  }

  function renderCalendar() {
    els.monthLabel.textContent = currentYear + '年' + currentMonth + '月';
    const cells = getCalendarCells(currentYear, currentMonth);
    const today = todayKey();
    let html = '';
    cells.forEach(function (cell) {
      let cls = 'cal-cell';
      if (!cell.inMonth) {
        cls += ' cal-out';
      } else {
        if (cell.key === today) cls += ' cal-today';
        if (hasAnyCompleted(state.records, cell.key)) cls += ' cal-done';
        if (cell.key > today) cls += ' cal-future';
      }
      if (cell.key === selectedDay) cls += ' cal-selected';
      const attrs = 'data-key="' + cell.key + '"' + (cell.inMonth ? '' : ' data-out="1"');
      html += '<button type="button" class="' + cls + '" ' + attrs + '>' +
        '<span class="cal-day">' + cell.day + '</span>' +
        (cell.inMonth ? '<span class="cal-dot"></span>' : '') +
        '</button>';
    });
    els.calendarGrid.innerHTML = html;
  }

  function renderCalendarDetail(key) {
    if (!key) {
      els.calendarDetail.innerHTML = '';
      return;
    }
    const parts = key.split('-');
    const label = Number(parts[1]) + '月' + Number(parts[2]) + '日';
    const doneHabits = getCompletedHabits(state.records, state.habits, key);
    let html = '<div class="cal-detail-head">' + label + ' · 完成 ' + doneHabits.length + '/' + state.habits.length + ' 项</div>';
    if (!doneHabits.length) {
      html += '<div class="cal-detail-empty">这一天没有打卡记录</div>';
    } else {
      html += '<ul class="cal-detail-list">';
      doneHabits.forEach(function (h) {
        const cat = CATEGORIES[h.category];
        html += '<li><span class="cal-detail-dot" style="background:' + (cat ? cat.color : '#6366f1') + '"></span>' + escapeHtml(h.name) + '</li>';
      });
      html += '</ul>';
    }
    els.calendarDetail.innerHTML = html;
  }

  function render() {
    const today = todayKey();
    const counts = computeTodayCount(state.records, state.habits, today);
    const streak = computeStreak(state.records, today);
    els.done.textContent = counts.done;
    els.total.textContent = counts.total;
    els.streak.textContent = streak;
    const pct = counts.total ? Math.round(counts.done / counts.total * 100) : 0;
    els.progress.style.width = pct + '%';
    renderHabitList(today);
    renderCalendar();
    if (selectedDay) {
      renderCalendarDetail(selectedDay);
    } else {
      els.calendarDetail.innerHTML = '';
    }
  }

  function addHabit() {
    const name = els.nameInput.value.trim();
    if (!name) {
      els.nameInput.focus();
      return;
    }
    state.habits.push({
      id: uid(),
      name: name,
      category: els.categorySelect.value,
      createdAt: new Date().toISOString()
    });
    saveState(state);
    els.nameInput.value = '';
    els.nameInput.focus();
    render();
  }

  function toggleHabit(id) {
    const today = todayKey();
    if (!state.records[today]) state.records[today] = {};
    if (state.records[today][id]) {
      delete state.records[today][id];
    } else {
      state.records[today][id] = true;
    }
    if (!Object.keys(state.records[today]).length) delete state.records[today];
    saveState(state);
    render();
  }

  function deleteHabit(id) {
    const habit = state.habits.find(function (h) { return h.id === id; });
    if (!habit) return;
    const ok = window.confirm('确定删除「' + habit.name + '」吗？\n该习惯的历史记录也会一并清除。');
    if (!ok) return;
    state.habits = state.habits.filter(function (h) { return h.id !== id; });
    Object.keys(state.records).forEach(function (key) {
      delete state.records[key][id];
      if (!Object.keys(state.records[key]).length) delete state.records[key];
    });
    saveState(state);
    render();
  }

  function startEdit(itemEl) {
    const id = itemEl.getAttribute('data-id');
    const habit = state.habits.find(function (h) { return h.id === id; });
    if (!habit) return;
    const nameEl = itemEl.querySelector('.habit-name');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = habit.name;
    input.maxLength = 30;
    input.className = 'habit-name-input';
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    function finish(save) {
      if (finished) return;
      finished = true;
      const newName = input.value.trim();
      if (save && newName && newName !== habit.name) {
        habit.name = newName;
        saveState(state);
      }
      render();
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        finish(true);
      } else if (e.key === 'Escape') {
        finish(false);
      }
    });
    input.addEventListener('blur', function () {
      finish(true);
    });
  }

  function goToMonth(delta) {
    const shifted = shiftMonth(currentYear, currentMonth, delta);
    currentYear = shifted.year;
    currentMonth = shifted.month;
    selectedDay = null;
    renderCalendar();
    els.calendarDetail.innerHTML = '';
  }

  function bindEvents() {
    els.form.addEventListener('submit', function (e) {
      e.preventDefault();
      addHabit();
    });
    els.list.addEventListener('click', function (e) {
      const editBtn = e.target.closest('[data-action="edit"]');
      if (editBtn) {
        e.preventDefault();
        startEdit(editBtn.closest('.habit-item'));
        return;
      }
      const delBtn = e.target.closest('[data-action="delete"]');
      if (delBtn) {
        e.preventDefault();
        deleteHabit(delBtn.closest('.habit-item').getAttribute('data-id'));
        return;
      }
      const toggleEl = e.target.closest('[data-action="toggle"]');
      if (toggleEl) {
        const item = toggleEl.closest('.habit-item');
        if (item) toggleHabit(item.getAttribute('data-id'));
      }
    });
    els.prevMonthBtn.addEventListener('click', function () {
      goToMonth(-1);
    });
    els.nextMonthBtn.addEventListener('click', function () {
      goToMonth(1);
    });
    els.calendarGrid.addEventListener('click', function (e) {
      const cell = e.target.closest('.cal-cell');
      if (!cell) return;
      if (cell.getAttribute('data-out') === '1') return;
      const key = cell.getAttribute('data-key');
      if (key > todayKey()) return;
      selectedDay = key;
      renderCalendar();
      renderCalendarDetail(key);
    });
  }

  function init() {
    state = loadState();
    buildCategorySelect();
    bindEvents();
    renderDate();
    render();
  }

  init();
}