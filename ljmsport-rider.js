// ════════════════════════════════════════════════════════
//  LJMSPORT RIDER  — Supabase Edition  v3.0
//  NEW in v3:
//    • Real-time rider GPS tracking (broadcasts to Supabase)
//    • Live map tab: rider position + all delivery pins
//    • Misamis Occidental–biased geocoding (Nominatim)
//    • Route line from rider → delivery address
//    • Customer can see rider position live (via ljm_riders lat/lng)
//    • Full-screen order map modal with directions
//  Requires: ljmsport-supabase.js loaded first
//
//  ┌─ SUPABASE: run this SQL once to add GPS columns ───────┐
//  │  alter table ljm_riders                                 │
//  │    add column if not exists lat      double precision,  │
//  │    add column if not exists lng      double precision,  │
//  │    add column if not exists accuracy integer;           │
//  └────────────────────────────────────────────────────────┘
// ════════════════════════════════════════════════════════

// ── RIDER STATE ──
const LS_RIDER_SESSION = 'ljmRiderSession';
let rider               = JSON.parse(localStorage.getItem(LS_RIDER_SESSION) || 'null');
let isOnline            = true;

// Multi-order support
let activeOrders        = {};   // { [orderId]: { order, step } }
let completedDeliveries = [];
let currentSheetOrder   = null;
let _unsubOrders        = null;

// ── MISAMIS OCCIDENTAL BOUNDS (for geocoding bias) ──
// bbox: west, south, east, north
const MIS_OCC_BBOX   = '123.3,7.8,124.5,8.8';
const MIS_OCC_CENTER = [8.3333, 123.9500]; // approx centre
const MIS_OCC_ZOOM   = 11;

// ── GPS / TRACKING STATE ──
let _riderLat       = null;
let _riderLng       = null;
let _gpsWatchId     = null;          // navigator.geolocation.watchPosition id
let _gpsInterval    = null;          // fallback polling interval
let _gpsLastPush    = 0;             // timestamp of last Supabase push

// ── MAP INSTANCES ──
let _mainMap        = null;
let _mainMapMarkers = {};            // orderId → L.Marker
let _riderMarker    = null;          // live rider dot on main map
let _routeLines     = {};            // orderId → L.Polyline

// ── GEOCODE CACHE ──
const _geocodeCache = {};

// ════════════════════════════════════════════════════════
//  SIGN IN
// ════════════════════════════════════════════════════════
async function riderSignIn() {
  const phone = document.getElementById('si-phone').value.trim();
  const pin   = document.getElementById('si-pin').value.trim();
  if (!phone) { showToast('Enter your phone number', 'error'); return; }
  if (!pin)   { showToast('Enter your PIN', 'error'); return; }
  const btn = document.getElementById('signin-btn');
  btn.disabled = true; btn.textContent = 'Signing in…';
  const riderRow = await db_authenticateRider(phone, pin);
  if (!riderRow) {
    showToast('Phone or PIN is incorrect', 'error');
    btn.disabled = false; btn.textContent = 'START SHIFT →';
    return;
  }
  rider = {
    id   : riderRow.id,
    name : riderRow.name,
    phone: riderRow.phone,
    plate: riderRow.plate || '—',
    since: riderRow.last_seen || new Date().toISOString(),
  };
  localStorage.setItem(LS_RIDER_SESSION, JSON.stringify(rider));
  btn.disabled = false; btn.textContent = 'START SHIFT →';
  bootApp();
}

// ════════════════════════════════════════════════════════
//  SIGN OUT
// ════════════════════════════════════════════════════════
async function riderLogout() {
  if (!confirm('Sign out and end your shift?')) return;
  if (rider) await db_setRiderOnline(rider.id, false);
  stopGPS();
  if (_unsubOrders) _unsubOrders();
  rider = null; activeOrders = {}; completedDeliveries = [];
  localStorage.removeItem(LS_RIDER_SESSION);
  document.getElementById('app-screen').classList.remove('active');
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('si-phone').value = '';
  document.getElementById('si-pin').value   = '';
}

// ════════════════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════════════════
async function bootApp() {
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('app-screen').classList.add('active');
  const initials = rider.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('rider-avatar').textContent       = initials;
  document.getElementById('rider-name-display').textContent = rider.name;

  await db_upsertRider({
    id: rider.id, name: rider.name, phone: rider.phone,
    plate: rider.plate, online: true, currentOrderId: null,
  });

  await restoreActiveOrders();
  await loadCompletedDeliveries();

  startRealtimeSync();
  startGPS();          // ← NEW: begin GPS tracking
  refreshQueue();
  renderActive();
  renderHistory();
  renderEarnings();
  startHeartbeat();
}

// ════════════════════════════════════════════════════════
//  GPS TRACKING  — broadcasts lat/lng to Supabase
// ════════════════════════════════════════════════════════

/**
 * Start watching rider position.
 * Uses watchPosition for continuous updates; pushes to Supabase
 * at most every 10 seconds to avoid rate-limiting.
 * Falls back to manual polling every 15 s if watchPosition is unavailable.
 */
function startGPS() {
  if (!navigator.geolocation) {
    console.warn('[GPS] Geolocation not supported on this device.');
    return;
  }

  const opts = { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 };

  _gpsWatchId = navigator.geolocation.watchPosition(
    pos => _onGPSUpdate(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
    err => {
      console.warn('[GPS] watchPosition error:', err.message);
      // Fallback: try a single fix then poll
      _startGPSPolling();
    },
    opts
  );
}

function stopGPS() {
  if (_gpsWatchId != null) {
    navigator.geolocation.clearWatch(_gpsWatchId);
    _gpsWatchId = null;
  }
  if (_gpsInterval) { clearInterval(_gpsInterval); _gpsInterval = null; }
}

function _startGPSPolling() {
  if (_gpsInterval) return;
  _gpsInterval = setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      pos => _onGPSUpdate(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
      () => {},
      { enableHighAccuracy: false, maximumAge: 20000, timeout: 10000 }
    );
  }, 15000);
}

async function _onGPSUpdate(lat, lng, accuracy) {
  _riderLat = lat; _riderLng = lng;

  // Update GPS banner in map tab
  const banner = document.getElementById('gps-live-banner');
  const bannerText = document.getElementById('gps-live-text');
  if (banner && bannerText) {
    banner.classList.remove('no-gps');
    const accText = accuracy ? ` ±${Math.round(accuracy)}m` : '';
    bannerText.textContent = `● Live GPS · ${lat.toFixed(5)}, ${lng.toFixed(5)}${accText}`;
  }

  // Update rider marker on the live map
  _updateRiderMarkerOnMap(lat, lng);

  // Push to Supabase at most every 10 s
  const now = Date.now();
  if (now - _gpsLastPush < 10000) return;
  _gpsLastPush = now;

  if (!rider) return;
  try {
    const sb = await getSBAsync();
    if (!sb) return;
    await sb.from('ljm_riders')
      .update({
        lat       : lat,
        lng       : lng,
        accuracy  : accuracy ? Math.round(accuracy) : null,
        last_seen : new Date().toISOString(),
      })
      .eq('id', rider.id);
  } catch (e) { /* silent */ }
}

