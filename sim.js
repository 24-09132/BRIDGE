/* FLOOD-SENTINEL – Simulation page: weather presets drive the same model the ESP32 uses */
(function () {
  const $ = (id) => document.getElementById(id);
  const M = FS.monitor;
  const TICK_MS = 1000;            // one simulation step per second
  const RIVER_TAU_MIN = 40;        // river levels approach the preset target with a 40-minute time constant

  // Each preset switches the conditions at once (rain collected, rain rate and river levels)
  const PRESETS = {
    clear:    { name: 'Clear & Dry',     rain: 0,  rate: 0,   pook: 0.1, bay: 0.1 },
    drizzle:  { name: 'Gentle Drizzle',  rain: 2,  rate: 1.5, pook: 0.4, bay: 0.3 },
    moderate: { name: 'Moderate Rain',   rain: 5,  rate: 6,   pook: 0.8, bay: 0.5 },
    downpour: { name: 'Heavy Downpour',  rain: 9,  rate: 20,  pook: 1.4, bay: 0.9 },
    flood:    { name: 'Flood Emergency', rain: 15, rate: 40,  pook: 2.2, bay: 1.8 },
  };

  const s = { rain: 0, rate: 0, pook: 0, bay: 0, target: { pook: 0, bay: 0 }, preset: 'Manual',
              clock: new Date(), running: false, timer: null, steps: 0 };

  function resetClock() { const d = new Date(); d.setSeconds(0, 0); s.clock = d; }

  function syncSliders() {
    const set = (id, v, d, unit) => { $('s-' + id).value = v; $('s-' + id + '-v').textContent = `${Number(v).toFixed(d)} ${unit}`; };
    set('rate', s.rate, 1, 'mm/h'); set('rain', s.rain, 1, 'mm');
    set('pook', s.pook, 2, 'cm'); set('bay', s.bay, 2, 'cm');
  }

  function info() {
    M.setInfo({
      'Mode': s.running ? '<span class="ok">Running</span>' : '<span class="warn-t">Paused</span>',
      'Weather preset': s.preset,
      'Simulated time': `${FS.dateStr(s.clock)} ${FS.timeStr(s.clock)}`,
      'Step size': `${$('b-speed').selectedOptions[0].text}`,
      'Steps recorded': s.steps,
      'SMS sent': M.events.length ? `${M.events.length} × 10 numbers` : 'None',
    });
    $('sim-pill').textContent = s.running ? 'RUNNING' : 'PAUSED';
    $('sim-pill').style.cssText = s.running ? 'color:#22c55e;border-color:#22c55e66;background:#22c55e1a' : '';
    $('b-run').textContent = s.running ? '❚❚ Pause' : '▶ Start';
  }

  function reading() {
    const r2 = (v) => Math.round(v * 100) / 100;
    return { ts: new Date(s.clock), rain: Math.round(s.rain * 10) / 10, rate: s.rate, pook: r2(s.pook), bay: r2(s.bay) };
  }
  let link = null;
  function show() { syncSliders(); const r = reading(); M.update(r, { record: false }); info(); if (link) link.send(r); }

  function step() {
    const dtMin = +$('b-speed').value;
    s.clock = new Date(s.clock.getTime() + dtMin * 60000);
    const wasFull = s.rain >= 40;
    s.rain = Math.min(40, s.rain + (s.rate * dtMin) / 60);
    const k = 1 - Math.exp(-dtMin / RIVER_TAU_MIN);
    ['pook', 'bay'].forEach((x) => { s[x] = +(s[x] + (s.target[x] - s[x]) * k).toFixed(3); });
    s.steps++;
    syncSliders();
    const r = reading();
    M.update(r, { record: true });
    if (link) link.send(r);
    if (s.rain >= 40 && !wasFull) M.log('Rain container is full (40 mm) – empty it to keep measuring.', 'warn', s.clock);
    info();
  }

  function setRunning(on) {
    s.running = on;
    clearInterval(s.timer);
    if (on) { step(); s.timer = setInterval(step, TICK_MS); M.log(`Simulation started (${s.preset}).`, 'info', s.clock); }
    info();
  }

  function applyPreset(key) {
    const p = PRESETS[key];
    s.preset = p.name; s.rate = p.rate; s.rain = p.rain;
    s.pook = p.pook; s.bay = p.bay;
    s.target = { pook: p.pook, bay: p.bay };
    document.querySelectorAll('.preset').forEach((b) => b.classList.toggle('active', b.dataset.p === key));
    M.log(`Weather: ${p.name}`, 'info', s.clock);
    if (s.running) step(); else setRunning(true);
  }

  function bind() {
    document.querySelectorAll('.preset').forEach((b) => b.addEventListener('click', () => applyPreset(b.dataset.p)));
    ['rate', 'rain', 'pook', 'bay'].forEach((k) => $('s-' + k).addEventListener('input', (e) => {
      s[k] = +e.target.value;
      if (k in s.target) s.target[k] = s[k];
      s.preset = 'Manual';
      document.querySelectorAll('.preset').forEach((b) => b.classList.remove('active'));
      show();
    }));
    $('b-run').onclick = () => setRunning(!s.running);
    $('b-step').onclick = () => step();
    $('b-empty').onclick = () => { s.rain = 0; M.log('Rain container emptied.', 'info', s.clock); show(); };
    $('b-speed').onchange = info;
    $('b-reset').onclick = () => {
      setRunning(false);
      Object.assign(s, { rain: 0, rate: 0, pook: 0, bay: 0, target: { pook: 0, bay: 0 }, preset: 'Manual', steps: 0 });
      M.resetSms(0);
      resetClock();
      document.querySelectorAll('.preset').forEach((b) => b.classList.remove('active'));
      show();
      M.log('Simulation reset.', 'info');
    };
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!(await FS.requireLogin())) return;
    FS.renderNav('sim');
    M.mount($('monitor'), { mode: 'sim' });
    link = FS.deviceLink($('device-link'), 'simulation');
    resetClock();
    bind();
    show();
    M.onSms = info;
    M.log('Pick a weather preset or move the sliders.', 'info');
  });
})();
