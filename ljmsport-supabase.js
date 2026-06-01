// ════════════════════════════════════════════════════════════
//  LJMSPORT — Supabase Database Layer  v2.0
//  Drop in ONE script tag before any LJMSport JS file:
//    <script src="ljmsport-supabase.js"></script>
//
//  ┌─ QUICK SETUP ──────────────────────────────────────────┐
//  │  1. Create a free project at https://supabase.com      │
//  │  2. Paste your Project URL + anon key below            │
//  │  3. Run the SQL in SUPABASE_SCHEMA (copy from bottom)  │
//  │  4. Include this file before ljmsport*.js in every     │
//  │     HTML page (shop, admin, rider)                     │
//  └────────────────────────────────────────────────────────┘
// ════════════════════════════════════════════════════════════

// ── ① CONFIGURATION ───────────────────────────────────────
const SUPABASE_URL  = 'https://lacuvtdpjcluukmvmhqk.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhY3V2dGRwamNsdXVrbXZtaHFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0Mzg3MDgsImV4cCI6MjA5NDAxNDcwOH0.6bEU_XuRozVHnbp2XxDON7HB6_I03F6Nmhvdwr6H77I';
// ─────────────────────────────────────────────────────────

// ── ② Load Supabase JS SDK from CDN (promise-based, race-condition safe) ─
let _sdkReady = null;   // Promise that resolves once the SDK is available

function _loadSDK() {
  if (_sdkReady) return _sdkReady;
  _sdkReady = new Promise((resolve, reject) => {
    // If the SDK was already injected by a static <script> tag, use it immediately
    if (typeof supabase !== 'undefined' && supabase.createClient) {
      resolve(); return;
    }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error('[LJMSport] Failed to load Supabase SDK. Check your internet connection.'));
    document.head.appendChild(s);
  });
  return _sdkReady;
}

// Kick off the SDK load immediately so it's ready by the time the app needs it
_loadSDK().catch(e => console.error(e));

// ── ③ Supabase client (lazy-initialised, awaits SDK) ─────
let _sb = null;

/** Returns a live Supabase client, waiting for the SDK to load if needed. */
async function getSBAsync() {
  await _loadSDK();
  if (_sb) return _sb;
  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.error('[LJMSport] Supabase SDK unavailable after load.');
    return null;
  }
  _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    realtime: { params: { eventsPerSecond: 10 } }
  });
  return _sb;
}

/**
 * Synchronous getter kept for backward compatibility with non-critical callers
 * (realtime subscriptions, heartbeat, etc.) that run after the app has booted.
 * Critical write paths (placeOrder, sign-in, etc.) should use getSBAsync() instead.
 */
function getSB() {
  if (_sb) return _sb;
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      realtime: { params: { eventsPerSecond: 10 } }
    });
    return _sb;
  }
  console.warn('[LJMSport] getSB() called before SDK loaded — use getSBAsync() for writes.');
  return null;
}

// ════════════════════════════════════════════════════════════
//  TABLE NAMES
// ════════════════════════════════════════════════════════════
const TBL = {
  orders   : 'ljm_orders',
  riders   : 'ljm_riders',
  users    : 'ljm_users',
  payments : 'ljm_payments',
  feedbacks: 'ljm_feedbacks',
  products : 'ljm_products',
  stock    : 'ljm_stock',
  settings : 'ljm_settings',
  admins   : 'ljm_admins',
};

// ════════════════════════════════════════════════════════════
//  ADMINS
// ════════════════════════════════════════════════════════════

/**
 * Fetch all admin accounts.
 * Returns [] if table is empty or missing (first run).
 * Called by: ljmsport-admin.js → adminLogin(), startSync()
 */
async function db_getAdmins() {
  const sb = getSB(); if (!sb) return [];
  const { data, error } = await sb
    .from(TBL.admins)
    .select('*');
  if (error) {
    console.warn('[DB] getAdmins:', error.message);
    return [];
  }
  return (data || []).map(a => ({
    username: a.username,
    password: a.password,
    name    : a.name  || a.username,
    role    : a.role  || 'staff',
  }));
}

// ════════════════════════════════════════════════════════════
//  ORDERS
// ════════════════════════════════════════════════════════════

/**
 * Fetch ALL orders, newest first.
 * Called by: all three portals extensively.
 * @returns {Promise<Array>}
 */
async function db_getOrders() {
  const sb = await getSBAsync(); if (!sb) return [];
  const { data, error } = await sb
    .from(TBL.orders)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('[DB] getOrders', error.message); return []; }
  return (data || []).map(_normaliseOrder);
}