// ════════════════════════════════════════════════════════
//  RESTORE + LOAD
// ════════════════════════════════════════════════════════
async function restoreActiveOrders() {
  const orders = await db_getOrders();
  const mine = orders.filter(o =>
    o.riderId === rider?.id &&
    (o.status === 'out_for_delivery' || o.status === 'processing')
  );
  activeOrders = {};
  for (const o of mine) {
    activeOrders[o.id] = { order: o, step: 0 };
  }
}

async function loadCompletedDeliveries() {
  const orders = await db_getOrders();
  completedDeliveries = orders
    .filter(o => o.riderId === rider?.id && o.status === 'delivered')
    .map(o => ({ ...o, fee: Math.round((o.total || 0) * 0.08), completedAt: o.date }));
}

// ════════════════════════════════════════════════════════
//  RIDER REGISTRY
// ════════════════════════════════════════════════════════
async function registerRider() {
  if (!rider) return;
  await db_upsertRider({
    id: rider.id, name: rider.name, phone: rider.phone,
    plate: rider.plate, online: isOnline,
    currentOrderId: Object.keys(activeOrders)[0] || null,
  });
}

async function setOnlineInRegistry(online) {
  if (!rider) return;
  await db_setRiderOnline(rider.id, online);
}

// ════════════════════════════════════════════════════════
//  ORDER HELPERS
// ════════════════════════════════════════════════════════
let _cachedOrders = [];
async function fetchOrders() { _cachedOrders = await db_getOrders(); return _cachedOrders; }
function getCachedOrders() { return _cachedOrders; }

function getCustomerName(o) {
  const s = o.shipping || {};
  return [s.fname, s.lname].filter(Boolean).join(' ') || o.userEmail || 'Customer';
}
function getAddress(o) {
  const s = o.shipping || {};
  // Show full address including purok for the rider display
  const parts = [];
  if (s.address) parts.push(s.address);       // House No./Street + Purok + Brgy. (flat)
  else {
    const street = s.street || '';
    const purok  = s.purok  || '';
    const brgy   = s.barangay ? 'Brgy. ' + s.barangay : '';
    [street, purok, brgy].filter(Boolean).forEach(p => parts.push(p));
  }
  if (s.city)         parts.push(s.city);
  else if (s.municipality) parts.push(s.municipality + ', Misamis Occidental');
  return parts.join(', ') || '—';
}

/**
 * Build a Nominatim-friendly geocode query from order shipping fields.
 * Key rules:
 *  - NO "Barangay" prefix — OSM stores places by bare name (e.g. "Carangan")
 *  - NO Purok — OSM has no purok data; it breaks geocoding
 *  - Always fall back to municipality if barangay lookup fails
 */
function buildGeoQuery(o) {
  const s = o.shipping || {};

  // Extract municipality — prefer explicit field, fall back to city string
  const municipality = s.municipality
    || (s.city || '').replace(/,?\s*Misamis Occidental/i, '').trim();

  // Extract barangay — prefer explicit field, then parse from flat address
  let barangay = s.barangay || '';
  if (!barangay && s.address) {
    const m = s.address.match(/Brgy\.?\s+([^,]+)/i)
           || s.address.match(/Barangay\s+([^,]+)/i);
    if (m) barangay = m[1].trim();
  }

  if (municipality && barangay) {
    // Bare name — what OSM actually indexes
    // e.g. "Carangan, Ozamiz City, Misamis Occidental, Philippines"
    return `${barangay}, ${municipality}, Misamis Occidental, Philippines`;
  }

  if (municipality) {
    // Pin to city/municipality at minimum
    return `${municipality}, Misamis Occidental, Philippines`;
  }

  // Last resort — strip purok/brgy prefixes from flat address
  const flatAddr = (s.address || '')
    .replace(/Purok\s*\d+\s*,?\s*/gi, '')
    .replace(/Prk\.?\s*\d+\s*,?\s*/gi, '')
    .replace(/Brgy\.?\s*/gi, '')
    .trim().replace(/^,\s*/, '');
  return (flatAddr ? flatAddr + ', Philippines' : 'Misamis Occidental, Philippines');
}

// ════════════════════════════════════════════════════════
//  REAL-TIME SYNC
// ════════════════════════════════════════════════════════
function startRealtimeSync() {
  if (_unsubOrders) _unsubOrders();
  _unsubOrders = db_subscribe('orders', async (payload) => {
    await onOrdersChange(payload);
  });
  db_subscribe('riders', async () => { await registerRider(); });
  const dot = document.getElementById('sync-dot');
  if (dot) dot.classList.remove('offline');
}

async function onOrdersChange(payload) {
  await fetchOrders();
  if (isOnline) refreshQueue();
  const orders = getCachedOrders();

  for (const o of orders) {
    if (
      o.riderId === rider?.id &&
      (o.status === 'out_for_delivery' || o.status === 'processing') &&
      !activeOrders[o.id]
    ) {
      activeOrders[o.id] = { order: { ...o, status: 'out_for_delivery' }, step: 0 };
      showToast('New order assigned: ' + o.id, 'success');
      renderActive();
      refreshMapLive();
      const tabEl = document.getElementById('tab-active');
      if (tabEl) { tabEl.classList.add('pulse'); setTimeout(() => tabEl.classList.remove('pulse'), 2000); }
    }
  }

  for (const orderId of Object.keys(activeOrders)) {
    const live = orders.find(o => o.id === orderId);
    if (live && live.status === 'delivered') {
      const entry = activeOrders[orderId];
      const fee = Math.round((entry.order.total || 0) * 0.08);
      completedDeliveries.push({ ...entry.order, fee, completedAt: new Date().toISOString() });
      delete activeOrders[orderId];
      renderActive(); renderHistory(); renderEarnings(); refreshQueue();
      refreshMapLive();
      updateEarningsChip();
    }
  }
}

function startHeartbeat() {
  setInterval(() => registerRider(), 30_000);
}

