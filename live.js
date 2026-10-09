/* FLOOD-SENTINEL – Live Monitor page: reads the ESP32 data stored by the Vercel API */
(function () {
  const ONLINE_MAX_AGE_MS = 150000;  // ESP32 posts every 60 s (every 5 s during a website demo)
  const POLL_MS = 10000;
  const M = FS.monitor;
  let lastTs = 0;
  let latest = null;

  function ago(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return s + ' s ago';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    return Math.round(s / 86400) + ' day(s) ago';
  }
  function uptime(sec) {
    if (sec === undefined || sec === null) return '--';
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h ? `${h} h ${m} min` : `${m} min`;
  }
  function signal(rssi) {
    if (rssi === undefined || rssi === null) return '--';
    const q = rssi >= -60 ? 'Strong' : rssi >= -70 ? 'Good' : rssi >= -80 ? 'Fair' : 'Weak';
    return `${rssi} dBm (${q})`;
  }

  function setConn(kind, text) {
    const p = document.getElementById('conn-pill');
    p.textContent = text;
    const c = kind === 'on' ? '#22c55e' : kind === 'off' ? '#ef4444' : kind === 'demo' ? '#eab308' : '#8d9ab5';
    p.style.cssText = `color:${c};border-color:${c}66;background:${c}1a`;
  }

  function showInfo() {
    if (!latest) {
      M.setInfo({ 'Connection': '<span class="bad">No data yet</span>' });
      return;
    }
    const age = Date.now() - latest.timestamp;
    const online = age <= ONLINE_MAX_AGE_MS;
    const demo = online && latest.mode === 'simulation';
    M.setInfo({
      'Connection': online ? '<span class="ok">Online</span>' : '<span class="bad">Offline</span>',
      ...(demo ? { 'Mode': `<span class="warn-t">Demo – ${latest.source === 'trial' ? 'Trial Results' : 'Simulation'} page</span>` } : {}),
      'Last update': `${FS.timeStr(new Date(latest.timestamp), true)} (${ago(age)})`,
      'SMS alerts': latest.gsm_ready ? '<span class="ok">Ready</span>' : '<span class="warn-t">Connecting</span>',
      'SMS sent': latest.sms_sent ?? 0,
      'Recipients': '10 numbers',
    });
    if (demo) setConn('demo', 'DEMO MODE');
    else setConn(online ? 'on' : 'off', online ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE');
  }

  function toReading(d) {
    return {
      ts: new Date(d.timestamp),
      rain: d.rainfall_mm, rate: d.rain_rate,
      pook: d.pook_cm ?? (d.pook_mm !== undefined ? d.pook_mm / 10 : null),
      bay: d.bay_cm ?? (d.bay_mm !== undefined ? d.bay_mm / 10 : null),
      prob: d.flood_prob, rssi: d.rssi, gsm: d.gsm_ready, sms: d.sms_sent,
    };
  }

  async function loadHistory() {
    try {
      const res = await fetch('/api/history', { cache: 'no-store' });
      if (!res.ok) return;
      const h = await res.json();
      if (!Array.isArray(h) || !h.length) return;
      h.filter((p) => p.t && p.r !== undefined).forEach((p) => {
        M.update({ ts: new Date(p.t), rain: p.r, rate: p.q ?? 0, pook: p.k, bay: p.b, prob: p.p }, { record: true });
        lastTs = Math.max(lastTs, p.t);
      });
      M.log(`Loaded ${h.length} earlier reading(s).`, 'info');
    } catch (e) { /* optional */ }
  }

  async function poll() {
    try {
      const res = await fetch('/api/telemetry', { cache: 'no-store' });
      if (res.status === 401) { location.replace('index.html'); return; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      if (d.rainfall_mm === undefined || !d.timestamp) {
        setConn('off', 'NO DATA YET');
        showInfo();
        return;
      }
      latest = d;
      if (d.timestamp > lastTs) {
        lastTs = d.timestamp;
        M.update(toReading(d), { record: true });
      } else if (!M.rows.length) {
        M.update(toReading(d), { record: false });
      }
      showInfo();
    } catch (e) {
      setConn('off', 'SERVER UNREACHABLE');
      M.log('Cannot reach the server.', 'err');
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!(await FS.requireLogin())) return;
    FS.renderNav('live');
    M.mount(document.getElementById('monitor'), { mode: 'live' });
    M.log('Waiting for data from the monitoring station…', 'info');
    showInfo();
    await loadHistory();
    await poll();
    setInterval(poll, POLL_MS);
    setInterval(showInfo, 5000);
  });
})();
