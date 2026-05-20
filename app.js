// ── Ubidots ────────────────────────────────────────────────────────────────
const BASE = 'https://industrial.api.ubidots.com/api/v1.6';

const DEVICES = {
  reaura: { label: 'reaura-garden-01' },
  reora:  { label: 'reora-plant-01'   },
  repool: { label: 'reformia-pool-01' },
};

const COLORS = [
  { name: 'Beyaz',    r: 255, g: 255, b: 255, hex: '#ffffff' },
  { name: 'Kırmızı', r: 255, g: 0,   b: 0,   hex: '#ff0000' },
  { name: 'Yeşil',   r: 0,   g: 255, b: 0,   hex: '#00ff00' },
  { name: 'Mavi',    r: 0,   g: 0,   b: 255, hex: '#0000ff' },
  { name: 'Sarı',    r: 255, g: 255, b: 0,   hex: '#ffff00' },
  { name: 'Turuncu', r: 255, g: 100, b: 0,   hex: '#ff6400' },
  { name: 'Mor',     r: 160, g: 0,   b: 255, hex: '#a000ff' },
  { name: 'Pembe',   r: 255, g: 80,  b: 160, hex: '#ff50a0' },
];

function token() { return localStorage.getItem('ubidots_token') || ''; }

// ── Busy lock — prevents double-clicks from firing multiple requests ────────
let busy = false;
function lock()   { busy = true;  setAllButtons(true);  }
function unlock() { busy = false; setAllButtons(false); }

function setAllButtons(disabled) {
  document.querySelectorAll('.btn, .color-swatch').forEach(b => {
    b.disabled = disabled;
    if (disabled) b.style.opacity = '0.5';
    else b.style.opacity = '';
  });
}

// ── API ────────────────────────────────────────────────────────────────────
async function readVar(device, variable) {
  try {
    const res = await fetch(`${BASE}/devices/${device}/${variable}/values/?page_size=1`, {
      headers: { 'X-Auth-Token': token() },
    });
    if (!res.ok) return null;
    const d = await res.json();
    return d.results?.[0]?.value ?? null;
  } catch { return null; }
}

async function readVars(device, vars) {
  const entries = await Promise.all(
    vars.map(async v => [v, await readVar(device, v)])
  );
  return Object.fromEntries(entries);
}

