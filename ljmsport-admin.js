// ════════════════════════════════════════════════════════
//  LJMSPORT ADMIN  — Supabase Edition
//  Requires: ljmsport-supabase.js loaded first in HTML
// ════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  ADMIN ACCOUNTS  — loaded from Supabase ljm_admins table
//  Fallback to a single owner account only if the table is
//  empty (first-run bootstrap).
// ══════════════════════════════════════════════════════════
let ADMIN_ACCOUNTS = [];   // populated from db_getAdmins() on page load
let currentAdmin   = null;

// ── LIVE STATE ──
let ORDERS = [], filteredOrders = [];
let allFeedbacks = [], filteredFeedbacks = [];
let allPayments  = [];
let allCustomers = [], filteredCustomers = [];
let customerStatuses = {};
let currentCustomerEmail = null;
let currentOrderFilter = 'all', currentOrderSearch = '';
let adminProducts = [];
let currentProdFilter = 'all';
let editingProductId  = null;

// Revenue chart data is derived live from ORDERS (last 7 days)
let REV_DATA = [], REV_DAYS = [];

// Default sizes shown when admin picks a category for a NEW product.
// These match the formats used in the shop (US shoe sizes, S/M/L apparel, etc.)
const CAT_SIZES = {
  Basketball:  ['US 7','US 8','US 9','US 10','US 11','US 12'],
  Soccer:      ['US 7','US 8','US 9','US 10','US 11'],
  Volleyball:  ['US 6','US 7','US 8','US 9','US 10','US 11'],
  Running:     ['US 6','US 7','US 8','US 9','US 10','US 11','US 12'],
  Gym:         ['S','M','L','XL','XXL'],
  Accessories: ['One Size'],
};

// Auto-fill the sizes input when admin changes category on a new product
function onCatChange(cat) {
  if (editingProductId !== null) return; // don't overwrite existing product's sizes
  const defaults = CAT_SIZES[cat] || ['One Size'];
  const el = document.getElementById('prod-sizes');
  if (el) el.value = defaults.join(', ');
}

// Stock is stored in Supabase ljm_stock table (cross-device, real source of truth)
// Local cache for current session
let _stockCache = {};  // { productId: { size: qty } }

// ══════════════════════════════════════════════════════════
//  SESSION (sessionStorage — survives refresh, clears on tab close)
//  sessionStorage is scoped to the tab and never shared across
//  tabs or persisted after the browser session ends, making it
//  more appropriate than localStorage for admin auth state.
// ══════════════════════════════════════════════════════════
const SESSION_KEY    = 'ljm_admin_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function _setSession(account) {
  const session = { admin: account, expiresAt: Date.now() + SESSION_TTL_MS };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function _clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

/** Returns the current admin if session is still valid, otherwise null. */
function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (Date.now() > session.expiresAt) { _clearSession(); return null; }
    return session.admin;
  } catch (e) { _clearSession(); return null; }
}

/** Call at the start of any privileged realtime callback. */
function requireAuth() {
  if (!currentAdmin) return null;   // not logged in at all — skip silently
  const admin = getSession();
  if (!admin) { adminLogout(); return null; }  // session expired while logged in
  return admin;
}

// ── SHA-256 helper (matches customer password hashing) ───
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ══════════════════════════════════════════════════════════
//  RBAC — pages visible per role
// ══════════════════════════════════════════════════════════
const ROLE_PAGES = {
  owner   : ['dashboard','orders','riders','products','customers','feedbacks','payments'],
  manager : ['dashboard','orders','riders','products','customers','feedbacks'],
  staff   : ['dashboard','orders'],
};

function applyRBAC(role) {
  const allowed = ROLE_PAGES[role] || ['dashboard'];
  document.querySelectorAll('.nav-item[onclick]').forEach(item => {
    const match = item.getAttribute('onclick').match(/'([a-z]+)'/);
    const page  = match ? match[1] : null;
    if (page) item.style.display = allowed.includes(page) ? '' : 'none';
  });
}

async function loadAllStock() {
  _stockCache = await db_getAllStock();
}

function getProductStock(id) {
  return _stockCache[id] || {};
}

function getTotalStock(id) {
  return Object.values(getProductStock(id)).reduce((a, b) => a + (parseInt(b) || 0), 0);
}

function stockStatus(total) {
  if (total === 0) return { label: 'Out of Stock', color: 'var(--danger)' };
  if (total <= 5)  return { label: 'Low Stock',    color: 'var(--accent2)' };
  return                  { label: 'In Stock',     color: 'var(--success)' };
}

// ── PAGE BOOT ─────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  // Pre-load admin accounts from Supabase so login works immediately
  ADMIN_ACCOUNTS = await db_getAdmins();
  startClock();

  // Restore session if the page was refreshed
  const saved = getSession();
  if (saved) {
    currentAdmin = saved;
    document.getElementById('login-screen').classList.remove('active');
    const app = document.getElementById('admin-app');
    app.classList.remove('admin-app-hidden');
    app.classList.add('admin-app-visible');
    document.getElementById('admin-avatar').textContent       = saved.name[0];
    document.getElementById('admin-name-display').textContent = saved.name;
    document.getElementById('admin-role-display').textContent = saved.role.toUpperCase();
    applyRBAC(saved.role);
    await loadOrders();
    await loadAdminProducts();
    allFeedbacks = await db_getFeedbacks();
    filteredFeedbacks = [...allFeedbacks];
    allPayments = await db_getPayments();
    showPage('dashboard', null);
    startSync();
  }
});

// ══════════════════════════════════════════════════════════
//  ORDERS  —  Supabase-backed (no demo fallback)
// ══════════════════════════════════════════════════════════
async function loadOrders() {
  const liveOrders = await db_getOrders();
  ORDERS = liveOrders.map(o => {
    const s = o.shipping || {};
    return {
      ...o,
      customer  : [s.fname, s.lname].filter(Boolean).join(' ') || o.userEmail || 'Customer',
      email     : s.email || o.userEmail || '',
      phone     : s.phone || '',
      address   : [s.address, s.city].filter(Boolean).join(', ') || '',
      date      : o.date ? new Date(o.date).toLocaleString('en-PH', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '',
      rawDate   : o.date || '',
      items     : (o.items || []).map(it => ({ name:it.name||'Item', qty:it.qty||1, price:it.price||0, emoji:it.emoji||'📦' })),
      payment       : (o.payment || 'cod').toUpperCase(),
      paymentStatus : o.paymentStatus || ((o.payment || 'cod').toLowerCase() === 'cod' ? 'To Pay on Delivery' : 'Pending'),
    };
  });
  ORDERS.sort((a, b) => new Date(b.rawDate || 0) - new Date(a.rawDate || 0));
  _buildRevenueChart();
  updateNavBadges();
}

async function saveOrderUpdate(orderId, changes) {
  await db_updateOrder(orderId, changes);
}

function updateNavBadges() {
  const pending = ORDERS.filter(o => o.status === 'pending').length;
  const el = document.getElementById('nav-orders-badge');
  if (el) { el.textContent = pending; el.style.display = pending > 0 ? '' : 'none'; }
}

// Build last-7-days revenue data from live orders
function _buildRevenueChart() {
  REV_DATA = []; REV_DAYS = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const label = i === 0 ? 'Today' : d.toLocaleDateString('en-PH', { weekday:'short' });
    const dateStr = d.toLocaleDateString('en-PH');
    const rev = ORDERS
      .filter(o => o.status === 'delivered' && new Date(o.rawDate).toLocaleDateString('en-PH') === dateStr)
      .reduce((s, o) => s + (o.total || 0), 0);
    REV_DAYS.push(label);
    REV_DATA.push(rev);
  }
}