// ════════════════════════════════════════════════════════
//  STATUS + TAB
// ════════════════════════════════════════════════════════
async function toggleStatus() {
  isOnline = !isOnline;
  await setOnlineInRegistry(isOnline);
  const lbl = document.getElementById('rider-status-label');
  const btn = document.getElementById('toggle-btn');
  const notice = document.getElementById('offline-notice');
  const dot = document.getElementById('sync-dot');
  if (isOnline) {
    lbl.textContent = '● ONLINE'; lbl.classList.remove('offline');
    btn.textContent = 'Go Offline';
    notice.classList.add('hidden');
    if (dot) dot.classList.remove('offline');
    await refreshQueue();
  } else {
    lbl.textContent = '● OFFLINE'; lbl.classList.add('offline');
    btn.textContent = 'Go Online';
    notice.classList.remove('hidden');
    document.getElementById('queue-list').innerHTML = '';
    document.getElementById('queue-empty').classList.add('hidden');
    document.getElementById('queue-badge').textContent = '0';
    if (dot) dot.classList.add('offline');
  }
}

function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
  // Lock #content scroll only on the Active tab so the carousel fills height cleanly
  const content = document.getElementById('content');
  if (tab === 'active') content.classList.add('lock-scroll');
  else content.classList.remove('lock-scroll');
  if (tab === 'queue')    refreshQueue();
  if (tab === 'active')   renderActive();
  if (tab === 'history')  renderHistory();
  if (tab === 'earnings') renderEarnings();
  if (tab === 'map')      setTimeout(() => renderMapTab(), 50);
}