/**
 * Upsert (create or update) an order.
 * Called by: ljmsport.js → placeOrder()
 * Called by: ljmsport-rider.js → acceptOrder() [indirectly via db_updateOrder]
 * @returns {Promise<Object|null>}  normalised order or null on failure
 */
async function db_saveOrder(order) {
  const sb = await getSBAsync(); if (!sb) return null;
  const row = _orderToRow(order);
  try {
    // Use maybeSingle() instead of single() — single() throws PGRST116 when upsert
    // returns 0 rows (can happen with certain RLS configs), maybeSingle() returns null safely.
    const { data, error } = await sb
      .from(TBL.orders)
      .upsert(row, { onConflict: 'id' })
      .select()
      .maybeSingle();
    if (error) { console.error('[DB] saveOrder error:', error.code, error.message, error.details); return null; }
    if (!data)  { console.warn('[DB] saveOrder: upsert succeeded but returned no row (RLS may block SELECT)'); }
    return data ? _normaliseOrder(data) : _normaliseOrder(row);  // fall back to local object so order still proceeds
  } catch(e) {
    console.error('[DB] saveOrder exception:', e);
    return null;
  }
}

/**
 * Patch specific fields on an existing order.
 * Called by: ljmsport-admin.js → saveOrderUpdate()
 * Called by: ljmsport-rider.js → acceptOrder(), submitProofAndComplete(), cancelDelivery()
 * @param {string} orderId
 * @param {Object} changes  camelCase keys (mapped internally to snake_case)
 */