// ══════════════════════════════════════════════════════════
//  REAL-TIME SYNC  (Supabase Realtime)
// ══════════════════════════════════════════════════════════
function startSync() {
  db_subscribe('orders', async (payload) => {
    if (!requireAuth()) return;
    const prevPending = ORDERS.filter(o => o.status === 'pending').length;
    await loadOrders();
    const newPending  = ORDERS.filter(o => o.status === 'pending').length;
    if (newPending > prevPending) {
      showToast(`🛒 New order received!`, 'info');
      flashNewOrderBanner(newPending - prevPending);
    }
    updateNavBadges();
    _refreshCurrentPage();
  });

  db_subscribe('riders', async () => {
    if (!requireAuth()) return;
    const page = _activePage();
    if (page === 'riders')    renderRiders();
    if (page === 'dashboard') renderDashboard();
  });

  db_subscribe('products', async () => {
    if (!requireAuth()) return;
    await loadAdminProducts();
    const page = _activePage();
    if (page === 'products') renderProductGrid();
  });

  db_subscribe('stock', async () => {
    if (!requireAuth()) return;
    await loadAllStock();
    const page = _activePage();
    if (page === 'products') { renderProductGrid(); renderStockTable(); }
    // Auto-refresh the stock modal if it's currently open
    if (currentStockProductId !== null &&
        !document.getElementById('stock-modal-overlay').classList.contains('hidden')) {
      openStockModal(currentStockProductId);
    }
  });

  db_subscribe('payments', async () => {
    if (!requireAuth()) return;
    allPayments = await db_getPayments();
    if (_activePage() === 'payments') renderPayments();
  });

  // Watch admins table so permission changes take effect live
  db_subscribe('admins', async () => {
    ADMIN_ACCOUNTS = await db_getAdmins();
    const session = getSession();
    if (session) {
      const refreshed = ADMIN_ACCOUNTS.find(a => a.username === session.username);
      if (!refreshed) { adminLogout(); showToast('Your account was removed', 'error'); }
      else { currentAdmin = refreshed; _session.admin = refreshed; applyRBAC(refreshed.role); }
    }
  });
}

function _activePage() {
  return document.querySelector('.page.active')?.id?.replace('page-', '') || '';
}

async function _refreshCurrentPage() {
  switch (_activePage()) {
    case 'dashboard': renderDashboard(); break;
    case 'orders':    renderOrders();    break;
    case 'riders':    renderRiders();    break;
    case 'customers': renderCustomers(); break;
  }
}

// ── FLASH BANNER ──
function flashNewOrderBanner(count) {
  const existing = document.getElementById('new-order-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.id = 'new-order-banner';
  banner.style.cssText = `position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--accent);color:#000;padding:10px 20px;border-radius:4px;font-weight:700;font-size:14px;display:flex;align-items:center;gap:12px;box-shadow:0 4px 16px rgba(0,194,255,.4)`;
  banner.innerHTML = `<span>🛒 ${count} new order${count > 1 ? 's' : ''} from the shop!</span><button onclick="showPage('orders',null);this.parentElement.remove()" style="background:#000;color:var(--accent);border:none;padding:4px 10px;border-radius:2px;cursor:pointer;font-weight:700;font-size:12px">VIEW →</button><button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;font-size:16px;color:#000">✕</button>`;
  document.body.appendChild(banner);
  setTimeout(() => { if (banner.parentElement) banner.remove(); }, 7000);
}

// ══════════════════════════════════════════════════════════
//  LOGIN / LOGOUT
// ══════════════════════════════════════════════════════════
async function adminLogin() {
  const u = document.getElementById('login-username').value.trim().toLowerCase();
  const p = document.getElementById('login-password').value;
  const r = document.getElementById('login-role').value;

  // Re-fetch accounts in case they changed since page load
  if (!ADMIN_ACCOUNTS.length) ADMIN_ACCOUNTS = await db_getAdmins();

  // Hash the entered password before comparing.
  // Existing plain-text passwords in ljm_admins will need to be replaced
  // with their SHA-256 equivalents in the DB (see migration note below).
  // During migration you can compare both forms so no-one is locked out.
  const hashed  = await sha256(p);
  const account = ADMIN_ACCOUNTS.find(a => {
    if (a.username !== u || a.role !== r) return false;
    // Accept hashed match (new rows) OR plain-text match (legacy rows)
    // so existing seed data keeps working until the DB is migrated.
    return a.password === hashed || a.password === p;
  });

  if (!account) { document.getElementById('login-error').classList.remove('hidden'); return; }
  document.getElementById('login-error').classList.add('hidden');

  _setSession(account);
  currentAdmin = account;

  document.getElementById('login-screen').classList.remove('active');
  const app = document.getElementById('admin-app');
  app.classList.remove('admin-app-hidden');
  app.classList.add('admin-app-visible');
  document.getElementById('admin-avatar').textContent       = account.name[0];
  document.getElementById('admin-name-display').textContent = account.name;
  document.getElementById('admin-role-display').textContent = account.role.toUpperCase();

  // Apply role-based nav visibility
  applyRBAC(account.role);

  await loadOrders();
  await loadAdminProducts();
  allFeedbacks = await db_getFeedbacks();
  filteredFeedbacks = [...allFeedbacks];
  allPayments = await db_getPayments();

  // Navigate to first allowed page for this role
  const firstPage = ROLE_PAGES[account.role]?.[0] || 'dashboard';
  showPage(firstPage, null);
  startSync();
}

function adminLogout() {
  _clearSession();
  currentAdmin = null;
  document.getElementById('admin-app').classList.add('admin-app-hidden');
  document.getElementById('admin-app').classList.remove('admin-app-visible');
  document.getElementById('login-screen').classList.add('active');
  // Restore all nav items so the next login renders them correctly
  document.querySelectorAll('.nav-item[onclick]').forEach(i => i.style.display = '');
}

function togglePw() {
  const el = document.getElementById('login-password');
  el.type = el.type === 'password' ? 'text' : 'password';
}

// ══════════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════════
function showPage(name, el) {
  // RBAC: silently redirect to dashboard if this role can't access the page
  const role    = currentAdmin?.role || 'staff';
  const allowed = ROLE_PAGES[role] || ['dashboard'];
  if (!allowed.includes(name)) { name = 'dashboard'; el = null; }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  else document.querySelectorAll('.nav-item').forEach(i => {
    if (i.getAttribute('onclick')?.includes(`'${name}'`)) i.classList.add('active');
  });
  document.getElementById('page-title-bar').textContent = name.charAt(0).toUpperCase() + name.slice(1);
  closeSidebarOverlay();
  switch(name) {
    case 'dashboard': renderDashboard(); break;
    case 'orders':    renderOrders();    break;
    case 'riders':    renderRiders();    break;
    case 'products':  renderProducts();  break;
    case 'customers': renderCustomers(); break;
    case 'feedbacks': renderFeedbacks(); break;
    case 'payments':  renderPayments();  break;
  }
}
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('show');
}
function closeSidebarOverlay() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}