// ════════════════════════════════════════════════════════
//  QUEUE
// ════════════════════════════════════════════════════════
async function refreshQueue() {
  if (!isOnline) return;
  const orders = await fetchOrders();
  const myActiveIds = Object.keys(activeOrders);
  const open = orders.filter(o =>
    (o.status === 'pending' || o.status === 'processing') &&
    !o.riderId && !myActiveIds.includes(o.id)
  );
  const adminAssigned = orders.filter(o =>
    o.riderId === rider?.id && o.status === 'out_for_delivery' && !myActiveIds.includes(o.id)
  );
  const all = [...adminAssigned, ...open];
  const queueList  = document.getElementById('queue-list');
  const queueEmpty = document.getElementById('queue-empty');
  const badge      = document.getElementById('queue-badge');
  badge.textContent = all.length;
  if (!all.length) { queueList.innerHTML = ''; queueEmpty.classList.remove('hidden'); return; }
  queueEmpty.classList.add('hidden');
  queueList.innerHTML = all.map(o => {
    const name  = getCustomerName(o);
    const addr  = getAddress(o);
    const time  = o.date ? new Date(o.date).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—';
    const isMine = o.riderId === rider?.id;
    const statusColor = isMine ? 'var(--warn)' : 'var(--accent)';
    const statusLabel = isMine ? 'ASSIGNED TO YOU' : o.status === 'pending' ? 'PENDING' : 'PROCESSING';
    return `
      <div class="order-card" onclick="openSheet('${o.id}')" style="border-left-color:${statusColor}">
        <div class="order-card-header">
          <div class="order-card-id">${o.id}</div>
          <div style="font-family:var(--mono);font-size:10px;color:${statusColor}">${statusLabel}</div>
          <div class="order-card-time">${time}</div>
        </div>
        <div class="order-card-customer">${name}</div>
        <div class="order-card-address">${addr}</div>
        <div class="order-card-footer">
          <div class="order-card-total">₱${(o.total || 0).toLocaleString()}</div>
          <div class="order-card-items">${(o.items || []).length} item(s) · ${(o.payment || '').toUpperCase()}</div>
        </div>
      </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════════
//  BOTTOM SHEET
// ════════════════════════════════════════════════════════
async function openSheet(orderId) {
  const orders = await fetchOrders();
  const o = orders.find(x => x.id === orderId);
  if (!o) return;
  currentSheetOrder = o;
  document.getElementById('sheet-order-id').textContent  = o.id;
  const time = o.date ? new Date(o.date).toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  document.getElementById('sheet-order-time').textContent = time;
  const name  = getCustomerName(o);
  const addr  = getAddress(o);
  const phone = (o.shipping && o.shipping.phone) || '—';

  const itemCount   = (o.items || []).length;
  const itemSummary = itemCount === 1
    ? `${o.items[0].name} ×${o.items[0].qty || 1}`
    : `${itemCount} items`;
  document.getElementById('sheet-body').innerHTML = `
    <div class="sheet-quick-row">
      <div class="sheet-quick-cell">
        <div class="sheet-label">Customer</div>
        <div class="sheet-value sheet-value--sm">${name}</div>
        <div class="sheet-sub">${phone}</div>
      </div>
      <div class="sheet-quick-cell sheet-quick-cell--right">
        <div class="sheet-label">Payment</div>
        <div class="sheet-pay-badge sheet-pay-badge--${(o.payment||'').toLowerCase()}">${(o.payment || '').toUpperCase()}</div>
      </div>
    </div>
    <div class="sheet-addr-row">
      <div class="sheet-label">Delivery Address</div>
      <div class="sheet-value sheet-value--sm">${addr}</div>
    </div>
    <div class="sheet-totals-row">
      <div>
        <div class="sheet-label">Items</div>
        <div class="sheet-sub">${itemSummary}</div>
      </div>
      <div class="sheet-total-inline">
        <span class="sheet-total-label">TOTAL</span>
        <span class="sheet-total-amount">₱${(o.total || 0).toLocaleString()}</span>
      </div>
    </div>
    <div id="sheet-map-container" class="sheet-map-compact"></div>
    <a id="sheet-osm-link" href="#" target="_blank" rel="noopener" class="sheet-osm-link">
      ↗ Open in OpenStreetMap
    </a>
  `;

  const alreadyMine = !!activeOrders[o.id];
  document.getElementById('sheet-actions').innerHTML = alreadyMine
    ? `<button class="btn btn-primary" style="flex:1" onclick="closeSheet();switchTab('active')">View Active →</button>`
    : `<button class="btn btn-primary" style="flex:1" onclick="acceptOrder('${o.id}')">ACCEPT DELIVERY →</button>
       <button class="btn btn-ghost" onclick="closeSheet()">Skip</button>`;

  setTimeout(() => renderSheetMap(o, 'sheet-map-container'), 80);

  document.getElementById('sheet-overlay').classList.remove('hidden');
  document.getElementById('order-sheet').classList.add('open');
}

function closeSheet() {
  document.getElementById('sheet-overlay').classList.add('hidden');
  document.getElementById('order-sheet').classList.remove('open');
  currentSheetOrder = null;
  if (_sheetMap) { _sheetMap.remove(); _sheetMap = null; }
}

// ════════════════════════════════════════════════════════
//  ACCEPT ORDER
// ════════════════════════════════════════════════════════
async function acceptOrder(orderId) {
  const orders = await fetchOrders();
  const o = orders.find(x => x.id === orderId);
  if (!o) { showToast('Order not found', 'error'); closeSheet(); return; }
  if (o.riderId && o.riderId !== rider.id) {
    showToast('Order already taken by another rider', 'error');
    closeSheet(); await refreshQueue(); return;
  }
  const changes = {
    status: 'out_for_delivery', riderId: rider.id,
    riderName: rider.name, riderPhone: rider.phone, riderPlate: rider.plate,
  };
  await db_updateOrder(orderId, changes);
  activeOrders[orderId] = { order: { ...o, ...changes }, step: 0 };
  await db_setRiderOrder(rider.id, Object.keys(activeOrders)[0]);
  closeSheet();
  showToast('Order ' + orderId + ' accepted!', 'success');
  renderActive();
  refreshQueue();
  refreshMapLive();
  switchTab('active');
}

// ════════════════════════════════════════════════════════
//  ACTIVE DELIVERIES  — tabbed single-view layout
// ════════════════════════════════════════════════════════
const STEPS       = ['Pickup', 'On Way', 'Arrived', 'Done'];
const STEP_LABELS = ['Pickup', 'On Way', 'Arrived', 'Delivered'];

// Tracks which order is currently shown in the active tab
let _activeTabIdx = 0;

async function renderActive() {
  const wrap  = document.getElementById('active-delivery-wrap');
  const noact = document.getElementById('no-active');
  const count = document.getElementById('active-count');
  const badge = document.getElementById('active-badge');

  if (!rider) { wrap.innerHTML = ''; noact.classList.remove('hidden'); return; }
  if (Object.keys(activeOrders).length === 0) await restoreActiveOrders();

  const entries = Object.entries(activeOrders);
  const n = entries.length;
  count.textContent = n + ' active';
  if (badge) {
    if (n > 0) { badge.textContent = n; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
  }
  if (!n) { wrap.innerHTML = ''; noact.classList.remove('hidden'); return; }
  noact.classList.add('hidden');

  if (_activeTabIdx >= n) _activeTabIdx = n - 1;

  // ── Build all slides ──
  const slidesHtml = entries.map(([oid, ent]) => {
    const o     = ent.order;
    const step  = ent.step;
    const name  = getCustomerName(o);
    const addr  = getAddress(o);
    const phone = (o.shipping && o.shipping.phone) || '—';
    const nextBtn = step < STEPS.length - 1
      ? `<button class="btn btn-primary act-btn-main" onclick="advanceStep('${oid}')">${step === STEPS.length - 2 ? 'Upload Proof & Deliver' : '→ ' + STEPS[step + 1]}</button>`
      : `<div class="act-delivered-label">DELIVERED</div>`;
    return `
      <div class="act-slide">
        <div class="active-card" id="active-card-${oid}">
          <div class="active-card-header">
            <div>
              <div class="active-card-title">ACTIVE DELIVERY</div>
              <div class="active-card-id">${oid}</div>
            </div>
          </div>
          <div class="active-card-body">
            <div class="step-bar">
              ${STEPS.map((s, i) => `
                <div class="step-item">
                  <div class="step-dot ${i < step ? 'done' : i === step ? 'current' : ''}">${i < step ? '&#10003;' : i + 1}</div>
                  <div class="step-label ${i === step ? 'active' : ''}">${STEP_LABELS[i]}</div>
                </div>
                ${i < STEPS.length - 1 ? `<div class="step-line ${i < step ? 'done' : ''}"></div>` : ''}
              `).join('')}
            </div>
            <div class="act-info-grid">
              <div class="act-info-row">
                <span class="act-info-label">Customer</span>
                <span class="act-info-val">${name}</span>
              </div>
              <div class="act-info-row">
                <span class="act-info-label">Phone</span>
                <span class="act-info-val">${phone}</span>
              </div>
              <div class="act-info-row">
                <span class="act-info-label">Address</span>
                <span class="act-info-val">${addr}</span>
              </div>
              <div class="act-info-row">
                <span class="act-info-label">Total</span>
                <span class="act-info-val act-total">₱${(o.total || 0).toLocaleString()} · ${(o.payment || '').toUpperCase()}</span>
              </div>
            </div>
            <div class="mini-map-wrap">
              <div id="card-map-${oid}" class="mini-map-canvas"></div>
              <div class="mini-map-footer">
                <span class="gps-chip" id="gps-chip-${oid}">● GPS</span>
                <button class="btn btn-xs btn-ghost" onclick="openOrderMapModal('${oid}')">Full Map →</button>
              </div>
            </div>
          </div>
          <div class="active-card-actions">
            ${nextBtn}
            ${step > 0 && step < STEPS.length - 1
              ? `<button class="btn btn-danger btn-sm" onclick="cancelDelivery('${oid}')">Cancel</button>`
              : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  // ── Nav bar (only when >1 order) ──
  const currentId = entries[_activeTabIdx][0];
  const navHtml = n > 1 ? `
    <div class="act-nav">
      <div class="act-nav-id" id="act-nav-id">${currentId}</div>
      <div class="act-nav-arrows">
        <button class="act-nav-btn" id="act-prev" ${_activeTabIdx === 0 ? 'disabled' : ''}>‹</button>
        <span class="act-nav-counter" id="act-nav-counter">${_activeTabIdx + 1} / ${n}</span>
        <button class="act-nav-btn" id="act-next" ${_activeTabIdx === n - 1 ? 'disabled' : ''}>›</button>
      </div>
    </div>
    <div class="act-dots" id="act-dots">
      ${entries.map((_, i) => `<div class="act-dot ${i === _activeTabIdx ? 'active' : ''}" data-idx="${i}"></div>`).join('')}
    </div>` : '';

  wrap.innerHTML = `
    ${navHtml}
    <div class="act-carousel-viewport" id="act-carousel-viewport">
      <div class="act-carousel-track" id="act-carousel-track">
        ${slidesHtml}
      </div>
    </div>`;

  // Wire up nav buttons with live closures (not baked-in index values)
  const prevBtn = document.getElementById('act-prev');
  const nextBtn = document.getElementById('act-next');
  if (prevBtn) prevBtn.addEventListener('click', () => switchActiveTab(_activeTabIdx - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => switchActiveTab(_activeTabIdx + 1));
  const dotsEl = document.getElementById('act-dots');
  if (dotsEl) dotsEl.addEventListener('click', e => {
    const dot = e.target.closest('[data-idx]');
    if (dot) switchActiveTab(parseInt(dot.dataset.idx, 10));
  });

  // Set initial position in px after DOM is painted
  requestAnimationFrame(() => {
    const vp    = document.getElementById('act-carousel-viewport');
    const track = document.getElementById('act-carousel-track');
    if (vp && track && _activeTabIdx > 0) {
      track.style.transform = `translateX(${-(_activeTabIdx * vp.offsetWidth)}px)`;
    }
  });

  // ── Touch / swipe support ──
  _initCarouselSwipe(n);

  // Render maps for visible slide only (lazy-load others on swipe)
  setTimeout(() => {
    entries.forEach(([oid, ent]) => renderCardMap(oid, ent.order));
  }, 80);
}

function switchActiveTab(idx) {
  const n = Object.keys(activeOrders).length;
  if (idx < 0 || idx >= n) return;
  _activeTabIdx = idx;

  // Move carousel
  const track = document.getElementById('act-carousel-track');
  const vp    = document.getElementById('act-carousel-viewport');
  if (track && vp) {
    track.style.transform = `translateX(${-(idx * vp.offsetWidth)}px)`;
  }

  // Update dots
  document.querySelectorAll('#act-dots .act-dot').forEach((d, i) => {
    d.classList.toggle('active', i === idx);
  });

  // Update counter + id label
  const entries = Object.entries(activeOrders);
  const counter = document.getElementById('act-nav-counter');
  const idLabel = document.getElementById('act-nav-id');
  if (counter) counter.textContent = `${idx + 1} / ${n}`;
  if (idLabel && entries[idx]) idLabel.textContent = entries[idx][0];

  // Update arrow disabled state
  const prev = document.getElementById('act-prev');
  const next = document.getElementById('act-next');
  if (prev) prev.disabled = idx === 0;
  if (next) next.disabled = idx === n - 1;
}

function _initCarouselSwipe(n) {
  const vp = document.getElementById('act-carousel-viewport');
  if (!vp || n <= 1) return;
  let startX = 0, dragging = false;
  vp.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX; dragging = true;
  }, { passive: true });
  vp.addEventListener('touchend', e => {
    if (!dragging) return; dragging = false;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) switchActiveTab(_activeTabIdx + (dx < 0 ? 1 : -1));
  }, { passive: true });
  // Also handle window resize so positions stay correct
  window.addEventListener('resize', () => {
    const track = document.getElementById('act-carousel-track');
    if (track && vp) track.style.transform = `translateX(${-(_activeTabIdx * vp.offsetWidth)}px)`;
  }, { passive: true });
}

function advanceStep(orderId) {
  const entry = activeOrders[orderId];
  if (!entry) return;
  if (entry.step < STEPS.length - 2) { entry.step++; renderActive(); }
  else openProofModal(orderId);
}

// ════════════════════════════════════════════════════════
//  GEOCODING  (Nominatim, Misamis Occidental–biased)
// ════════════════════════════════════════════════════════

/**
 * Geocode an order using its structured shipping fields.
 * Priority: municipality+barangay → flat address → null
 */
async function geocodeOrder(o) {
  const q = buildGeoQuery(o);
  return geocodeQuery(q);
}

async function geocodeQuery(q) {
  if (!q || q === '\u2014') return null;
  if (_geocodeCache[q]) return _geocodeCache[q];
  const base = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&accept-language=en`;
  const attempt = async (query, bounded) => {
    try {
      const url = base
        + (bounded ? `&viewbox=${MIS_OCC_BBOX}&bounded=1` : `&viewbox=${MIS_OCC_BBOX}&bounded=0`)
        + `&q=${encodeURIComponent(query)}`;
      const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      if (data && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
    } catch (e) { /* silent */ }
    return null;
  };
  // Strategy 1 — bare barangay + municipality (already cleaned by buildGeoQuery)
  let r = await attempt(q, false);
  if (r) { _geocodeCache[q] = r; return r; }

  // Strategy 2 — municipality + province only (drop barangay part)
  const munMatch = q.match(/,\s*([^,]+(?:City|Municipality|Ozamiz|Oroquieta|Tangub)[^,]*),?\s*Misamis/i)
    || q.match(/,\s*([A-Za-z\s]+),?\s*Misamis/i);
  if (munMatch) {
    const munOnly = `${munMatch[1].trim()}, Misamis Occidental, Philippines`;
    r = await attempt(munOnly, false);
    if (r) { _geocodeCache[q] = r; return r; }
  }

  // Strategy 3 — "Misamis Occidental" centroid as last resort
  r = await attempt('Misamis Occidental, Philippines', false);
  if (r) { _geocodeCache[q] = r; return r; }

  return null;
}

// ════════════════════════════════════════════════════════
//  MAP HELPERS  (Leaflet)
// ════════════════════════════════════════════════════════

function createDarkTileLayer() {
  return L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://openstreetmap.org">OSM</a> © <a href="https://carto.com">CARTO</a>',
    subdomains: 'abcd', maxZoom: 19,
  });
}

function deliveryIcon(color = '#ff6b35') {
  return L.divIcon({
    className: '',
    html: `<div class="map-pin-delivery" style="background:${color}">&#9632;</div>`,
    iconSize: [32, 32], iconAnchor: [16, 32],
  });
}