async function db_updateOrder(orderId, changes) {
  const sb = getSB(); if (!sb) return;
  const mapped = _mapOrderChanges(changes);
  const { error } = await sb
    .from(TBL.orders)
    .update({ ...mapped, updated_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) console.error('[DB] updateOrder', error.message);
}

// ════════════════════════════════════════════════════════════
//  RIDERS
// ════════════════════════════════════════════════════════════

/**
 * Fetch all riders, most-recently-seen first.
 * Called by: ljmsport-admin.js → renderRiders(), renderDashboard()
 * @returns {Promise<Array>}
 */
async function db_getRiders() {
  const sb = getSB(); if (!sb) return [];
  const { data, error } = await sb
    .from(TBL.riders)
    .select('*')
    .order('last_seen', { ascending: false });
  if (error) { console.error('[DB] getRiders', error.message); return []; }
  return (data || []).map(_normaliseRider);
}

/**
 * Insert or update a rider row.
 * Called by: ljmsport-rider.js → bootApp(), registerRider()
 * Called by: ljmsport-admin.js → saveRider() [uses getSB() directly for fine control]
 * Only writes `pin` if the field is explicitly supplied (avoids wiping it on heartbeat).
 * @returns {Promise<boolean>}
 */
async function db_upsertRider(rider) {
  const sb = getSB(); if (!sb) return false;
  const row = {
    id              : rider.id,
    name            : rider.name,
    phone           : rider.phone  || null,
    plate           : rider.plate  || null,
    online          : rider.online ?? true,
    current_order_id: rider.currentOrderId || null,
    last_seen       : new Date().toISOString(),
  };
  if (rider.pin) row.pin = rider.pin;   // only write pin when explicitly provided

  const { error } = await sb
    .from(TBL.riders)
    .upsert(row, { onConflict: 'id' });
  if (error) { console.error('[DB] upsertRider', error.message); return false; }
  return true;
}

/**
 * Fetch a single rider by phone number.
 * Called by: ljmsport-admin.js → saveRider() (duplicate-phone check)
 * @returns {Promise<Object|null>}  raw DB row or null
 */
async function db_getRiderByPhone(phone) {
  const sb = getSB(); if (!sb) return null;
  const { data, error } = await sb
    .from(TBL.riders)
    .select('*')
    .eq('phone', phone)
    .maybeSingle();
  if (error) { console.error('[DB] getRiderByPhone', error.message); return null; }
  return data || null;
}

/**
 * Authenticate a rider by phone + PIN.
 * Called by: ljmsport-rider.js → riderSignIn()
 * Returns the raw Supabase row on success, null on failure.
 * NOTE: PIN comparison is plaintext here — hash in production.
 * @returns {Promise<Object|null>}
 */
async function db_authenticateRider(phone, pin) {
  const sb = await getSBAsync(); if (!sb) return null;
  const { data, error } = await sb
    .from(TBL.riders)
    .select('*')
    .eq('phone', phone)
    .eq('pin', pin)
    .maybeSingle();
  if (error) { console.error('[DB] authenticateRider', error.message); return null; }
  return data || null;
}

/**
 * Flip a rider's online flag and stamp last_seen.
 * Called by: ljmsport-rider.js → toggleStatus(), riderLogout()
 */
async function db_setRiderOnline(riderId, online) {
  const sb = getSB(); if (!sb) return;
  const { error } = await sb
    .from(TBL.riders)
    .update({ online, last_seen: new Date().toISOString() })
    .eq('id', riderId);
  if (error) console.error('[DB] setRiderOnline', error.message);
}

/**
 * Update the current_order_id on a rider (or clear it with null).
 * Called by: ljmsport-rider.js → acceptOrder(), submitProofAndComplete(), cancelDelivery()
 */
async function db_setRiderOrder(riderId, orderId) {
  const sb = getSB(); if (!sb) return;
  const { error } = await sb
    .from(TBL.riders)
    .update({ current_order_id: orderId || null, last_seen: new Date().toISOString() })
    .eq('id', riderId);
  if (error) console.error('[DB] setRiderOrder', error.message);
}

// ════════════════════════════════════════════════════════════
//  USERS  (shop customer accounts)
// ════════════════════════════════════════════════════════════

/**
 * Fetch all customer accounts.
 * Called by: ljmsport-admin.js → buildCustomers()
 */
async function db_getUsers() {
  const sb = getSB(); if (!sb) return [];
  const { data, error } = await sb.from(TBL.users).select('*');
  if (error) { console.error('[DB] getUsers', error.message); return []; }
  return data || [];
}

/**
 * Insert or update a user record (keyed on email).
 * Called by: ljmsport.js → doRegister(), placeOrder(), saveProfile()
 */
async function db_upsertUser(user) {
  const sb = await getSBAsync(); if (!sb) return null;
  const { data, error } = await sb
    .from(TBL.users)
    .upsert({
      email     : user.email,
      name      : user.name      || null,
      phone     : user.phone     || null,
      password  : user.password  || null,
      status    : user.status    || 'active',
      created_at: user.since     || new Date().toISOString(),
    }, { onConflict: 'email' })
    .select()
    .single();
  if (error) { console.error('[DB] upsertUser', error.message); return null; }
  return data;
}

/**
 * Fetch a single user by email.
 * Called by: ljmsport.js → doLogin(), doRegister() (duplicate check)
 */
async function db_getUserByEmail(email) {
  const sb = await getSBAsync(); if (!sb) return null;
  const { data, error } = await sb
    .from(TBL.users)
    .select('*')
    .eq('email', email)
    .single();
  if (error) return null;
  return data;
}

/**
 * Patch only the status column on a user.
 * Called by: ljmsport-admin.js → saveCustStatus()
 */
async function db_updateUserStatus(email, status) {
  const sb = getSB(); if (!sb) return;
  const { error } = await sb
    .from(TBL.users)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('email', email);
  if (error) console.error('[DB] updateUserStatus', error.message);
}

// ════════════════════════════════════════════════════════════
//  VERIFICATIONS  (email verification codes)
// ════════════════════════════════════════════════════════════

/**
 * Table name for email verification codes.
 * SQL to create it (run once in Supabase SQL Editor):
 *
 *   create table if not exists ljm_verifications (
 *     email      text primary key,
 *     code       text not null,
 *     expires_at timestamptz not null,
 *     verified   boolean default false
 *   );
 *   alter table ljm_verifications enable row level security;
 *   create policy "public_access_verifications"
 *     on ljm_verifications for all using (true) with check (true);
 */

/** Upsert a verification code row for the given email. */
async function db_upsertVerification(email, code, expiresAt) {
  const sb = await getSBAsync(); if (!sb) return false;
  const { error } = await sb
    .from('ljm_verifications')
    .upsert({ email, code, expires_at: expiresAt, verified: false }, { onConflict: 'email' });
  if (error) { console.error('[DB] upsertVerification', error.message); return false; }
  return true;
}

/** Fetch a verification row by email. */
async function db_getVerification(email) {
  const sb = await getSBAsync(); if (!sb) return null;
  const { data, error } = await sb
    .from('ljm_verifications')
    .select('*')
    .eq('email', email)
    .maybeSingle();
  if (error) { console.error('[DB] getVerification', error.message); return null; }
  return data || null;
}

/** Mark a verification row as verified. */
async function db_markVerified(email) {
  const sb = await getSBAsync(); if (!sb) return;
  const { error } = await sb
    .from('ljm_verifications')
    .update({ verified: true })
    .eq('email', email);
  if (error) console.error('[DB] markVerified', error.message);
}

// ════════════════════════════════════════════════════════════
//  PAYMENTS  (method config managed by admin)
// ════════════════════════════════════════════════════════════

/**
 * Fetch all payment methods ordered by sort_order.
 * Called by: ljmsport.js → window.onload(), renderCheckout()
 * Called by: ljmsport-admin.js → adminLogin(), renderPayments()
 */
async function db_getPayments() {
  const sb = getSB(); if (!sb) return [];
  const { data, error } = await sb
    .from(TBL.payments)
    .select('*')
    .order('sort_order');
  if (error) { console.error('[DB] getPayments', error.message); return []; }
  return data || [];
}

/**
 * Toggle a payment method's status.
 * Called by: ljmsport-admin.js → togglePayment()
 */
async function db_updatePayment(id, status) {
  const sb = getSB(); if (!sb) return;
  const { error } = await sb
    .from(TBL.payments)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('[DB] updatePayment', error.message);
}

// ════════════════════════════════════════════════════════════
//  FEEDBACKS
// ════════════════════════════════════════════════════════════

/**
 * Fetch all feedback entries, newest first.
 * Called by: ljmsport-admin.js → renderFeedbacks()
 * Called by: ljmsport.js → renderHistory() (to check if already reviewed)
 */
async function db_getFeedbacks() {
  const sb = getSB(); if (!sb) return [];
  const { data, error } = await sb
    .from(TBL.feedbacks)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('[DB] getFeedbacks', error.message); return []; }
  return (data || []).map(f => ({
    id      : f.id,
    customer: f.customer_name,
    email   : f.customer_email,
    orderId : f.order_id,
    type    : f.type,
    rating  : f.rating,
    comment : f.comment,
    date    : f.created_at ? new Date(f.created_at).toLocaleString('en-PH') : '—',
  }));
}