// ══════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════
async function renderDashboard() {
  await loadOrders();
  document.getElementById('kpi-total').textContent   = ORDERS.length;
  document.getElementById('kpi-pending').textContent  = ORDERS.filter(o => o.status === 'pending').length;
  document.getElementById('kpi-ofd').textContent     = ORDERS.filter(o => o.status === 'out_for_delivery').length;
  const todayStr = new Date().toLocaleDateString('en-PH');
  const todayDelivered = ORDERS.filter(o => o.status === 'delivered' && new Date(o.rawDate).toLocaleDateString('en-PH') === todayStr);
  const todayRev = todayDelivered.reduce((s, o) => s + o.total, 0);
  document.getElementById('kpi-revenue').textContent     = '₱' + todayRev.toLocaleString();
  document.getElementById('kpi-revenue-sub').textContent = todayDelivered.length + ' delivered today';
  document.getElementById('kpi-total-sub').textContent   = ORDERS.filter(o => o.status === 'delivered').length + ' delivered';

  const recent = ORDERS.slice(0, 6);
  const tbody  = document.getElementById('dash-recent-orders');
  tbody.innerHTML = recent.length
    ? `<table class="data-table"><thead><tr><th>ID</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead><tbody>
        ${recent.map(o => `<tr style="cursor:pointer" onclick="openOrderModal('${o.id}')">
          <td><span style="font-family:var(--mono);font-size:11px;color:var(--accent)">${o.id}${o._live ? '<span style="font-size:9px;color:var(--success);margin-left:4px">●LIVE</span>' : ''}</span></td>
          <td>${o.customer}</td>
          <td style="font-family:var(--mono)">₱${o.total.toLocaleString()}</td>
          <td>${statusBadge(o.status)}</td>
        </tr>`).join('')}
      </tbody></table>`
    : '<div class="empty-state">No orders yet.</div>';

  const riders    = await db_getRiders();
  const riderWrap = document.getElementById('dash-riders');
  riderWrap.innerHTML = riders.length
    ? riders.map(r => `
        <div class="dash-rider-row">
          <div class="rider-dot ${r.online ? 'online' : ''}"></div>
          <div><div class="rider-name">${r.name}</div><div class="rider-meta">${r.plate}</div></div>
          ${r.currentOrderId ? `<div class="rider-order-tag">${r.currentOrderId}</div>` : ''}
        </div>`).join('')
    : '<div class="empty-state" style="padding:20px">No riders yet.</div>';

  // Revenue bar chart from live data
  const max = Math.max(...REV_DATA, 1);
  document.getElementById('bar-chart').innerHTML = REV_DATA.map((v, i) => `
    <div class="bar-col">
      <div class="bar-val">${v ? '₱' + (v / 1000).toFixed(0) + 'k' : '—'}</div>
      <div class="bar-fill" style="height:${Math.round((v / max) * 80) + 5}px;${i === 6 ? 'background:var(--accent2)' : ''}"></div>
      <div class="bar-label">${REV_DAYS[i]}</div>
    </div>`).join('');
}