async function writeVars(device, payload) {
  await fetch(`${BASE}/devices/${device}/`, {
    method: 'POST',
    headers: { 'X-Auth-Token': token(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ── UI helpers ────────────────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }

function setStatus(id, on) {
  const e = el(id);
  if (!e) return;
  e.textContent = on ? 'AÇIK' : 'KAPALI';
  e.className = 'badge ' + (on ? 'badge-on' : 'badge-off');
}

function setText(id, text) {
  const e = el(id);
  if (e) e.textContent = text;
}

function setActive(id, active) {
  const e = el(id);
  if (!e) return;
  if (active) e.classList.add('active');
  else e.classList.remove('active');
}

// ── Reaura ────────────────────────────────────────────────────────────────
let reauraState = { lamps: 0, auto: 0, r: 0, g: 0, b: 0, ldr: null };

function applyReauraUI() {
  setStatus('reaura-lamp-badge', reauraState.lamps);
  setStatus('reaura-auto-badge', reauraState.auto);
  setActive('btn-lamp-on',  reauraState.lamps === 1 && reauraState.auto === 0);
  setActive('btn-lamp-off', reauraState.lamps === 0 && reauraState.auto === 0);
  setActive('btn-auto-on',  reauraState.auto === 1);
  const ldr = reauraState.ldr;
  if (ldr != null) {
    const desc = ldr < 2000 ? 'Aydınlık ☀️' : ldr > 2500 ? 'Karanlık 🌙' : 'Alacakaranlık 🌇';
    setText('ldr-value', `${ldr} — ${desc}`);
  } else {
    setText('ldr-value', 'N/A');
  }
  el('color-preview').style.background = `rgb(${reauraState.r},${reauraState.g},${reauraState.b})`;
}

async function refreshReaura() {
  const d = await readVars(DEVICES.reaura.label, [
    'lamps_control', 'auto_mode',
    'rgb_red_control', 'rgb_green_control', 'rgb_blue_control', 'ldr_value',
  ]);
  reauraState = {
    lamps: d.lamps_control       ?? 0,
    auto:  d.auto_mode           ?? 0,
    r:     d.rgb_red_control     ?? 0,
    g:     d.rgb_green_control   ?? 0,
    b:     d.rgb_blue_control    ?? 0,
    ldr:   d.ldr_value,
  };
  applyReauraUI();
}

async function reauraLamp(on) {
  if (busy) return;
  lock();
  reauraState.lamps = on ? 1 : 0;   // immediate optimistic update
  reauraState.auto  = 0;
  applyReauraUI();
  await writeVars(DEVICES.reaura.label, { lamps_control: on ? 1 : 0 });
  await refreshReaura();
  unlock();
}

async function reauraAuto(on) {
  if (busy) return;
  lock();
  reauraState.auto = on ? 1 : 0;
  applyReauraUI();
  await writeVars(DEVICES.reaura.label, { auto_mode: on ? 1 : 0 });
  await refreshReaura();
  unlock();
}

async function reauraColor(r, g, b) {
  if (busy) return;
  lock();
  reauraState.lamps = 1; reauraState.r = r; reauraState.g = g; reauraState.b = b;
  applyReauraUI();
  await writeVars(DEVICES.reaura.label, {
    lamps_control: 1, rgb_red_control: r, rgb_green_control: g, rgb_blue_control: b,
  });
  await refreshReaura();
  unlock();
}

// ── Reora ─────────────────────────────────────────────────────────────────
let reoraState = { pump: 0, auto: 0 };

function applyReoraUI() {
  setStatus('reora-pump-badge', reoraState.pump);
  setStatus('reora-auto-badge', reoraState.auto);
  setActive('btn-reora-pump-on',  reoraState.pump === 1);
  setActive('btn-reora-pump-off', reoraState.pump === 0);
  setActive('btn-reora-auto-on',  reoraState.auto === 1);
  setActive('btn-reora-auto-off', reoraState.auto === 0);
}

async function refreshReora() {
  const d = await readVars(DEVICES.reora.label, [
    'soil_moisture', 'temperature', 'humidity', 'pump_status', 'auto_mode',
  ]);
  reoraState = { pump: d.pump_status ?? 0, auto: d.auto_mode ?? 0 };
  applyReoraUI();
  const moist = d.soil_moisture;
  const moistDesc = moist != null
    ? (moist < 30 ? ' ⚠️ Kuru' : moist > 60 ? ' ✅ Nemli' : ' Normal') : '';
  setText('reora-moisture', moist != null ? `${moist.toFixed(0)}%${moistDesc}` : 'N/A');
  setText('reora-temp',     d.temperature != null ? `${d.temperature.toFixed(1)}°C` : 'N/A');
  setText('reora-humidity', d.humidity    != null ? `${d.humidity.toFixed(0)}%`    : 'N/A');
}

async function reoraPump(on) {
  if (busy) return;
  lock();
  reoraState.pump = on ? 1 : 0;
  applyReoraUI();
  await writeVars(DEVICES.reora.label, { pump_status: on ? 1 : 0 });
  await refreshReora();
  unlock();
}

async function reoraAuto(on) {
  if (busy) return;
  lock();
  reoraState.auto = on ? 1 : 0;
  applyReoraUI();
  await writeVars(DEVICES.reora.label, { auto_mode: on ? 1 : 0 });
  await refreshReora();
  unlock();
}

// ── Repool ────────────────────────────────────────────────────────────────
let repoolState = { pump: 0, drain: 0, auto: 0 };

function applyRepoolUI() {
  setStatus('repool-pump-badge',  repoolState.pump);
  setStatus('repool-drain-badge', repoolState.drain);
  setStatus('repool-auto-badge',  repoolState.auto);
  setActive('btn-repool-pump-on',   repoolState.pump  === 1);
  setActive('btn-repool-pump-off',  repoolState.pump  === 0);
  setActive('btn-repool-drain-on',  repoolState.drain === 1);
  setActive('btn-repool-drain-off', repoolState.drain === 0);
  setActive('btn-repool-auto-on',   repoolState.auto  === 1);
  setActive('btn-repool-auto-off',  repoolState.auto  === 0);
}

async function refreshRepool() {
  const d = await readVars(DEVICES.repool.label, [
    'water_level', 'temperature', 'pump_status', 'drain_status', 'auto_mode',
  ]);
  repoolState = { pump: d.pump_status ?? 0, drain: d.drain_status ?? 0, auto: d.auto_mode ?? 0 };
  applyRepoolUI();
  const lvl = d.water_level;
  const lvlDesc = lvl != null
    ? (lvl < 40 ? ' ⚠️ Düşük' : lvl > 85 ? ' ✅ Dolu' : ' Normal') : '';
  setText('repool-level', lvl != null ? `${lvl.toFixed(0)}%${lvlDesc}` : 'N/A');
  setText('repool-temp',  d.temperature != null ? `${d.temperature.toFixed(1)}°C` : 'N/A');
}

async function repoolPump(on) {
  if (busy) return;
  lock();
  repoolState.pump = on ? 1 : 0;
  applyRepoolUI();
  await writeVars(DEVICES.repool.label, { pump_status: on ? 1 : 0 });
  await refreshRepool();
  unlock();
}

async function repoolDrain(on) {
  if (busy) return;
  lock();
  repoolState.drain = on ? 1 : 0;
  applyRepoolUI();
  await writeVars(DEVICES.repool.label, { drain_status: on ? 1 : 0 });
  await refreshRepool();
  unlock();
}

async function repoolAuto(on) {
  if (busy) return;
  lock();
  repoolState.auto = on ? 1 : 0;
  applyRepoolUI();
  await writeVars(DEVICES.repool.label, { auto_mode: on ? 1 : 0 });
  await refreshRepool();
  unlock();
}

// ── Color swatches ────────────────────────────────────────────────────────
function buildColorSwatches() {
  const grid = el('color-grid');
  COLORS.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'color-swatch';
    btn.title = c.name;
    btn.style.background = c.hex;
    btn.addEventListener('click', () => reauraColor(c.r, c.g, c.b));
    grid.appendChild(btn);
  });
}

// ── Token modal ───────────────────────────────────────────────────────────
function openSettings() {
  el('token-input').value = token();
  el('settings-modal').classList.add('open');
}

function closeSettings() {
  el('settings-modal').classList.remove('open');
}

function saveToken() {
  const t = el('token-input').value.trim();
  if (t) localStorage.setItem('ubidots_token', t);
  closeSettings();
  refreshAll();
}

// ── Refresh all ───────────────────────────────────────────────────────────
function setLastUpdated() {
  const now = new Date().toLocaleTimeString('tr-TR');
  setText('last-updated', `Son güncelleme: ${now}`);
}

async function refreshAll() {
  if (busy) return;
  setText('last-updated', 'Güncelleniyor...');
  await Promise.all([refreshReaura(), refreshReora(), refreshRepool()]);
  setLastUpdated();
}

// ── Boot ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildColorSwatches();
  if (!token()) openSettings();
  else refreshAll();
  setInterval(refreshAll, 8000);
  if ('serviceWorker' in navigator)
    navigator.serviceWorker.register('/sw.js');
});