function riderIconSvg() {
  return L.divIcon({
    className: '',
    html: `<div class="map-pin-rider">&#9650;</div>`,
    iconSize: [36, 36], iconAnchor: [18, 18],
  });
}

// ════════════════════════════════════════════════════════
//  MAIN MAP TAB  — live rider + all delivery pins
// ════════════════════════════════════════════════════════

async function renderMapTab() {
  const noActive = document.getElementById('map-no-active');
  const mapWrap  = document.getElementById('map-tab-inner');
  const entries  = Object.entries(activeOrders);

  if (!entries.length) {
    mapWrap.style.display = 'none';
    noActive.classList.remove('hidden');
    return;
  }
  noActive.classList.add('hidden');
  mapWrap.style.display = 'block';

  // Init main map centred on Misamis Occidental
  if (!_mainMap) {
    _mainMap = L.map('main-map', { zoomControl: true })
      .setView(MIS_OCC_CENTER, MIS_OCC_ZOOM);
    createDarkTileLayer().addTo(_mainMap);

    // Add Misamis Occidental label
    L.control.scale({ imperial: false }).addTo(_mainMap);
  }

  await refreshMapLive();
  setTimeout(() => {
    if (_mainMap) _mainMap.invalidateSize(true);
  }, 300);
}

/**
 * Refresh all pins + rider position on the main map.
 * Called on: tab switch, GPS update, new order, order completed.
 */
