const CATEGORY_COLOR = {
  Hackathon: 'var(--primary)',
  Credit: 'var(--success)',
  Accelerator: 'var(--accent)',
};

let ITEMS = [];
let state = {
  view: 'overview',
  category: 'All',
  status: 'All',
  search: '',
  sort: { key: 'date', dir: 'asc' },
};

function daysUntil(dateStr) {
  const today = new Date(new Date().toDateString());
  const target = new Date(dateStr);
  return Math.round((target - today) / 86400000);
}

function computeStatus(item) {
  if (item.date) {
    const d = daysUntil(item.date);
    if (d < 0) return 'Closed';
    if (d <= 14) return 'Closing soon';
    return 'Upcoming';
  }
  return item.status || 'Open';
}

function statusBadgeClass(status) {
  switch (status) {
    case 'Open': return 'badge-open';
    case 'Closing soon': return 'badge-soon';
    case 'Closed': return 'badge-closed';
    default: return 'badge-info';
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('oyedekhakya-theme', theme);
  document.getElementById('theme-switch').classList.toggle('on', theme === 'dark');
  document.getElementById('theme-label').textContent = theme === 'dark' ? 'Dark mode' : 'Light mode';
}

function initTheme() {
  const saved = localStorage.getItem('oyedekhakya-theme');
  const theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(theme);
  document.getElementById('theme-switch').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

function setView(view) {
  state.view = view;
  document.querySelectorAll('.nav-item[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  ['overview', 'table', 'cards'].forEach(v => {
    document.getElementById('view-' + v).hidden = v !== view;
  });
  document.getElementById('page-title').textContent = view === 'overview' ? 'Overview' : view === 'table' ? 'Table' : 'Cards';
  render();
}

function buildCategoryNav() {
  const cats = ['All', ...Array.from(new Set(ITEMS.map(i => i.category)))];
  const nav = document.getElementById('category-nav');
  nav.innerHTML = '';
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'nav-item' + (state.category === cat ? ' active' : '');
    btn.innerHTML = cat === 'All'
      ? '<span class="nav-dot" style="background:var(--text-muted)"></span> All items'
      : `<span class="nav-dot" style="background:${CATEGORY_COLOR[cat] || 'var(--text-muted)'}"></span> ${cat}s`;
    btn.addEventListener('click', () => {
      state.category = cat;
      state.status = 'All';
      renderFilterBars();
      if (state.view === 'overview') setView('table'); else render();
      buildCategoryNav();
    });
    nav.appendChild(btn);
  });
}

function buildPillGroup(containerId, options, key) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'pill' + (state[key] === opt ? ' active' : '');
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      state[key] = opt;
      renderFilterBars();
      render();
    });
    el.appendChild(btn);
  });
}

function renderFilterBars() {
  const categories = ['All', ...Array.from(new Set(ITEMS.map(i => i.category)))];
  const statuses = ['All', 'Open', 'Upcoming', 'Closing soon', 'Closed', 'Rolling', 'Pre-registration'];
  const availableStatuses = ['All', ...Array.from(new Set(ITEMS.map(i => computeStatus(i))))]
    .filter((v, i, arr) => arr.indexOf(v) === i);
  buildPillGroup('filter-category', categories, 'category');
  buildPillGroup('filter-category-2', categories, 'category');
  buildPillGroup('filter-status', availableStatuses, 'status');
  buildPillGroup('filter-status-2', availableStatuses, 'status');
}

function filteredItems() {
  const q = state.search.trim().toLowerCase();
  return ITEMS.filter(item => {
    if (state.category !== 'All' && item.category !== state.category) return false;
    const status = computeStatus(item);
    if (state.status !== 'All' && status !== state.status) return false;
    if (q && !(item.title.toLowerCase().includes(q) || (item.note || '').toLowerCase().includes(q))) return false;
    return true;
  });
}