/**
 * Insert one feedback record.
 * Called by: ljmsport.js → submitReview()
 */
async function db_saveFeedback(fb) {
  const sb = getSB(); if (!sb) return;
  const { error } = await sb.from(TBL.feedbacks).insert({
    id            : fb.id || ('FB-' + Date.now()),
    customer_name : fb.customer,
    customer_email: fb.email,
    order_id      : fb.orderId,
    type          : fb.type,
    rating        : fb.rating,
    comment       : fb.comment,
    created_at    : new Date().toISOString(),
  });
  if (error) console.error('[DB] saveFeedback', error.message);
}

// ════════════════════════════════════════════════════════════
//  PRODUCTS
// ════════════════════════════════════════════════════════════

/**
 * Fetch all products ordered by id.
 * Called by: ljmsport.js → loadShopProducts()
 * Called by: ljmsport-admin.js → loadAdminProducts()
 */
async function db_getProducts() {
  const sb = getSB(); if (!sb) return [];
  const { data, error } = await sb
    .from(TBL.products)
    .select('*')
    .order('id');
  if (error) { console.error('[DB] getProducts', error.message); return []; }
  return (data || []).map(p => ({
    id      : p.id,
    emoji   : p.emoji    || '📦',
    name    : p.name,
    brand   : p.brand    || '',
    cat     : p.category || '',
    price   : p.price,
    oldPrice: p.old_price || null,
    badge   : p.badge    || null,
    desc    : p.description || '',
    sizes   : p.sizes    || [],
    imageUrl: p.image_url || null,
  }));
}

/**
 * Insert or update a product.
 * Called by: ljmsport-admin.js → saveProduct()
 */
async function db_upsertProduct(product) {
  const sb = getSB(); if (!sb) return null;
  const { data, error } = await sb
    .from(TBL.products)
    .upsert({
      id         : product.id,
      emoji      : product.emoji    || '📦',
      name       : product.name,
      brand      : product.brand    || null,
      category   : product.cat      || null,
      price      : product.price,
      old_price  : product.oldPrice || null,
      badge      : product.badge    || null,
      description: product.desc     || null,
      sizes      : product.sizes    || [],
      image_url  : product.imageUrl || null,
      updated_at : new Date().toISOString(),
    }, { onConflict: 'id' })
    .select()
    .single();
  if (error) { console.error('[DB] upsertProduct', error.message); return null; }
  return data;
}