async function refreshMapLive() {
  if (!_mainMap) return;

  // Clear previous delivery markers + route lines
  Object.values(_mainMapMarkers).forEach(m => _mainMap.removeLayer(m));
  _mainMapMarkers = {};
  Object.values(_routeLines).forEach(l => _mainMap.removeLayer(l));
  _routeLines = {};

  const entries = Object.entries(activeOrders);
  const bounds  = [];

  for (const [orderId, entry] of entries) {
    const geo  = await geocodeOrder(entry.order);
    const name = getCustomerName(entry.order);
    const addr = getAddress(entry.order);
    if (geo) {
      const marker = L.marker([geo.lat, geo.lng], { icon: deliveryIcon('#ff6b35') })
        .addTo(_mainMap)
        .bindPopup(_popupHtml(orderId, name, addr, entry.order.total));
      _mainMapMarkers[orderId] = marker;
      bounds.push([geo.lat, geo.lng]);

      // Draw straight line from rider to delivery if GPS available
      if (_riderLat && _riderLng) {
        const line = L.polyline(
          [[_riderLat, _riderLng], [geo.lat, geo.lng]],
          { color: '#00c2ff', weight: 2, opacity: 0.55, dashArray: '6 6' }
        ).addTo(_mainMap);
        _routeLines[orderId] = line;
      }
    }
  }

  // Rider marker
  _updateRiderMarkerOnMap(_riderLat, _riderLng);
  if (_riderLat && _riderLng) bounds.push([_riderLat, _riderLng]);

  if (bounds.length === 1) _mainMap.setView(bounds[0], 15);
  else if (bounds.length > 1) _mainMap.fitBounds(bounds, { padding: [50, 50] });
  else _mainMap.setView(MIS_OCC_CENTER, MIS_OCC_ZOOM);
}

function _updateRiderMarkerOnMap(lat, lng) {
  if (!_mainMap || !lat || !lng) return;
  if (_riderMarker) {
    _riderMarker.setLatLng([lat, lng]);
  } else {
    _riderMarker = L.marker([lat, lng], { icon: riderIconSvg(), zIndexOffset: 1000 })
      .addTo(_mainMap)
      .bindPopup(`<div style="font-family:monospace;font-size:12px"><b>You (${rider?.name || 'Rider'})</b><br>Live GPS position</div>`);
  }
  // Refresh dashed route lines
  Object.entries(_routeLines).forEach(([orderId, line]) => {
    const marker = _mainMapMarkers[orderId];
    if (marker) {
      const dest = marker.getLatLng();
      line.setLatLngs([[lat, lng], [dest.lat, dest.lng]]);
    }
  });

  // Update GPS chip in active cards
  document.querySelectorAll('[id^="gps-chip-"]').forEach(chip => {
    chip.textContent = '● GPS';
    chip.classList.add('active');
  });
}

function _popupHtml(orderId, name, addr, total) {
  return `<div style="font-family:monospace;font-size:11px;min-width:160px">
    <b style="font-size:12px">${orderId}</b><br>
    <b>${name}</b><br>
    ${addr}<br>
    <span style="color:#ff6b35">₱${(total || 0).toLocaleString()}</span>
    <br><button onclick="openOrderMapModal('${orderId}')"
      style="margin-top:6px;width:100%;padding:4px;background:#ff6b35;color:#000;border:none;border-radius:3px;cursor:pointer;font-size:11px;font-weight:700">
      Full Map →
    </button>
  </div>`;
}

function refreshMapTab() {
  if (_mainMap) {
    Object.values(_mainMapMarkers).forEach(m => _mainMap.removeLayer(m));
    _mainMapMarkers = {};
    Object.values(_routeLines).forEach(l => _mainMap.removeLayer(l));
    _routeLines = {};
  }
  renderMapTab();
}

// ════════════════════════════════════════════════════════
//  SHEET MAP  (bottom-sheet mini preview)
// ════════════════════════════════════════════════════════
let _sheetMap = null;

async function renderSheetMap(order, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (_sheetMap) { _sheetMap.remove(); _sheetMap = null; }

  const geo  = await geocodeOrder(order);
  const addr = getAddress(order);
  const osmLink = document.getElementById('sheet-osm-link');

  if (!geo) {
    const searchUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(addr + ', Misamis Occidental, Philippines')}`;
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;padding:16px;text-align:center">
        <div style="font-size:20px;color:var(--accent)">&#9679;</div>
        <div style="color:var(--text2);font-size:12px;font-family:var(--mono)">Could not auto-locate address</div>
        <div style="color:var(--text3);font-size:11px;line-height:1.5">${addr}</div>
        <a href="${searchUrl}" target="_blank" rel="noopener"
           style="padding:8px 16px;background:var(--accent);color:#000;border-radius:4px;font-size:12px;font-weight:700;text-decoration:none;font-family:var(--mono)">
          Search on OSM →
        </a>
      </div>`;
    if (osmLink) osmLink.href = searchUrl;
    return;
  }

  if (osmLink) {
    osmLink.href = `https://www.openstreetmap.org/?mlat=${geo.lat}&mlon=${geo.lng}&zoom=16`;
  }

  _sheetMap = L.map(containerId, { zoomControl: false, dragging: true, scrollWheelZoom: false })
    .setView([geo.lat, geo.lng], 15);
  createDarkTileLayer().addTo(_sheetMap);

  // Delivery pin
  L.marker([geo.lat, geo.lng], { icon: deliveryIcon('#ff6b35') })
    .addTo(_sheetMap)
    .bindPopup(`<span style="font-size:12px">${addr}</span>`)
    .openPopup();

  // Rider position if available
  if (_riderLat && _riderLng) {
    L.marker([_riderLat, _riderLng], { icon: riderIconSvg() })
      .addTo(_sheetMap)
      .bindPopup('<span style="font-size:11px">Your position</span>');
    // Dashed route line
    L.polyline(
      [[_riderLat, _riderLng], [geo.lat, geo.lng]],
      { color: '#00c2ff', weight: 2, opacity: 0.6, dashArray: '6 5' }
    ).addTo(_sheetMap);
    // Fit both
    _sheetMap.fitBounds([[_riderLat, _riderLng], [geo.lat, geo.lng]], { padding: [24, 24] });
  }

  setTimeout(() => _sheetMap && _sheetMap.invalidateSize(), 100);
}

// ════════════════════════════════════════════════════════
//  CARD MAP  (mini map inside active delivery card)
// ════════════════════════════════════════════════════════
const _cardMaps = {};