function sortItems(items) {
  const { key, dir } = state.sort;
  const sorted = [...items].sort((a, b) => {
    let av = a[key], bv = b[key];
    if (key === 'date') {
      av = a.date ? new Date(a.date).getTime() : Infinity;
      bv = b.date ? new Date(b.date).getTime() : Infinity;
    } else if (key === 'status') {
      av = computeStatus(a); bv = computeStatus(b);
    } else {
      av = (av || '').toString().toLowerCase();
      bv = (bv || '').toString().toLowerCase();
    }
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
}

function renderStatRow() {
  const counts = {
    Hackathon: ITEMS.filter(i => i.category === 'Hackathon').length,
    Credit: ITEMS.filter(i => i.category === 'Credit').length,
    Accelerator: ITEMS.filter(i => i.category === 'Accelerator').length,
    deadlines: ITEMS.filter(i => i.date && daysUntil(i.date) >= 0 && daysUntil(i.date) <= 45).length,
  };
  const row = document.getElementById('stat-row');
  row.innerHTML = `
    <div class="stat-tile"><div class="label">Hackathons</div><div class="stat-value">${counts.Hackathon}</div></div>
    <div class="stat-tile"><div class="label">Credit programs</div><div class="stat-value">${counts.Credit}</div></div>
    <div class="stat-tile"><div class="label">Accelerators</div><div class="stat-value">${counts.Accelerator}</div></div>
    <div class="stat-tile"><div class="label">Deadlines (45d)</div><div class="stat-value">${counts.deadlines}</div></div>
  `;
}

function renderDeadlines() {
  const list = document.getElementById('deadline-list');
  const items = ITEMS
    .filter(i => i.date && daysUntil(i.date) >= -1 && daysUntil(i.date) <= 45)
    .sort((a, b) => daysUntil(a.date) - daysUntil(b.date));
  list.innerHTML = '';
  if (!items.length) {
    list.innerHTML = '<div class="empty-state">Nothing closing in the next 45 days.</div>';
    return;
  }
  items.forEach(item => {
    const d = daysUntil(item.date);
    const row = document.createElement('div');
    row.className = 'deadline-row' + (d <= 3 ? ' urgent' : '');
    row.innerHTML = `
      <span class="days">${d <= 0 ? 'today' : d + 'd left'}</span>
      <span class="title">
        <a href="${item.url}" target="_blank" rel="noopener">${item.title}</a>
        <span class="note">${item.date} · ${item.note || ''}</span>
      </span>
    `;
    list.appendChild(row);
  });
}

function renderTable() {
  const items = sortItems(filteredItems());
  const body = document.getElementById('table-body');
  body.innerHTML = '';
  document.getElementById('count-table').textContent = items.length + ' items';
  document.querySelectorAll('#view-table thead th').forEach(th => {
    th.classList.toggle('sorted', th.dataset.sort === state.sort.key);
  });
  if (!items.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty-state">No items match these filters.</td></tr>';
    return;
  }
  items.forEach(item => {
    const status = computeStatus(item);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="title-cell">
        <a href="${item.url}" target="_blank" rel="noopener">${item.title}</a>
        <div class="note">${item.note || ''}</div>
      </td>
      <td><span class="cat-tag"><span class="nav-dot" style="background:${CATEGORY_COLOR[item.category] || 'var(--text-muted)'}"></span>${item.category}</span></td>
      <td class="muted">${item.subcategory || '—'}</td>
      <td class="muted">${item.date || '—'}</td>
      <td><span class="badge ${statusBadgeClass(status)}">${status}</span></td>
    `;
    body.appendChild(tr);
  });
}

function renderCards() {
  const items = sortItems(filteredItems());
  const container = document.getElementById('cards-container');
  document.getElementById('count-cards').textContent = items.length + ' items';
  container.innerHTML = '';
  if (!items.length) {
    container.innerHTML = '<div class="empty-state">No items match these filters.</div>';
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'card-grid';
  items.forEach(item => {
    const status = computeStatus(item);
    const card = document.createElement('div');
    card.className = 'item-card cat-' + item.category;
    card.innerHTML = `
      <div class="card-top">
        <a class="card-title" href="${item.url}" target="_blank" rel="noopener">${item.title}</a>
        <span class="badge ${statusBadgeClass(status)}">${status}</span>
      </div>
      <div class="cat-tag"><span class="nav-dot" style="background:${CATEGORY_COLOR[item.category] || 'var(--text-muted)'}"></span>${item.category}${item.subcategory ? ' · ' + item.subcategory : ''}${item.date ? ' · ' + item.date : ''}</div>
      <div class="note">${item.note || ''}</div>
    `;
    grid.appendChild(card);
  });
  container.appendChild(grid);
}

function render() {
  renderStatRow();
  if (state.view === 'overview') renderDeadlines();
  if (state.view === 'table') renderTable();
  if (state.view === 'cards') renderCards();
}

function wireEvents() {
  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.addEventListener('click', () => setView(el.dataset.view));
  });
  document.querySelectorAll('#view-table thead th').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (state.sort.key === key) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      else state.sort = { key, dir: 'asc' };
      renderTable();
    });
  });
  document.getElementById('search-table').addEventListener('input', e => { state.search = e.target.value; renderTable(); });
  document.getElementById('search-cards').addEventListener('input', e => { state.search = e.target.value; renderCards(); });
}

initTheme();

fetch('data.json?t=' + Date.now())
  .then(r => r.json())
  .then(data => {
    ITEMS = data.items || [];
    document.getElementById('updated-label').textContent = 'Updated ' + data.updated_at;
    buildCategoryNav();
    renderFilterBars();
    wireEvents();
    render();
  })
  .catch(err => {
    document.getElementById('updated-label').textContent = 'Failed to load data.json';
    console.error(err);
  });