/**
 * Delete a product and cascade-delete all its stock rows.
 * Called by: ljmsport-admin.js → removeProduct()
 */
async function db_deleteProduct(id) {
  const sb = getSB(); if (!sb) return;
  const { error } = await sb.from(TBL.products).delete().eq('id', id);
  if (error) console.error('[DB] deleteProduct', error.message);
  // Also wipe stock rows for this product
  await sb.from(TBL.stock).delete().eq('product_id', id);
}

// ════════════════════════════════════════════════════════════
//  STOCK  (per-product, per-size — ljm_stock)
// ════════════════════════════════════════════════════════════

/**
 * Fetch stock for ONE product.
 * Returns { "S": 10, "M": 5, "L": 0 }
 * Called by: (internal use; admin uses db_getAllStock instead)
 */
async function db_getProductStock(productId) {
  const sb = getSB(); if (!sb) return {};
  const { data, error } = await sb
    .from(TBL.stock)
    .select('size, qty')
    .eq('product_id', productId);
  if (error) { console.error('[DB] getProductStock', error.message); return {}; }
  const out = {};
  (data || []).forEach(row => { out[row.size] = row.qty; });
  return out;
}

/**
 * Fetch stock for ALL products in one query.
 * Returns { productId: { size: qty } }
 * Called by: ljmsport.js → loadShopProducts()
 * Called by: ljmsport-admin.js → loadAllStock()
 */
async function db_getAllStock() {
  const sb = getSB(); if (!sb) return {};
  const { data, error } = await sb
    .from(TBL.stock)
    .select('product_id, size, qty');
  if (error) { console.error('[DB] getAllStock', error.message); return {}; }
  const out = {};
  (data || []).forEach(row => {
    if (!out[row.product_id]) out[row.product_id] = {};
    out[row.product_id][row.size] = row.qty;
  });
  return out;
}

/**
 * Replace all size rows for a product (delete-then-insert).
 * Called by: ljmsport-admin.js → saveStock()
 * Called by: ljmsport.js → placeOrder() (decrements via db_saveProductStock)
 * @param {number} productId
 * @param {Object} stockObj  e.g. { "S": 10, "M": 5 }
 * @returns {Promise<boolean>}
 */