async function renderCardMap(orderId, order) {
  const containerId = `card-map-${orderId}`;
  const container   = document.getElementById(containerId);
  if (!container) return;
  if (_cardMaps[orderId]) { _cardMaps[orderId].remove(); delete _cardMaps[orderId]; }

  const geo  = await geocodeOrder(order);
  const addr = getAddress(order);
  if (!geo) {
    const searchUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(addr + ', Misamis Occidental, Philippines')}`;
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;padding:12px;text-align:center">
        <div style="color:var(--text3);font-size:11px;font-family:var(--mono)">Could not locate address</div>
        <div style="color:var(--text3);font-size:10px;line-height:1.4">${addr}</div>
        <a href="${searchUrl}" target="_blank" rel="noopener"
           style="padding:5px 12px;background:var(--accent);color:#000;border-radius:4px;font-size:10px;font-weight:700;text-decoration:none">
          Search OSM →
        </a>
      </div>`;
    return;
  }

  const map = L.map(containerId, {
    zoomControl: false, attributionControl: false,
    dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
  }).setView([geo.lat, geo.lng], 14);
  createDarkTileLayer().addTo(map);

  L.marker([geo.lat, geo.lng], { icon: deliveryIcon('#ff6b35') }).addTo(map);

  if (_riderLat && _riderLng) {
    L.marker([_riderLat, _riderLng], { icon: riderIconSvg() }).addTo(map);
    L.polyline([[_riderLat, _riderLng], [geo.lat, geo.lng]], {
      color: '#00c2ff', weight: 2, opacity: 0.55, dashArray: '5 5',
    }).addTo(map);
    map.fitBounds([[_riderLat, _riderLng], [geo.lat, geo.lng]], { padding: [16, 16] });
  }

  _cardMaps[orderId] = map;
  setTimeout(() => map.invalidateSize(), 100);
}

// ════════════════════════════════════════════════════════
//  FULL-SCREEN ORDER MAP MODAL
// ════════════════════════════════════════════════════════
async function openOrderMapModal(orderId) {
  const entry = activeOrders[orderId];
  if (!entry) return;
  const order = entry.order;
  const addr  = getAddress(order);
  const name  = getCustomerName(order);

  const existing = document.getElementById('map-modal-overlay');
  if (existing) { if (existing._leafletMap) existing._leafletMap.remove(); existing.remove(); }

  const overlay = document.createElement('div');
  overlay.id = 'map-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:8000;background:#0a0a0a;display:flex;flex-direction:column';

  const geo = await geocodeOrder(order);
  const hasGeo = !!geo;
  const osmDirections = hasGeo
    ? `https://www.openstreetmap.org/directions?to=${geo.lat}%2C${geo.lng}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent(addr + ', Misamis Occidental')}`;

  const gpsStatus = (_riderLat && _riderLng)
    ? `<span style="color:var(--success);font-size:11px;font-family:var(--mono)">● GPS Active</span>`
    : `<span style="color:var(--text3);font-size:11px;font-family:var(--mono)">● GPS Unavailable</span>`;

  overlay.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0">
      <div>
        <div style="font-family:var(--display);font-size:18px;letter-spacing:1px;color:var(--accent)">${orderId}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">${name}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:1px">${addr}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        ${gpsStatus}
        <button onclick="closeOrderMapModal()" style="background:none;border:1px solid var(--border2);color:var(--text2);padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px">Close</button>
      </div>
    </div>
    <div id="full-order-map" style="flex:1;width:100%"></div>
    <div style="padding:10px 16px;background:var(--surface);border-top:1px solid var(--border);display:flex;gap:8px">
      <a href="${osmDirections}" target="_blank" rel="noopener"
         style="flex:1;display:block;text-align:center;padding:11px;background:var(--accent);color:#000;border-radius:4px;font-size:13px;font-weight:700;text-decoration:none">
        Open Directions in OSM
      </a>
      <button onclick="refreshFullMapModal('${orderId}')"
         style="padding:11px 14px;background:var(--surface2);border:1px solid var(--border2);color:var(--text);border-radius:4px;font-size:13px;cursor:pointer">
        ↻
      </button>
    </div>`;
  document.body.appendChild(overlay);

  const center = geo ? [geo.lat, geo.lng] : MIS_OCC_CENTER;
  const zoom   = geo ? 16 : MIS_OCC_ZOOM;
  const fullMap = L.map('full-order-map', { zoomControl: true }).setView(center, zoom);
  createDarkTileLayer().addTo(fullMap);

  if (geo) {
    L.marker([geo.lat, geo.lng], { icon: deliveryIcon('#ff6b35') })
      .addTo(fullMap)
      .bindPopup(`<b style="font-size:12px">${name}</b><br><span style="font-size:11px">${addr}</span>`)
      .openPopup();
  }

  // Rider live position
  if (_riderLat && _riderLng) {
    L.marker([_riderLat, _riderLng], { icon: riderIconSvg(), zIndexOffset: 1000 })
      .addTo(fullMap)
      .bindPopup(`<span style="font-size:12px">You (${rider?.name || 'Rider'})</span>`);
    if (geo) {
      L.polyline([[_riderLat, _riderLng], [geo.lat, geo.lng]], {
        color: '#00c2ff', weight: 3, opacity: 0.7, dashArray: '8 6',
      }).addTo(fullMap);
      fullMap.fitBounds([[_riderLat, _riderLng], [geo.lat, geo.lng]], { padding: [60, 60] });
    }
  }

  // Misamis Occidental marker ring (subtle boundary awareness)
  L.circle(MIS_OCC_CENTER, { radius: 55000, color: '#00c2ff', weight: 1, opacity: 0.15, fill: false })
    .addTo(fullMap);

  overlay._leafletMap = fullMap;
  overlay._orderId    = orderId;
  setTimeout(() => fullMap.invalidateSize(), 150);
}

async function refreshFullMapModal(orderId) {
  const overlay = document.getElementById('map-modal-overlay');
  if (!overlay) return;
  if (overlay._leafletMap) overlay._leafletMap.remove();
  overlay.remove();
  await openOrderMapModal(orderId);
}

function closeOrderMapModal() {
  const el = document.getElementById('map-modal-overlay');
  if (el) { if (el._leafletMap) el._leafletMap.remove(); el.remove(); }
}

// ════════════════════════════════════════════════════════
//  PROOF OF DELIVERY
// ════════════════════════════════════════════════════════
let proofPhotoData = null;
let proofOrderId   = null;

function openProofModal(orderId) {
  proofPhotoData = null; proofOrderId = orderId;
  const existing = document.getElementById('proof-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'proof-overlay';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:flex-end;justify-content:center`;
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:12px 12px 0 0;width:100%;max-width:480px;padding:24px 20px 36px;border-top:1px solid var(--border)">
      <div style="width:36px;height:4px;background:var(--border2);border-radius:2px;margin:0 auto 18px"></div>
      <div style="font-family:var(--display);font-size:20px;letter-spacing:1px;color:var(--accent);margin-bottom:4px">Proof of Delivery</div>
      <div style="font-family:var(--mono);font-size:11px;color:var(--text3);margin-bottom:4px">Order: ${orderId}</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:18px">A photo is required to confirm delivery.</div>
      <div id="proof-preview" style="border-radius:8px;overflow:hidden;background:var(--surface2);border:2px dashed var(--border2);min-height:150px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;cursor:pointer;position:relative" onclick="document.getElementById('proof-file-input').click()">
        <div id="proof-placeholder" style="text-align:center;padding:20px">
          <div style="font-size:28px;margin-bottom:8px">[ PHOTO ]</div>
          <div style="font-size:13px;color:var(--text2)">Tap to take or upload a photo</div>
        </div>
        <img id="proof-img-preview" style="display:none;width:100%;max-height:200px;object-fit:cover">
      </div>
      <input type="file" id="proof-file-input" accept="image/*" capture="environment" style="display:none" onchange="handleProofPhoto(this)">
      <div style="display:flex;gap:10px">
        <button onclick="document.getElementById('proof-file-input').click()" style="flex:1;padding:12px;background:var(--surface2);border:1px solid var(--border2);color:var(--text);border-radius:4px;cursor:pointer;font-size:13px;font-weight:600">Choose Photo</button>
        <button id="proof-submit-btn" onclick="submitProofAndComplete()" disabled style="flex:2;padding:12px;background:var(--success);color:#000;border:none;border-radius:4px;cursor:not-allowed;font-size:13px;font-weight:700;opacity:.5">Confirm Delivery</button>
      </div>
      <button onclick="closeProofModal()" style="width:100%;margin-top:10px;padding:10px;background:none;border:1px solid var(--border);color:var(--text2);border-radius:4px;cursor:pointer;font-size:12px">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);
}

function handleProofPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    proofPhotoData = e.target.result;
    document.getElementById('proof-placeholder').style.display = 'none';
    const img = document.getElementById('proof-img-preview');
    img.src = proofPhotoData; img.style.display = 'block';
    const btn = document.getElementById('proof-submit-btn');
    btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer';
  };
  reader.readAsDataURL(file);
}

function closeProofModal() {
  const el = document.getElementById('proof-overlay');
  if (el) el.remove();
  proofPhotoData = null; proofOrderId = null;
}

async function submitProofAndComplete() {
  if (!proofPhotoData) { showToast('Please attach a delivery photo', 'error'); return; }
  if (!proofOrderId || !activeOrders[proofOrderId]) { closeProofModal(); return; }
  const entry = activeOrders[proofOrderId];
  const fee   = Math.round((entry.order.total || 0) * 0.08);
  await db_updateOrder(proofOrderId, { status: 'delivered', deliveryPhoto: proofPhotoData });
  completedDeliveries.push({ ...entry.order, fee, completedAt: new Date().toISOString(), deliveryPhoto: proofPhotoData });
  delete activeOrders[proofOrderId];
  const nextId = Object.keys(activeOrders)[0] || null;
  await db_setRiderOrder(rider.id, nextId);
  closeProofModal();
  renderActive(); renderHistory(); renderEarnings(); refreshQueue();
  refreshMapLive();
  showToast('Delivery completed!', 'success');
  updateEarningsChip();
}

async function cancelDelivery(orderId) {
  const entry = activeOrders[orderId];
  if (!entry) return;
  await db_updateOrder(orderId, { status: 'processing', riderId: null, riderName: '', riderPhone: '', riderPlate: '' });
  delete activeOrders[orderId];
  const nextId = Object.keys(activeOrders)[0] || null;
  await db_setRiderOrder(rider.id, nextId);
  renderActive(); refreshQueue(); refreshMapLive();
  showToast('Delivery cancelled', 'error');
}

// ════════════════════════════════════════════════════════
//  HISTORY
// ════════════════════════════════════════════════════════
function renderHistory() {
  const list  = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  const count = document.getElementById('history-count');
  count.textContent = completedDeliveries.length + ' deliveries';
  if (!completedDeliveries.length) { list.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  list.innerHTML = [...completedDeliveries].reverse().map(d => {
    const time = d.completedAt ? new Date(d.completedAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—';
    const name = getCustomerName(d);
    const fee  = d.fee || 0;
    return `
      <div class="history-card">
        <div class="history-icon">&#10003;</div>
        <div>
          <div class="history-id">${d.id}</div>
          <div class="history-customer">${name}</div>
          <div class="history-time">${time}</div>
        </div>
        <div class="history-earn">+₱${fee.toLocaleString()}</div>
      </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════════
//  EARNINGS
// ════════════════════════════════════════════════════════
function renderEarnings() {
  const todayStr  = new Date().toLocaleDateString('en-PH');
  const today     = completedDeliveries.filter(d => new Date(d.completedAt || 0).toLocaleDateString('en-PH') === todayStr);
  const todayEarn = today.reduce((s, d) => s + (d.fee || 0), 0);
  const totalEarn = completedDeliveries.reduce((s, d) => s + (d.fee || 0), 0);
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const week      = completedDeliveries.filter(d => new Date(d.completedAt || 0) >= weekStart);
  const weekEarn  = week.reduce((s, d) => s + (d.fee || 0), 0);
  const avgEarn   = completedDeliveries.length ? Math.round(totalEarn / completedDeliveries.length) : 0;
  document.getElementById('earn-today').textContent = '₱' + todayEarn.toLocaleString();
  document.getElementById('earn-week').textContent  = '₱' + weekEarn.toLocaleString();
  document.getElementById('earn-trips').textContent = completedDeliveries.length;
  document.getElementById('earn-avg').textContent   = '₱' + avgEarn.toLocaleString();
  const breakEl   = document.getElementById('earnings-breakdown');
  const earnEmpty = document.getElementById('earnings-empty');
  if (!completedDeliveries.length) { breakEl.innerHTML = ''; earnEmpty.classList.remove('hidden'); return; }
  earnEmpty.classList.add('hidden');
  breakEl.innerHTML = [...completedDeliveries].reverse().map(d => `
    <div class="earn-row">
      <div>
        <div class="earn-row-id">${d.id}</div>
        <div class="earn-row-addr">${getAddress(d)}</div>
      </div>
      <div class="earn-row-val">+₱${(d.fee || 0).toLocaleString()}</div>
    </div>
  `).join('');
}

function updateEarningsChip() {
  const todayStr = new Date().toLocaleDateString('en-PH');
  const today    = completedDeliveries.filter(d => new Date(d.completedAt || 0).toLocaleDateString('en-PH') === todayStr);
  const earn     = today.reduce((s, d) => s + (d.fee || 0), 0);
  document.getElementById('earnings-chip').textContent = '₱' + earn.toLocaleString() + ' today';
}

// ════════════════════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════════════════════
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = type ? type : ''; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── AUTO LOGIN ──
if (rider) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(bootApp, 400));
  } else {
    setTimeout(bootApp, 400);
  }
}