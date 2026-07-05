import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.PAWK_ADMIN_CONFIG;
const $ = (sel) => document.querySelector(sel);

const loginView = $('#login');
const consoleView = $('#console');
const panelEl = $('#panel');

if (!cfg || cfg.supabaseUrl.includes('YOUR-')) {
  document.body.innerHTML =
    '<div class="login"><div class="login-card"><div class="brand">🐾 Pawk <span class="brand-admin">Admin</span></div>' +
    '<p class="login-sub">Missing config. Copy <span class="mono">admin/config.example.js</span> to ' +
    '<span class="mono">admin/config.js</span> and fill in your Supabase URL + anon key.</p></div></div>';
  throw new Error('admin config missing');
}

const supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

let currentUserId = null;

// ---- helpers ----
const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

async function count(table, build) {
  let q = supabase.from(table).select('id', { count: 'exact', head: true });
  if (build) q = build(q);
  const { count: n, error } = await q;
  if (error) throw error;
  return n ?? 0;
}

// ---- panels ----
const PANELS = { operations, moderation, events, users };

let reportFilter = 'open';
async function moderation() {
  const filters = ['open', 'resolved', 'dismissed', 'all'];
  const chips = filters
    .map((s) => `<button class="chip ${s === reportFilter ? 'active' : ''}" data-rfilter="${s}">${s}</button>`)
    .join('');
  panelEl.innerHTML = `<h1>Moderation</h1><p class="panel-sub">User reports · newest first · up to 200.</p>
    <div class="toolbar">${chips}</div>
    <div id="reports-table"><div class="empty">Loading…</div></div>`;

  panelEl.querySelectorAll('[data-rfilter]').forEach((b) =>
    b.addEventListener('click', () => {
      reportFilter = b.dataset.rfilter;
      moderation();
    }),
  );

  try {
    let q = supabase
      .from('reports')
      .select(
        'id, target_type, target_id, reason, status, created_at, reporter:profiles!reports_reporter_id_fkey(display_name)',
      )
      .order('created_at', { ascending: false })
      .limit(200);
    if (reportFilter !== 'all') q = q.eq('status', reportFilter);
    const { data, error } = await q;
    if (error) throw error;
    if (!data.length) {
      $('#reports-table').innerHTML = `<div class="empty">No ${reportFilter === 'all' ? '' : reportFilter + ' '}reports.</div>`;
      return;
    }
    const rows = data
      .map((r) => {
        const actions =
          r.status === 'open'
            ? `<button class="mini" data-resolve="${r.id}">Resolve</button>
               <button class="mini ghost" data-dismiss="${r.id}">Dismiss</button>`
            : `<span class="muted">${esc(r.status)}</span>`;
        return `<tr>
          <td><span class="pill warn">${esc(r.target_type)}</span></td>
          <td class="wrap">${esc(r.reason) || '<span class="muted">— no reason —</span>'}</td>
          <td>${esc(r.reporter?.display_name) || '—'}</td>
          <td>${fmtDate(r.created_at)}</td>
          <td class="mono muted">${esc(r.target_id).slice(0, 8)}…</td>
          <td>${actions}</td>
        </tr>`;
      })
      .join('');
    $('#reports-table').innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Type</th><th>Reason</th><th>Reporter</th><th>When</th><th>Target</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div><span class="count">${data.length} shown</span>`;

    panelEl.querySelectorAll('[data-resolve]').forEach((b) =>
      b.addEventListener('click', () => resolveReport(b.dataset.resolve, 'resolved')),
    );
    panelEl.querySelectorAll('[data-dismiss]').forEach((b) =>
      b.addEventListener('click', () => resolveReport(b.dataset.dismiss, 'dismissed')),
    );
  } catch (e) {
    $('#reports-table').innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
}

async function resolveReport(id, status) {
  const { error } = await supabase
    .from('reports')
    .update({ status, resolved_at: new Date().toISOString(), resolved_by: currentUserId })
    .eq('id', id);
  if (error) {
    alert(error.message);
    return;
  }
  moderation();
}

async function operations() {
  panelEl.innerHTML = `<h1>Operations</h1><p class="panel-sub">Scheduled jobs and data health.</p>
    <div class="stats" id="ops-stats"><div class="empty">Loading…</div></div>
    <div class="card"><h2>Scheduled jobs</h2>
      <div class="job-row"><span class="pill good">Hourly</span>
        <span class="mono">archive-past-events</span>
        <span class="muted">— <span class="mono">0 * * * *</span> · runs <span class="mono">archive_past_events()</span></span>
      </div>
      <p style="margin-top:10px">Archives events ~24h after they end (recurring ones roll forward instead).
      Scheduled server-side with pg_cron; the sweep is not client-callable by design.</p>
    </div>
    <div class="card"><h2>Runbook — enable &amp; schedule</h2>
      <p>Run once in the Supabase SQL Editor if <span class="mono">supabase db push</span> can't create the extension:</p>
      <pre>create extension if not exists pg_cron;

select cron.schedule(
  'archive-past-events', '0 * * * *',
  $$ select public.archive_past_events(); $$
);</pre>
      <p style="margin-top:10px">Trigger a manual sweep (SQL Editor, runs as an elevated role):
      <span class="mono">select public.archive_past_events();</span></p>
    </div>`;

  const nowMinus24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  try {
    const [active, archived, awaiting] = await Promise.all([
      count('events', (q) => q.eq('status', 'active')),
      count('events', (q) => q.eq('status', 'archived')),
      count('events', (q) => q.eq('status', 'active').lt('ends_at', nowMinus24h)),
    ]);
    $('#ops-stats').innerHTML = `
      <div class="stat"><div class="num">${active}</div><div class="label">Active events</div></div>
      <div class="stat"><div class="num">${archived}</div><div class="label">Archived events</div></div>
      <div class="stat ${awaiting === 0 ? 'good' : 'warn'}"><div class="num">${awaiting}</div>
        <div class="label">Awaiting archival${awaiting ? ' — sweep may be behind' : ''}</div></div>`;
  } catch (e) {
    $('#ops-stats').innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
}

let eventFilter = 'all';
async function events() {
  const chips = ['all', 'active', 'archived', 'cancelled']
    .map((s) => `<button class="chip ${s === eventFilter ? 'active' : ''}" data-filter="${s}">${s}</button>`)
    .join('');
  panelEl.innerHTML = `<h1>Events</h1><p class="panel-sub">Newest first · up to 200.</p>
    <div class="toolbar">${chips}</div>
    <div id="events-table"><div class="empty">Loading…</div></div>`;

  panelEl.querySelectorAll('[data-filter]').forEach((b) =>
    b.addEventListener('click', () => {
      eventFilter = b.dataset.filter;
      events();
    }),
  );

  try {
    let q = supabase
      .from('events')
      .select('id, title, status, starts_at, area_label, venue_type, host:profiles!events_host_id_fkey(display_name)')
      .order('starts_at', { ascending: false })
      .limit(200);
    if (eventFilter !== 'all') q = q.eq('status', eventFilter);
    const { data, error } = await q;
    if (error) throw error;
    if (!data.length) {
      $('#events-table').innerHTML = '<div class="empty">No events.</div>';
      return;
    }
    const rows = data
      .map(
        (e) => `<tr>
          <td class="wrap">${esc(e.title)}</td>
          <td><span class="status ${esc(e.status)}">${esc(e.status)}</span></td>
          <td>${fmtDate(e.starts_at)}</td>
          <td>${esc(e.area_label) || '—'}</td>
          <td class="muted">${esc(e.venue_type)}</td>
          <td>${esc(e.host?.display_name) || '—'}</td>
        </tr>`,
      )
      .join('');
    $('#events-table').innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Title</th><th>Status</th><th>Starts</th><th>Area</th><th>Venue</th><th>Host</th></tr></thead>
      <tbody>${rows}</tbody></table></div><span class="count">${data.length} shown</span>`;
  } catch (e) {
    $('#events-table').innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
}

async function users() {
  panelEl.innerHTML = `<h1>Users</h1><p class="panel-sub">Newest first · up to 200.</p>
    <div id="users-table"><div class="empty">Loading…</div></div>`;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, home_area, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    if (!data.length) {
      $('#users-table').innerHTML = '<div class="empty">No users.</div>';
      return;
    }
    const rows = data
      .map(
        (u) => `<tr>
          <td>${esc(u.display_name)}</td>
          <td>${esc(u.home_area) || '—'}</td>
          <td>${fmtDate(u.created_at)}</td>
          <td class="mono muted">${esc(u.id)}</td>
        </tr>`,
      )
      .join('');
    $('#users-table').innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Home area</th><th>Joined</th><th>ID</th></tr></thead>
      <tbody>${rows}</tbody></table></div><span class="count">${data.length} shown</span>`;
  } catch (e) {
    $('#users-table').innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
}

// ---- navigation ----
function showPanel(name) {
  panelEl.querySelectorAll && (panelEl.innerHTML = '');
  document.querySelectorAll('.nav-item').forEach((b) =>
    b.classList.toggle('active', b.dataset.panel === name),
  );
  (PANELS[name] || operations)();
}

document.querySelectorAll('.nav-item').forEach((b) =>
  b.addEventListener('click', () => showPanel(b.dataset.panel)),
);

// ---- auth ----
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#login-btn');
  const err = $('#login-error');
  err.hidden = true;
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  const { error } = await supabase.auth.signInWithPassword({
    email: $('#email').value.trim(),
    password: $('#password').value,
  });
  btn.disabled = false;
  btn.textContent = 'Sign in';
  if (error) {
    err.textContent = error.message;
    err.hidden = false;
  }
});

$('#signout').addEventListener('click', () => supabase.auth.signOut());

async function refreshAdminGate() {
  let isAdmin = false;
  try {
    const { data } = await supabase.from('admins').select('user_id').eq('user_id', currentUserId);
    isAdmin = !!(data && data.length);
  } catch {
    isAdmin = false;
  }
  document.querySelectorAll('[data-admin-only]').forEach((el) => (el.hidden = !isAdmin));
}

function render(session) {
  const signedIn = !!session;
  loginView.hidden = signedIn;
  consoleView.hidden = !signedIn;
  currentUserId = signedIn ? session.user.id : null;
  if (signedIn) {
    $('#who').textContent = session.user.email;
    refreshAdminGate();
    showPanel('operations');
  }
}

supabase.auth.getSession().then(({ data }) => render(data.session));
supabase.auth.onAuthStateChange((_event, session) => render(session));