// ══════════════════════════════════════════════════════════
//  ORDERS TABLE
// ══════════════════════════════════════════════════════════
function filterOrders(status, el) {
  currentOrderFilter = status;
  document.querySelectorAll('#order-filter-tabs .ftab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  renderOrders();
}
function searchOrders(q) { currentOrderSearch = q.toLowerCase(); renderOrders(); }

async function renderOrders() {
  await loadOrders();
  let list = [...ORDERS];
  if (currentOrderFilter !== 'all') list = list.filter(o => o.status === currentOrderFilter);
  if (currentOrderSearch) list = list.filter(o =>
    o.id.toLowerCase().includes(currentOrderSearch) ||
    o.customer.toLowerCase().includes(currentOrderSearch) ||
    o.email.toLowerCase().includes(currentOrderSearch)
  );
  filteredOrders = list;
  const tbody = document.getElementById('orders-tbody');
  const empty = document.getElementById('orders-empty');
  if (!list.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  tbody.innerHTML = list.map(o => `
    <tr>
      <td>
        <span style="font-family:var(--mono);font-size:11px;color:var(--accent);cursor:pointer" onclick="openOrderModal('${o.id}')">${o.id}</span>
        ${o._live ? '<span style="font-size:9px;color:var(--success);margin-left:4px">●</span>' : ''}
      </td>
      <td><div style="font-weight:600">${o.customer}</div><div style="font-size:11px;color:var(--text3)">${o.email}</div></td>
      <td>${o.items.length} item${o.items.length > 1 ? 's' : ''}</td>
      <td style="font-family:var(--mono)">₱${o.total.toLocaleString()}</td>
      <td>${o.payment}</td>
      <td><span style="font-size:11px;color:var(--accent2)">${o.paymentStatus || (o.payment === 'COD' ? 'To Pay on Delivery' : 'Pending')}</span></td>
      <td>${statusBadge(o.status)}</td>
      <td>${o.riderName ? `<span style="font-size:12px">🏍 ${o.riderName}</span>` : '<span style="color:var(--text3)">—</span>'}</td>
      <td style="font-size:11px;color:var(--text3);white-space:nowrap">${o.date}</td>
      <td><button class="btn btn-ghost btn-xs" onclick="openOrderModal('${o.id}')">View</button></td>
    </tr>`).join('');
}

// ── ORDER MODAL ──
function openOrderModal(id) {
  const o = ORDERS.find(x => x.id === id); if (!o) return;
  document.getElementById('modal-order-id').textContent   = o.id;
  document.getElementById('modal-order-time').textContent = o.date;
  const riderActive = o.riderStep && o.status === 'out_for_delivery';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-section">
      <div class="modal-section-title">Customer Info</div>
      <div class="modal-grid">
        <div class="modal-field"><label>Name</label><span>${o.customer}</span></div>
        <div class="modal-field"><label>Email</label><span>${o.email || '—'}</span></div>
        <div class="modal-field"><label>Phone</label><span>${o.phone || '—'}</span></div>
        <div class="modal-field"><label>Address</label><span>${o.address || '—'}</span></div>
      </div>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Items</div>
      <div class="items-list">
        ${o.items.map(it => `
          <div class="item-row">
            <span class="item-name">${it.emoji || '📦'} ${it.name} × ${it.qty}</span>
            <span class="item-price">₱${(it.price * it.qty).toLocaleString()}</span>
          </div>`).join('')}
      </div>
      <div class="total-row"><span>Payment: ${o.payment}</span><span style="font-size:12px;color:var(--accent2)">${o.paymentStatus || (o.payment === 'COD' ? 'To Pay on Delivery' : 'Pending')}</span></div>
      <div class="total-row"><span>TOTAL</span><span class="total-val">₱${o.total.toLocaleString()}</span></div>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Order Status ${riderActive ? '<span style="font-size:11px;color:var(--accent2);margin-left:8px">🏍 Rider en route</span>' : ''}</div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:10px;padding:12px;background:var(--surface2);border:1px solid var(--border2);border-radius:4px">
        ${statusBadge(o.status)}
        <span style="font-size:12px;color:var(--text3)">Status is managed automatically by the system and rider workflow.</span>
      </div>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Assigned Rider</div>
      <div style="padding:12px;background:var(--surface2);border:1px solid var(--border2);border-radius:4px;font-size:13px">
        ${o.riderName
          ? `<div style="display:flex;align-items:center;gap:8px"><span style="font-size:18px">🏍</span><div><div style="font-weight:600">${o.riderName}</div><div style="color:var(--text3);font-size:11px;font-family:var(--mono)">${o.riderPhone || ''} · ${o.riderPlate || ''}</div></div></div>`
          : `<span style="color:var(--text3)">No rider assigned yet.</span>`}
      </div>
    </div>
    ${o.deliveryPhoto ? `
    <div class="modal-section">
      <div class="modal-section-title">Proof of Delivery</div>
      <div style="border-radius:4px;overflow:hidden;border:1px solid var(--border2)">
        <img src="${o.deliveryPhoto}" style="width:100%;max-height:220px;object-fit:cover;display:block">
      </div>
      <div style="font-size:11px;color:var(--text3);font-family:var(--mono);margin-top:6px">📸 Photo submitted by rider on delivery</div>
    </div>` : ''}
    <div class="modal-actions-bar">
      <button class="btn btn-ghost btn-sm" onclick="closeModal()">Close</button>
    </div>`;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }

// ══════════════════════════════════════════════════════════
//  RIDERS  (Supabase-backed)
// ══════════════════════════════════════════════════════════
let _ridersCache = {};

async function renderRiders() {
  const riders = await db_getRiders();
  const tbody  = document.getElementById('riders-tbody');
  const empty  = document.getElementById('riders-empty');
  _ridersCache = {};
  riders.forEach(r => { _ridersCache[r.id] = r; });
  if (!riders.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  tbody.innerHTML = riders.map(r => `
    <tr>
      <td><div style="font-weight:600">${r.name}</div><div style="font-size:11px;color:var(--text3)">${r.id}</div></td>
      <td>${r.phone || '—'}</td>
      <td>${r.plate || '—'}</td>
      <td><span class="badge ${r.online ? 'badge-online' : 'badge-offline'}">${r.online ? 'ONLINE' : 'OFFLINE'}</span></td>
      <td>${r.currentOrderId ? `<span style="font-family:var(--mono);font-size:11px;color:var(--accent)">${r.currentOrderId}</span>` : '—'}</td>
      <td style="font-size:11px;color:var(--text3)">${r.lastSeen ? new Date(r.lastSeen).toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' }) : '—'}</td>
      <td>
        <button class="btn btn-ghost btn-xs" onclick="openEditRiderModal('${r.id}')" style="margin-right:4px">✏️ Edit</button>
        <button class="btn btn-danger btn-xs" onclick="removeRider('${r.id}','${r.name.replace(/'/g,"\\'")}')">🗑</button>
      </td>
    </tr>`).join('');
}

// ── ADD / EDIT RIDER ─────────────────────────────────────
let _editingRiderId = null;

function openAddRiderModal() {
  _editingRiderId = null;
  document.getElementById('rider-modal-title').textContent = 'Add New Rider';
  ['rider-inp-name','rider-inp-phone','rider-inp-plate','rider-inp-pin'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('rider-inp-pin').readOnly = false;
  document.getElementById('rider-modal-error').classList.add('hidden');
  document.getElementById('rider-modal-overlay').classList.remove('hidden');
}

function openEditRiderModal(riderId) {
  const r = _ridersCache[riderId]; if (!r) return;
  _editingRiderId = r.id;
  document.getElementById('rider-modal-title').textContent = 'Edit Rider';
  document.getElementById('rider-inp-name').value  = r.name  || '';
  document.getElementById('rider-inp-phone').value = r.phone || '';
  document.getElementById('rider-inp-plate').value = r.plate || '';
  document.getElementById('rider-inp-pin').value   = '';   // don't pre-fill PIN
  document.getElementById('rider-inp-pin').placeholder = 'Leave blank to keep current PIN';
  document.getElementById('rider-modal-error').classList.add('hidden');
  document.getElementById('rider-modal-overlay').classList.remove('hidden');
}

function closeRiderModal() {
  document.getElementById('rider-modal-overlay').classList.add('hidden');
  _editingRiderId = null;
}

async function saveRider() {
  const name  = document.getElementById('rider-inp-name').value.trim();
  const phone = document.getElementById('rider-inp-phone').value.trim();
  const plate = document.getElementById('rider-inp-plate').value.trim();
  const pin   = document.getElementById('rider-inp-pin').value.trim();
  const errEl = document.getElementById('rider-modal-error');

  function showErr(msg) { errEl.textContent = '❌ ' + msg; errEl.classList.remove('hidden'); }
  errEl.classList.add('hidden');

  if (!name)  { showErr('Full name is required.'); return; }
  if (!phone) { showErr('Phone number is required.'); return; }
  if (!_editingRiderId && !/^\d{4}$/.test(pin)) {
    showErr('PIN must be exactly 4 digits.'); return;
  }
  if (_editingRiderId && pin && !/^\d{4}$/.test(pin)) {
    showErr('PIN must be exactly 4 digits (or leave blank to keep current).'); return;
  }

  const btn = document.getElementById('rider-save-btn');
  btn.disabled = true; btn.textContent = 'Saving…';

  // Duplicate phone check (skip own record on edit)
  const existing = await db_getRiderByPhone(phone);
  if (existing && existing.id !== _editingRiderId) {
    showErr('This phone number is already used by another rider.');
    btn.disabled = false; btn.textContent = 'Save Rider'; return;
  }

  const sb = getSB();
  if (!sb) { showErr('No database connection. Reload the page and try again.'); btn.disabled = false; btn.textContent = 'Save Rider'; return; }

  const riderId = _editingRiderId || ('rider-' + Date.now());
  const row = {
    id      : riderId,
    name,
    phone,
    plate   : plate || '—',
    online  : false,
    current_order_id: null,
    last_seen: new Date().toISOString(),
  };
  if (pin) row.pin = pin;   // only write pin if provided (edit: blank = keep existing)

  const { error } = await sb.from('ljm_riders').upsert(row, { onConflict: 'id' });
  btn.disabled = false; btn.textContent = 'Save Rider';

  if (error) {
    console.error('[saveRider]', error);
    showErr(error.message || 'Database error. Check console for details.');
    return;
  }

  closeRiderModal();
  renderRiders();
  showToast(_editingRiderId ? 'Rider updated ✓' : 'Rider added — they can now sign in 🏍');
}

async function removeRider(riderId, riderName) {
  if (!confirm(`Remove rider "${riderName}"? They will no longer be able to sign in.`)) return;
  const sb = getSB();
  if (!sb) { showToast('No database connection', 'error'); return; }
  const { error } = await sb.from('ljm_riders').delete().eq('id', riderId);
  if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
  delete _ridersCache[riderId];
  renderRiders();
  showToast('Rider removed ✓');
}

function showAdminToast(msg, type) {
  showToast(msg, type);
}

// ══════════════════════════════════════════════════════════
//  PRODUCTS  (Supabase-backed — no hardcoded BASE_PRODUCTS)
// ══════════════════════════════════════════════════════════
async function loadAdminProducts() {
  adminProducts = await db_getProducts();
  await loadAllStock();
  // If DB is genuinely empty on first run, show an empty state.
  // Products are added by admin via the Add Product form.
}

function switchProdTab(tab) {
  document.querySelectorAll('.prod-subtab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.prodtab').forEach(p => p.classList.remove('active'));
  document.getElementById('subtab-' + tab).classList.add('active');
  document.getElementById('prodtab-' + tab).classList.add('active');
  if (tab === 'products') renderProductGrid();
  if (tab === 'stocks')   renderStockTable();
}

async function renderProducts() {
  await loadAdminProducts();
  renderProductGrid();
}

function filterProducts(cat, el) {
  currentProdFilter = cat;
  document.querySelectorAll('#prod-filter-tabs .ftab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  renderProductGrid();
}

function renderProductGrid() {
  const list = currentProdFilter === 'all' ? adminProducts : adminProducts.filter(p => p.cat === currentProdFilter);
  document.getElementById('products-grid').innerHTML = list.length ? list.map(p => {
    const total = getTotalStock(p.id);
    const { label, color } = stockStatus(total);
    const imgHtml = p.imageUrl
      ? `<div class="prod-card-img"><img src="${p.imageUrl}" alt="${p.name}" onerror="this.parentElement.innerHTML='<div class=\\'prod-emoji\\'>${p.emoji}</div>'"></div>`
      : `<div class="prod-emoji">${p.emoji}</div>`;
    return `
    <div class="prod-card">
      <div class="prod-card-top">
        ${imgHtml}
        ${p.badge ? `<span class="prod-badge-tag prod-badge-${(p.badge || '').toLowerCase()}">${p.badge}</span>` : ''}
        <span class="prod-stock-pill" style="color:${color}">● ${label}</span>
      </div>
      <div class="prod-name">${p.name}</div>
      <div class="prod-meta">${p.cat} · ${p.brand}</div>
      <div class="prod-price">
        ${p.oldPrice ? `<span class="prod-old-price">₱${p.oldPrice.toLocaleString()}</span>` : ''}
        ₱${p.price.toLocaleString()}
      </div>
      <div class="prod-actions">
        <button class="btn btn-ghost btn-xs" onclick="openEditProductModal(${p.id})">✏️ Edit</button>
        <button class="btn btn-danger btn-xs" onclick="removeProduct(${p.id})">🗑 Remove</button>
      </div>
    </div>`;
  }).join('')
    : '<div class="empty-state" style="grid-column:1/-1">No products yet. Click <strong>+ Add Product</strong> to get started.</div>';
}

function openAddProductModal() {
  editingProductId = null;
  document.getElementById('prod-modal-title').textContent = 'Add New Product';
  ['prod-emoji','prod-name','prod-brand','prod-price','prod-old-price','prod-badge','prod-desc'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('prod-cat').value = 'Basketball';
  document.getElementById('prod-sizes').value = CAT_SIZES['Basketball'].join(', ');
  // Reset image
  document.getElementById('prod-img-url').value = '';
  document.getElementById('prod-img-file').value = '';
  document.getElementById('prod-img-status').textContent = '';
  document.getElementById('prod-img-preview').innerHTML = `
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
    <span>Click to upload image</span>
    <span style="font-size:11px;color:var(--text3)">JPG, PNG, WEBP · Max 2MB</span>`;
  document.getElementById('prod-modal-overlay').classList.remove('hidden');
}

function openEditProductModal(id) {
  const p = adminProducts.find(x => x.id === id); if (!p) return;
  editingProductId = id;
  document.getElementById('prod-modal-title').textContent = 'Edit Product';
  document.getElementById('prod-emoji').value     = p.emoji     || '';
  document.getElementById('prod-name').value      = p.name      || '';
  document.getElementById('prod-brand').value     = p.brand     || '';
  document.getElementById('prod-price').value     = p.price     || '';
  document.getElementById('prod-old-price').value = p.oldPrice  || '';
  document.getElementById('prod-badge').value     = p.badge     || '';
  document.getElementById('prod-desc').value      = p.desc      || '';
  document.getElementById('prod-cat').value       = p.cat       || 'Basketball';
  document.getElementById('prod-sizes').value     = (p.sizes && p.sizes.length) ? p.sizes.join(', ') : (CAT_SIZES[p.cat] || ['One Size']).join(', ');
  // Image
  document.getElementById('prod-img-url').value = p.imageUrl || '';
  document.getElementById('prod-img-file').value = '';
  document.getElementById('prod-img-status').textContent = p.imageUrl ? '✓ Image already uploaded' : '';
  if (p.imageUrl) {
    document.getElementById('prod-img-preview').innerHTML = `<img src="${p.imageUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:6px" onerror="this.parentElement.innerHTML='<span>Image unavailable</span>'">`;
  } else {
    document.getElementById('prod-img-preview').innerHTML = `
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      <span>Click to upload image</span>
      <span style="font-size:11px;color:var(--text3)">JPG, PNG, WEBP · Max 2MB</span>`;
  }
  document.getElementById('prod-modal-overlay').classList.remove('hidden');
}

function closeProdModal() {
  document.getElementById('prod-modal-overlay').classList.add('hidden');
  editingProductId = null;
}

async function saveProduct() {
  const name     = document.getElementById('prod-name').value.trim();
  const brand    = document.getElementById('prod-brand').value.trim();
  const priceVal = parseFloat(document.getElementById('prod-price').value);
  const emoji    = document.getElementById('prod-emoji').value.trim() || '📦';
  const cat      = document.getElementById('prod-cat').value;
  const oldPrice = parseFloat(document.getElementById('prod-old-price').value) || null;
  const badge    = document.getElementById('prod-badge').value || null;
  const desc     = document.getElementById('prod-desc').value.trim();
  const imageUrl = document.getElementById('prod-img-url').value || null;

  if (!name)           { showToast('Product name is required', 'error'); return; }
  if (isNaN(priceVal)) { showToast('Enter a valid price', 'error'); return; }

  const btn = document.getElementById('prod-save-btn');
  btn.disabled = true; btn.textContent = 'Saving…';

  let id = editingProductId;
  if (id === null) {
    id = (adminProducts.length ? Math.max(...adminProducts.map(p => p.id)) : 0) + 1;
  }

  // Parse sizes from the form field; fall back to CAT_SIZES default for new products
  const rawSizes = document.getElementById('prod-sizes').value;
  const parsedSizes = rawSizes.trim()
    ? rawSizes.split(',').map(s => s.trim()).filter(Boolean)
    : (CAT_SIZES[cat] || ['One Size']);
  // When editing, preserve existing sizes if field was left unchanged
  const existingProduct = adminProducts.find(x => x.id === id);
  const finalSizes = (editingProductId !== null && existingProduct && parsedSizes.join(',') === (CAT_SIZES[cat] || ['One Size']).join(','))
    ? (existingProduct.sizes && existingProduct.sizes.length ? existingProduct.sizes : parsedSizes)
    : parsedSizes;
  await db_upsertProduct({ id, emoji, name, brand, cat, price: priceVal, oldPrice, badge, desc, sizes: finalSizes, imageUrl });
  btn.disabled = false; btn.textContent = '💾 Save Product';
  showToast(editingProductId ? `${name} updated ✓` : `${name} added ✓`);
  closeProdModal();
  await loadAdminProducts();
  renderProductGrid();
}

async function removeProduct(id) {
  const p = adminProducts.find(x => x.id === id); if (!p) return;
  if (!confirm(`Remove "${p.name}"? This cannot be undone.`)) return;
  await db_deleteProduct(id);
  adminProducts = adminProducts.filter(x => x.id !== id);
  renderProductGrid();
  showToast(`${p.name} removed`);
}

// ── IMAGE UPLOAD (Supabase Storage) ─────────────────────
async function onProdImageSelected(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('Image must be under 2MB', 'error'); input.value = ''; return; }

  const statusEl  = document.getElementById('prod-img-status');
  const previewEl = document.getElementById('prod-img-preview');
  statusEl.textContent = '⏳ Uploading…';
  statusEl.style.color = 'var(--accent)';

  const sb = getSB();
  if (!sb) { statusEl.textContent = '❌ No database connection'; statusEl.style.color = 'var(--danger)'; return; }

  const ext      = file.name.split('.').pop();
  const fileName = `product-${Date.now()}.${ext}`;

  const { data, error } = await sb.storage.from('product-images').upload(fileName, file, { upsert: true, contentType: file.type });

  if (error) {
    console.error('[IMG] upload error', error);
    statusEl.textContent = '❌ Upload failed: ' + (error.message || 'Check Supabase Storage bucket "product-images" exists and is public.');
    statusEl.style.color = 'var(--danger)';
    return;
  }

  const { data: urlData } = sb.storage.from('product-images').getPublicUrl(data.path);
  const publicUrl = urlData.publicUrl;
  document.getElementById('prod-img-url').value = publicUrl;
  previewEl.innerHTML = `<img src="${publicUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:6px">`;
  statusEl.textContent = '✓ Image uploaded successfully';
  statusEl.style.color = 'var(--success)';
}

// ── STOCKS (Supabase ljm_stock) ──────────────────────────
let currentStockProductId = null;

function renderStockTable(search = '') {
  const list = adminProducts.filter(p =>
    !search || p.name.toLowerCase().includes(search) || p.cat.toLowerCase().includes(search) || p.brand.toLowerCase().includes(search)
  );
  const outOfStock = adminProducts.filter(p => getTotalStock(p.id) === 0).length;
  const lowStock   = adminProducts.filter(p => { const t = getTotalStock(p.id); return t > 0 && t <= 5; }).length;
  document.getElementById('stock-summary').textContent = `${adminProducts.length} products · ${outOfStock} out of stock · ${lowStock} low stock`;
  document.getElementById('stock-tbody').innerHTML = list.map(p => {
    const total = getTotalStock(p.id);
    const { label, color } = stockStatus(total);
    return `<tr>
      <td><span style="font-size:18px">${p.imageUrl ? `<img src="${p.imageUrl}" style="width:28px;height:28px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-right:4px">` : p.emoji}</span> <strong>${p.name}</strong></td>
      <td>${p.cat}</td><td>${p.brand}</td>
      <td style="font-family:var(--mono)">₱${p.price.toLocaleString()}</td>
      <td style="font-family:var(--mono);font-weight:700">${total}</td>
      <td><span style="font-family:var(--mono);font-size:11px;font-weight:700;color:${color}">● ${label}</span></td>
      <td><button class="btn btn-accent btn-xs" onclick="openStockModal(${p.id})">Manage Stock</button></td>
    </tr>`;
  }).join('');
}

function filterStockList(q) { renderStockTable(q.toLowerCase()); }

function openStockModal(productId) {
  const p = adminProducts.find(x => x.id === productId); if (!p) return;
  currentStockProductId = productId;
  const sizes = (p.sizes && p.sizes.length) ? p.sizes : (CAT_SIZES[p.cat] || ['One Size']);
  const sizeStock = getProductStock(productId);
  const total = getTotalStock(productId);
  const { label, color } = stockStatus(total);
  document.getElementById('stock-modal-title').textContent    = `${p.imageUrl ? '' : p.emoji + ' '}${p.name}`;
  document.getElementById('stock-modal-sub').textContent      = `${p.brand} · ${p.cat} · ₱${p.price.toLocaleString()}`;
  document.getElementById('stock-total-display').textContent  = `${total} units`;
  document.getElementById('stock-total-display').style.color  = color;
  document.getElementById('stock-sizes-wrap').innerHTML = sizes.map(size => {
    const qty = sizeStock[size] ?? 0;
    const sc  = qty === 0 ? 'var(--danger)' : qty <= 3 ? 'var(--accent2)' : 'var(--success)';
    return `<div class="stock-row">
      <div class="stock-size-lbl">Size ${size}</div>
      <div class="stock-qty-ctrl">
        <button class="qty-ctrl-btn" onclick="adjustStock(${productId},'${size}',-1)">−</button>
        <input class="stock-qty-inp" id="sinp-${productId}-${size.replace(/[^a-z0-9]/gi,'_')}" type="number" min="0" value="${qty}" oninput="onStockInput(${productId},'${size}',this)">
        <button class="qty-ctrl-btn" onclick="adjustStock(${productId},'${size}',1)">+</button>
      </div>
      <span class="stock-status-lbl" id="sst-${productId}-${size.replace(/[^a-z0-9]/gi,'_')}" style="color:${sc}">${qty===0?'Out':qty<=3?'Low':'OK'}</span>
    </div>`;
  }).join('');
  document.getElementById('stock-modal-overlay').classList.remove('hidden');
}

function adjustStock(productId, size, delta) {
  const key = `sinp-${productId}-${size.replace(/[^a-z0-9]/gi,'_')}`;
  const input = document.getElementById(key); if (!input) return;
  input.value = Math.max(0, (parseInt(input.value) || 0) + delta);
  onStockInput(productId, size, input);
}

function onStockInput(productId, size, input) {
  const qty = Math.max(0, parseInt(input.value) || 0);
  input.value = qty;
  const sc = qty === 0 ? 'var(--danger)' : qty <= 3 ? 'var(--accent2)' : 'var(--success)';
  input.style.borderColor = sc;
  const lbl = document.getElementById(`sst-${productId}-${size.replace(/[^a-z0-9]/gi,'_')}`);
  if (lbl) { lbl.style.color = sc; lbl.textContent = qty === 0 ? 'Out' : qty <= 3 ? 'Low' : 'OK'; }
  const p = adminProducts.find(x => x.id === productId); if (!p) return;
  const sizes = (p.sizes && p.sizes.length) ? p.sizes : (CAT_SIZES[p.cat] || ['One Size']);
  let runTotal = 0;
  sizes.forEach(s => {
    const inp = document.getElementById(`sinp-${productId}-${s.replace(/[^a-z0-9]/gi,'_')}`);
    runTotal += inp ? (parseInt(inp.value) || 0) : (getProductStock(productId)[s] || 0);
  });
  const { color } = stockStatus(runTotal);
  document.getElementById('stock-total-display').textContent = `${runTotal} units`;
  document.getElementById('stock-total-display').style.color = color;
}

function setAllSizes() {
  const val = prompt('Enter quantity to set for ALL sizes:');
  if (val === null || val.trim() === '') return;
  const qty = Math.max(0, parseInt(val) || 0);
  const p = adminProducts.find(x => x.id === currentStockProductId); if (!p) return;
  const setSizes = (p.sizes && p.sizes.length) ? p.sizes : (CAT_SIZES[p.cat] || ['One Size']);
  setSizes.forEach(size => {
    const inp = document.getElementById(`sinp-${currentStockProductId}-${size.replace(/[^a-z0-9]/gi,'_')}`);
    if (inp) { inp.value = qty; onStockInput(currentStockProductId, size, inp); }
  });
}

async function saveStock() {
  const p = adminProducts.find(x => x.id === currentStockProductId); if (!p) return;
  const sizes = (p.sizes && p.sizes.length) ? p.sizes : (CAT_SIZES[p.cat] || ['One Size']);
  const stockObj = {};
  sizes.forEach(size => {
    const inp = document.getElementById(`sinp-${currentStockProductId}-${size.replace(/[^a-z0-9]/gi,'_')}`);
    stockObj[size] = Math.max(0, parseInt(inp?.value) || 0);
  });

  const btn = document.querySelector('#stock-modal .btn-accent');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  const ok = await db_saveProductStock(currentStockProductId, stockObj);

  if (btn) { btn.disabled = false; btn.textContent = '💾 Save Stock'; }

  if (!ok) { showToast('Failed to save stock. Check console.', 'error'); return; }

  // Update local cache
  _stockCache[currentStockProductId] = stockObj;

  closeStockModal();
  renderStockTable();
  renderProductGrid();
  showToast(`Stock updated for ${p.name} ✓`);
}

function closeStockModal() {
  document.getElementById('stock-modal-overlay').classList.add('hidden');
  currentStockProductId = null;
}

// ══════════════════════════════════════════════════════════
//  CUSTOMERS  (built from Supabase orders + users)
// ══════════════════════════════════════════════════════════
async function buildCustomers() {
  const shopUsers = await db_getUsers();
  const map = {};
  ORDERS.forEach(o => {
    const email = o.email || o.userEmail; if (!email) return;
    if (!map[email]) map[email] = { name: o.customer, email, phone: o.phone || '', orders: 0, spent: 0 };
    map[email].orders++;
    map[email].spent += o.total || 0;
  });
  shopUsers.forEach(u => {
    if (!map[u.email]) map[u.email] = { name: u.name || u.email, email: u.email, phone: u.phone || '—', orders: 0, spent: 0 };
    else if (u.phone) map[u.email].phone = u.phone;
    if (u.status) map[u.email]._status = u.status;
  });
  allCustomers = Object.values(map);
}

function searchCustomers(q) {
  const s = q.toLowerCase();
  filteredCustomers = allCustomers.filter(c => c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s));
  renderCustomerTable();
}

async function renderCustomers() {
  await loadOrders();
  await buildCustomers();
  filteredCustomers = [...allCustomers];
  renderCustomerTable();
}

function renderCustomerTable() {
  const tbody = document.getElementById('customers-tbody');
  const empty = document.getElementById('customers-empty');
  if (!filteredCustomers.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  tbody.innerHTML = filteredCustomers.map(c => {
    const status = customerStatuses[c.email]?.status || c._status || 'active';
    return `<tr>
      <td style="font-weight:600">${c.name}</td>
      <td style="font-size:12px">${c.email}</td>
      <td style="font-size:12px">${c.phone || '—'}</td>
      <td>${c.orders}</td>
      <td style="font-family:var(--mono)">₱${c.spent.toLocaleString()}</td>
      <td><span class="badge ${status === 'active' ? 'badge-online' : 'badge-cancelled'}">${status.toUpperCase()}</span></td>
      <td><button class="btn btn-ghost btn-xs" onclick="openCustModal('${c.email}')">View</button></td>
    </tr>`;
  }).join('');
}

function openCustModal(email) {
  const c = allCustomers.find(x => x.email === email); if (!c) return;
  currentCustomerEmail = email;
  document.getElementById('cust-modal-name').textContent = c.name;
  const cs     = customerStatuses[email] || { status: c._status || 'active' };
  const orders = ORDERS.filter(o => o.email === email || o.userEmail === email);
  document.getElementById('cust-modal-body').innerHTML = `
    <div class="modal-section">
      <div class="modal-grid">
        <div class="modal-field"><label>Email</label><span>${c.email}</span></div>
        <div class="modal-field"><label>Phone</label><span>${c.phone || '—'}</span></div>
        <div class="modal-field"><label>Orders</label><span>${c.orders}</span></div>
        <div class="modal-field"><label>Total Spent</label><span style="color:var(--accent);font-family:var(--mono)">₱${c.spent.toLocaleString()}</span></div>
      </div>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Account Status</div>
      <select class="status-select" id="cust-status-select">
        <option value="active"  ${cs.status === 'active'  ? 'selected' : ''}>Active</option>
        <option value="flagged" ${cs.status === 'flagged' ? 'selected' : ''}>Flagged</option>
        <option value="blocked" ${cs.status === 'blocked' ? 'selected' : ''}>Blocked</option>
      </select>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Recent Orders</div>
      ${orders.slice(0, 5).map(o => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
          <span style="font-family:var(--mono);color:var(--accent)">${o.id}</span>
          <span>${o.date}</span>
          <span>${statusBadge(o.status)}</span>
        </div>`).join('')}
    </div>
    <div class="modal-actions-bar">
      <button class="btn btn-accent btn-sm" onclick="saveCustStatus()">Save</button>
      <button class="btn btn-ghost btn-sm" onclick="closeCustModal()">Cancel</button>
    </div>`;
  document.getElementById('cust-modal-overlay').classList.remove('hidden');
}

async function saveCustStatus() {
  const status = document.getElementById('cust-status-select')?.value;
  if (!currentCustomerEmail || !status) return;
  customerStatuses[currentCustomerEmail] = { status, updatedAt: new Date().toISOString() };
  await db_updateUserStatus(currentCustomerEmail, status);
  closeCustModal();
  renderCustomerTable();
  showToast('Customer status updated');
}

function closeCustModal() { document.getElementById('cust-modal-overlay').classList.add('hidden'); }

// ══════════════════════════════════════════════════════════
//  FEEDBACKS  (Supabase-backed — no demo fallback)
// ══════════════════════════════════════════════════════════
function filterFeedbacks(type, el) {
  document.querySelectorAll('#page-feedbacks .ftab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  filteredFeedbacks = type === 'all' ? [...allFeedbacks] : allFeedbacks.filter(f => f.type === type);
  renderFeedbackList();
}

async function renderFeedbacks() {
  allFeedbacks = await db_getFeedbacks();
  filteredFeedbacks = [...allFeedbacks];
  renderFeedbackList();
}

function renderFeedbackList() {
  const wrap  = document.getElementById('feedbacks-list');
  const empty = document.getElementById('feedbacks-empty');
  if (!filteredFeedbacks.length) { wrap.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  wrap.innerHTML = filteredFeedbacks.map(f => `
    <div class="feedback-card">
      <div class="fb-header">
        <div><div class="fb-customer">${f.customer}</div><div class="fb-order">${f.orderId} · ${f.date}</div></div>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="fb-type">${f.type.toUpperCase()}</span>
          <span class="fb-stars">${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}</span>
        </div>
      </div>
      <div class="fb-comment">"${f.comment}"</div>
    </div>`).join('');
}

// ══════════════════════════════════════════════════════════
//  PAYMENTS  (Supabase-backed — no hardcoded defaults)
// ══════════════════════════════════════════════════════════
async function renderPayments() {
  allPayments = await db_getPayments();
  if (!allPayments.length) {
    document.getElementById('payments-list').innerHTML = '<div class="empty-state">No payment methods found. Check your Supabase ljm_payments table.</div>';
    return;
  }
  document.getElementById('payments-list').innerHTML = allPayments.map(p => `
    <div class="pay-method-row">
      <div class="pay-icon">${p.icon}</div>
      <div class="pay-label">${p.label}</div>
      <label class="toggle-wrap">
        <input type="checkbox" ${p.status === 'active' ? 'checked' : ''} onchange="togglePayment('${p.id}',this.checked)">
        <span class="toggle-slider"></span>
      </label>
      <span class="pay-status-label" style="font-size:11px;color:${p.status === 'active' ? 'var(--success)' : 'var(--muted)'}">${p.status === 'active' ? 'Enabled' : 'Disabled'}</span>
    </div>`).join('');
}

async function togglePayment(id, enabled) {
  const status = enabled ? 'active' : 'inactive';
  await db_updatePayment(id, status);
  const p = allPayments.find(x => x.id === id);
  if (p) p.status = status;
  renderPayments();
  showToast(`${id} ${enabled ? 'enabled' : 'disabled'}`);
}

// ══════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════
function statusBadge(s) {
  const cls = {'pending':'badge-pending','processing':'badge-processing','out_for_delivery':'badge-ofd','shipped':'badge-ofd','delivered':'badge-delivered','cancelled':'badge-cancelled'};
  return `<span class="badge ${cls[s] || ''}">${statusLabel(s)}</span>`;
}
function statusLabel(s) {
  return { pending:'Pending', processing:'Processing', out_for_delivery:'Shipped', shipped:'Shipped', delivered:'Delivered', cancelled:'Cancelled' }[s] || s;
}
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.borderLeftColor = type === 'info' ? 'var(--info)' : type === 'error' ? 'var(--danger)' : 'var(--accent)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
function startClock() {
  const el = document.getElementById('time-display');
  if (!el) return;
  function tick() { el.textContent = new Date().toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit', second:'2-digit' }); }
  tick();
  setInterval(tick, 1000);
}