async function db_saveProductStock(productId, stockObj) {
  const sb = await getSBAsync(); if (!sb) return false;
  // Delete existing rows first, then re-insert clean state
  await sb.from(TBL.stock).delete().eq('product_id', productId);
  const rows = Object.entries(stockObj).map(([size, qty]) => ({
    product_id: productId,
    size,
    qty       : Math.max(0, parseInt(qty) || 0),
    updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return true;
  const { error } = await sb.from(TBL.stock).insert(rows);
  if (error) { console.error('[DB] saveProductStock', error.message); return false; }
  return true;
}

/**
 * Decrement stock across sizes for items in a placed order.
 * Called by: ljmsport.js → placeOrder() — iterates cart items
 * @param {Array} items  [{ id, qty, size }]
 */
async function db_decrementStock(items) {
  const sb = await getSBAsync(); if (!sb) return;
  for (const item of items) {
    if (!item.id || !item.qty) continue;
    const size = item.size || 'One Size';
    const { data } = await sb
      .from(TBL.stock)
      .select('qty')
      .eq('product_id', item.id)
      .eq('size', size)
      .maybeSingle();
    const current = data?.qty ?? 0;
    const newQty  = Math.max(0, current - item.qty);
    await sb
      .from(TBL.stock)
      .upsert(
        { product_id: item.id, size, qty: newQty, updated_at: new Date().toISOString() },
        { onConflict: 'product_id,size' }
      );
  }
}

// ════════════════════════════════════════════════════════════
//  REAL-TIME SUBSCRIPTIONS
//  Usage:
//    const unsub = db_subscribe('orders', (payload) => { ... });
//    unsub();  // to clean up
// ════════════════════════════════════════════════════════════

/**
 * Subscribe to any table in TBL.
 * Called by: ljmsport.js → startShopSync()
 * Called by: ljmsport-admin.js → startSync()
 * Called by: ljmsport-rider.js → startRealtimeSync()
 *
 * @param {'orders'|'riders'|'products'|'stock'|'payments'|'feedbacks'|'admins'} table
 * @param {Function} callback  receives Supabase realtime payload
 * @param {Object}  [filter]  optional column filter e.g. { column:'rider_id', value: rid }
 * @returns {Function}  call to unsubscribe
 */
function db_subscribe(table, callback, filter = null) {
  const sb = getSB();
  if (!sb) return () => {};
  const tblName = TBL[table] || table;
  let ch = sb.channel(`ljm:${tblName}:${Date.now()}`);

  const cfg = { event: '*', schema: 'public', table: tblName };
  if (filter) { cfg.filter = `${filter.column}=eq.${filter.value}`; }

  ch = ch.on('postgres_changes', cfg, callback);
  ch.subscribe();
  return () => sb.removeChannel(ch);
}

/**
 * Subscribe to changes on a specific order (for shop order tracking).
 * Called by: ljmsport.js → _subscribeToMyOrder()
 */
function db_subscribeOrder(orderId, callback) {
  return db_subscribe('orders', callback, { column: 'id', value: orderId });
}

/**
 * Subscribe to changes on a specific rider row.
 * Called by: ljmsport-rider.js → startRealtimeSync() (riders table watch)
 */
function db_subscribeRider(riderId, callback) {
  return db_subscribe('riders', callback, { column: 'id', value: riderId });
}

// ════════════════════════════════════════════════════════════
//  PRIVATE HELPERS
// ════════════════════════════════════════════════════════════

/**
 * Map a raw ljm_orders DB row → the JS object shape used throughout the app.
 * Fields consumed by admin.js: id, date, status, userEmail, payment, total,
 *   items, shipping, riderId, riderName, riderPhone, riderPlate,
 *   deliveryPhoto, paymentStatus, _live
 * Fields consumed by rider.js: id, date, status, items, shipping, total,
 *   payment, riderId, riderName, riderPhone, riderPlate
 */
function _normaliseOrder(row) {
  return {
    id           : row.id,
    date         : row.created_at,
    status       : row.status        || 'pending',
    userEmail    : row.user_email    || '',
    payment      : row.payment       || 'cod',
    paymentStatus: row.payment_status || null,
    total        : row.total         || 0,
    items        : _parseJson(row.items, []),
    shipping     : _parseJson(row.shipping, {}),
    riderId      : row.rider_id      || null,
    riderName    : row.rider_name    || '',
    riderPhone   : row.rider_phone   || '',
    riderPlate   : row.rider_plate   || '',
    deliveryPhoto: row.delivery_photo || null,
    _live        : true,
  };
}

/**
 * Map the JS order object → DB row for upsert / insert.
 * All camelCase → snake_case conversions live here.
 */
function _orderToRow(o) {
  const s = o.shipping || {};
  return {
    id            : o.id,
    user_email    : o.userEmail    || s.email || '',
    status        : o.status       || 'pending',
    payment       : (o.payment     || 'cod').toLowerCase(),
    payment_status: o.paymentStatus || null,
    total         : o.total        || 0,
    items         : JSON.stringify(o.items    || []),
    shipping      : JSON.stringify(o.shipping || {}),
    rider_id      : o.riderId      || null,
    rider_name    : o.riderName    || null,
    rider_phone   : o.riderPhone   || null,
    rider_plate   : o.riderPlate   || null,
    delivery_photo: o.deliveryPhoto || null,
    created_at    : o.date         || new Date().toISOString(),
    updated_at    : new Date().toISOString(),
  };
}

/**
 * Map camelCase change keys → snake_case DB columns for db_updateOrder().
 * Only keys listed here are recognised; unknown keys pass through as-is.
 */
function _mapOrderChanges(changes) {
  const map = {
    status        : 'status',
    riderId       : 'rider_id',
    riderName     : 'rider_name',
    riderPhone    : 'rider_phone',
    riderPlate    : 'rider_plate',
    deliveryPhoto : 'delivery_photo',
    paymentStatus : 'payment_status',
  };
  const out = {};
  for (const [k, v] of Object.entries(changes)) {
    out[map[k] || k] = v;
  }
  return out;
}

/**
 * Map a raw ljm_riders DB row → the JS rider shape used throughout the app.
 * Fields consumed by admin.js: id, name, phone, plate, online,
 *   currentOrderId, lastSeen
 * Fields consumed by rider.js: same + raw row fields (id, name, phone,
 *   plate, last_seen) used in bootApp()
 */
function _normaliseRider(row) {
  return {
    id            : row.id,
    name          : row.name,
    phone         : row.phone || '—',
    plate         : row.plate || '—',
    online        : row.online ?? false,
    currentOrderId: row.current_order_id || null,
    lastSeen      : row.last_seen,
  };
}

/** Safely parse a JSON string; return fallback on failure or if already an object. */
function _parseJson(val, fallback) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

// ════════════════════════════════════════════════════════════
//  MIGRATION HELPER
//  Run once from the browser console to seed Supabase from
//  whatever is already in localStorage:
//    LJM_migrateLocalStorage()
// ════════════════════════════════════════════════════════════
async function LJM_migrateLocalStorage() {
  console.log('[LJMSport] Starting localStorage → Supabase migration…');
  const sb = getSB();
  if (!sb) { console.error('Supabase not configured'); return; }

  // Orders
  try {
    const orders = JSON.parse(localStorage.getItem('ljmOrders') || '[]');
    if (orders.length) {
      const rows = orders.map(_orderToRow);
      const { error } = await sb.from(TBL.orders).upsert(rows, { onConflict: 'id' });
      if (error) console.error('orders', error);
      else console.log(`✓ ${orders.length} orders migrated`);
    }
  } catch(e) { console.error('orders', e); }

  // Riders
  try {
    const riders = JSON.parse(localStorage.getItem('ljmRiders') || '[]');
    if (riders.length) {
      const rows = riders.map(r => ({
        id              : r.id,
        name            : r.name,
        phone           : r.phone           || null,
        plate           : r.plate           || null,
        online          : r.online          ?? false,
        current_order_id: r.currentOrderId  || null,
        last_seen       : r.lastSeen        || new Date().toISOString(),
      }));
      const { error } = await sb.from(TBL.riders).upsert(rows, { onConflict: 'id' });
      if (error) console.error('riders', error);
      else console.log(`✓ ${riders.length} riders migrated`);
    }
  } catch(e) { console.error('riders', e); }

  // Users
  try {
    const users = JSON.parse(localStorage.getItem('ljmUsers') || '[]');
    if (users.length) {
      const rows = users.map(u => ({
        email     : u.email,
        name      : u.name     || null,
        phone     : u.phone    || null,
        password  : u.password || null,
        status    : 'active',
        created_at: u.since    || new Date().toISOString(),
      }));
      const { error } = await sb.from(TBL.users).upsert(rows, { onConflict: 'email' });
      if (error) console.error('users', error);
      else console.log(`✓ ${users.length} users migrated`);
    }
  } catch(e) { console.error('users', e); }

  console.log('[LJMSport] Migration complete ✓');
}

// Expose globally for console access
window.LJM_migrateLocalStorage = LJM_migrateLocalStorage;
window.LJM_DB = {
  // Orders
  getOrders: db_getOrders, saveOrder: db_saveOrder, updateOrder: db_updateOrder,
  // Riders
  getRiders: db_getRiders, upsertRider: db_upsertRider,
  setRiderOnline: db_setRiderOnline, setRiderOrder: db_setRiderOrder,
  getRiderByPhone: db_getRiderByPhone, authenticateRider: db_authenticateRider,
  // Users
  getUsers: db_getUsers, upsertUser: db_upsertUser,
  getUserByEmail: db_getUserByEmail, updateUserStatus: db_updateUserStatus,
  // Payments
  getPayments: db_getPayments, updatePayment: db_updatePayment,
  // Feedbacks
  getFeedbacks: db_getFeedbacks, saveFeedback: db_saveFeedback,
  // Products
  getProducts: db_getProducts, upsertProduct: db_upsertProduct, deleteProduct: db_deleteProduct,
  // Stock
  getProductStock: db_getProductStock, getAllStock: db_getAllStock,
  saveProductStock: db_saveProductStock, decrementStock: db_decrementStock,
  // Admins
  getAdmins: db_getAdmins,
  // Realtime
  subscribe: db_subscribe, subscribeOrder: db_subscribeOrder, subscribeRider: db_subscribeRider,
};

/* ═══════════════════════════════════════════════════════════
   SUPABASE SQL SCHEMA
   Copy and run this in your Supabase project:
   Dashboard → SQL Editor → New Query → Paste → Run

   ─────────────────────────────────────────────────────────
   -- Enable UUID extension
   create extension if not exists "pgcrypto";

   -- ── ADMINS ────────────────────────────────────────────
   create table if not exists ljm_admins (
     id         serial primary key,
     username   text not null unique,
     password   text not null,
     name       text not null,
     role       text not null default 'staff'
                check (role in ('owner','manager','staff')),
     created_at timestamptz not null default now()
   );
   alter table ljm_admins enable row level security;
   create policy "public_access_admins" on ljm_admins for all using (true) with check (true);

   -- Seed your first owner account (change password immediately after!)
   insert into ljm_admins (username, password, name, role) values
     ('owner', 'changeme123', 'Store Owner', 'owner')
   on conflict (username) do nothing;

   -- ── ORDERS ──────────────────────────────────────────
   create table if not exists ljm_orders (
     id              text primary key,
     user_email      text,
     status          text not null default 'pending'
                     check (status in ('pending','processing','out_for_delivery','delivered','cancelled')),
     payment         text not null default 'cod',
     payment_status  text,
     total           numeric(10,2) not null default 0,
     items           jsonb not null default '[]',
     shipping        jsonb not null default '{}',
     rider_id        text,
     rider_name      text,
     rider_phone     text,
     rider_plate     text,
     delivery_photo  text,
     created_at      timestamptz not null default now(),
     updated_at      timestamptz not null default now()
   );
   alter table ljm_orders enable row level security;
   create policy "public_access_orders" on ljm_orders for all using (true) with check (true);

   -- ── RIDERS ──────────────────────────────────────────
   create table if not exists ljm_riders (
     id               text primary key,
     name             text not null,
     phone            text unique,
     pin              text,
     plate            text,
     online           boolean not null default false,
     current_order_id text references ljm_orders(id) on delete set null,
     last_seen        timestamptz not null default now()
   );
   alter table ljm_riders enable row level security;
   create policy "public_access_riders" on ljm_riders for all using (true) with check (true);

   -- ── USERS ───────────────────────────────────────────
   create table if not exists ljm_users (
     email      text primary key,
     name       text,
     phone      text,
     password   text,
     status     text not null default 'active'
                check (status in ('active','flagged','blocked')),
     created_at timestamptz not null default now(),
     updated_at timestamptz
   );
   alter table ljm_users enable row level security;
   create policy "public_access_users" on ljm_users for all using (true) with check (true);

   -- ── PAYMENTS ────────────────────────────────────────
   create table if not exists ljm_payments (
     id         text primary key,
     label      text not null,
     icon       text,
     status     text not null default 'active' check (status in ('active','inactive')),
     sort_order integer not null default 99,
     updated_at timestamptz
   );
   alter table ljm_payments enable row level security;
   create policy "public_access_payments" on ljm_payments for all using (true) with check (true);

   insert into ljm_payments (id, label, icon, status, sort_order) values
     ('cod',    'Cash on Delivery',    '💵', 'active', 1),
     ('gcash',  'GCash',               '📱', 'active', 2),
     ('maya',   'Maya',                '💙', 'active', 3),
     ('card',   'Credit / Debit Card', '💳', 'active', 4),
     ('paypal', 'PayPal',              '🅿️', 'active', 5)
   on conflict (id) do nothing;

   -- ── FEEDBACKS ───────────────────────────────────────
   create table if not exists ljm_feedbacks (
     id             text primary key,
     customer_name  text,
     customer_email text,
     order_id       text,
     type           text check (type in ('delivery','product','other')),
     rating         integer check (rating between 1 and 5),
     comment        text,
     created_at     timestamptz not null default now()
   );
   alter table ljm_feedbacks enable row level security;
   create policy "public_access_feedbacks" on ljm_feedbacks for all using (true) with check (true);

   -- ── PRODUCTS ────────────────────────────────────────
   create table if not exists ljm_products (
     id          integer primary key,
     emoji       text,
     name        text not null,
     brand       text,
     category    text,
     price       numeric(10,2) not null,
     old_price   numeric(10,2),
     badge       text,
     description text,
     sizes       jsonb not null default '[]',
     image_url   text,
     updated_at  timestamptz
   );
   alter table ljm_products enable row level security;
   create policy "public_access_products" on ljm_products for all using (true) with check (true);

   -- ── STOCK ───────────────────────────────────────────
   create table if not exists ljm_stock (
     product_id  integer not null references ljm_products(id) on delete cascade,
     size        text not null,
     qty         integer not null default 0,
     updated_at  timestamptz not null default now(),
     primary key (product_id, size)
   );
   alter table ljm_stock enable row level security;
   create policy "public_access_stock" on ljm_stock for all using (true) with check (true);

   -- ── Enable Realtime on all tables ───────────────────
   alter publication supabase_realtime add table ljm_orders;
   alter publication supabase_realtime add table ljm_riders;
   alter publication supabase_realtime add table ljm_users;
   alter publication supabase_realtime add table ljm_payments;
   alter publication supabase_realtime add table ljm_products;
   alter publication supabase_realtime add table ljm_stock;

   ═══════════════════════════════════════════════════════════ */