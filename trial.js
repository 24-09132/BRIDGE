/* FLOOD-SENTINEL – Trial Results page (paper Figure 2, 3 and 4) */
(function () {
  const $ = (id) => document.getElementById(id);
  const L = FS.LED_INFO;
  const DATE = '2026-09-01';
  let playTimer = null;
  let link = null;

  const rows = FS_TRIAL.map((r) => {
    const prob = fsProbability(r.rain, r.pook, r.bay);
    return { ...r, prob, ci: fsClassIndex(prob) };
  });

  function showRow(i) {
    const r = rows[i], l = L[r.ci], color = FS_CLASSES[r.ci].color;
    $('road-name').textContent = l.road.toUpperCase();
    $('road-name').style.color = color;
    $('road-desc').textContent = l.meaning;
    $('t-time').textContent = `${DATE} ${r.time}`;
    L.forEach((x, k) => $('led-' + x.led.toLowerCase()).classList.toggle('on', k === r.ci));
    document.querySelectorAll('#t-body tr').forEach((tr) => tr.classList.toggle('current', +tr.dataset.i === i));
    if (link) link.send({ rain: r.rain, rate: 0, pook: r.pook, bay: r.bay });
    L.forEach((x, k) => $('tm-' + k).classList.toggle('on', k === r.ci));
  }

  function build() {
    $('leds').innerHTML = L.map((l) => `<div class="led led-${l.led.toLowerCase()}" id="led-${l.led.toLowerCase()}"><span class="lamp"></span><b>${l.led.toUpperCase()}</b></div>`).join('');
    $('t-matrix').innerHTML = L.map((l, i) => `<tr id="tm-${i}"><td><span class="dot d-${l.led.toLowerCase()}"></span>${l.led}</td><td>${l.road}</td><td>${l.meaning}</td></tr>`).join('');
    $('t-body').innerHTML = rows.map((r, i) => `<tr data-i="${i}"><td>${DATE}</td><td>${r.time}</td><td>${r.rain.toFixed(1)}</td><td>${r.pook.toFixed(1)}</td><td>${r.bay.toFixed(1)}</td><td>${r.obs}</td>
      <td>${L[r.ci].road}</td><td><span class="led-cell lc-${L[r.ci].led.toLowerCase()}">${L[r.ci].led}</span></td><td>${r.prob.toFixed(1)}</td></tr>`).join('');
    document.querySelectorAll('#t-body tr').forEach((tr) => tr.addEventListener('click', () => { stop(); showRow(+tr.dataset.i); }));

    const ev = []; let last = 0;
    rows.forEach((r) => { if (r.ci !== last) ev.push(r); last = r.ci; });
    $('t-sms').innerHTML = ev.map((r) => `<tr><td>${r.time}</td><td><span class="dot d-${L[r.ci].led.toLowerCase()}"></span>${L[r.ci].road}</td><td>10 numbers</td></tr>`).join('');

    const m = FS_MODEL;
    const ranges = [`below ${m.tRestricted}%`, `${m.tRestricted}% – below ${m.tMoreRestricted}%`, `${m.tMoreRestricted}% – below ${m.tImpassable}%`, `${m.tImpassable}% and above`];
    $('t-rules').innerHTML = L.map((l, i) => `<tr><td>${ranges[i]}</td><td>${l.road}</td><td><span class="dot d-${l.led.toLowerCase()}"></span>${l.led}</td></tr>`).join('');

    const max = (k) => Math.max(...rows.map((r) => r[k]));
    $('summary').innerHTML = [
      ['Readings', rows.length], ['Max rainfall', max('rain').toFixed(1) + ' mm'],
      ['Max Pook-side level', max('pook').toFixed(1) + ' cm'], ['Max Bay-connected level', max('bay').toFixed(1) + ' cm'],
      ['Max flood probability', max('prob').toFixed(1) + ' %'], ['Observed floods', rows.filter((r) => r.obs).length],
      ['SMS events', `${ev.length} × 10 = ${ev.length * 10} SMS`],
    ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  }

  function charts() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = '#8d9ab5'; Chart.defaults.borderColor = '#22304d';
    Chart.defaults.font.family = 'Inter, sans-serif'; Chart.defaults.font.size = 11;
    new Chart($('c-time'), {
      type: 'line',
      data: { labels: rows.map((r) => r.time), datasets: [{ label: 'Flood probability (%)', data: rows.map((r) => +r.prob.toFixed(1)),
        borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.15)', fill: true, tension: 0.25, pointRadius: 3 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } },
        scales: { y: { min: 0, max: 100, title: { display: true, text: 'Flood probability (%)' } }, x: { title: { display: true, text: 'Time (Sep 1, 2026)' } } } },
    });
    new Chart($('c-rain'), {
      type: 'scatter',
      data: { datasets: [{ label: 'Trial readings', data: rows.map((r) => ({ x: r.rain, y: +r.prob.toFixed(1) })),
        backgroundColor: '#eab308', borderColor: '#eab308', showLine: true, pointRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } },
        scales: { x: { min: 0, title: { display: true, text: 'Rainfall (mm)' } }, y: { min: 0, max: 100, title: { display: true, text: 'Flood probability (%)' } } } },
    });
  }

  function stop() { clearInterval(playTimer); playTimer = null; $('b-play').textContent = '▶ Replay trial'; }
  function play() {
    if (playTimer) return stop();
    let i = 0; showRow(i);
    $('b-play').textContent = '❚❚ Pause';
    // slower while the real device follows, so its LEDs and SMS can keep up
    playTimer = setInterval(() => { i++; if (i >= rows.length) return stop(); showRow(i); }, link && link.on ? 6000 : 1500);
  }

  function exportXlsx() {
    const ev = []; let last = 0;
    rows.forEach((r) => { if (r.ci !== last) ev.push(r); last = r.ci; });
    FSXlsx.download('FLOOD-SENTINEL_Trial_Results_2026-09-01.xlsx', [
      {
        name: 'Trial Data', title: 'FLOOD-SENTINEL Trial Results – Figure 2',
        subtitle: 'Flood Probability = 100 / (1 + e^-(−3.9822 + 0.2208·Rainfall + 0.7994·Pook + 1.2461·Bay))',
        columns: [
          { header: 'Date', width: 12, type: 'text' }, { header: 'Time', width: 9, type: 'text' },
          { header: 'Rainfall (mm)', width: 13, type: 'num1' }, { header: 'Pook-side water level (cm)', width: 17, type: 'num1' },
          { header: 'Bay-connected river water level (cm)', width: 20, type: 'num1' }, { header: 'Observed Flood (0/1)', width: 13, type: 'int' },
          { header: 'Road Condition', width: 18, type: 'text' }, { header: 'LED Indicator', width: 13, type: 'led' },
          { header: 'Flood Probability (%)', width: 14, type: 'num1' },
        ],
        rows: rows.map((r) => [DATE, r.time, r.rain, r.pook, r.bay, r.obs, L[r.ci].road, L[r.ci].led, +r.prob.toFixed(1)]),
      },
      {
        name: 'SMS Events', title: 'SMS notifications during the trial (each to the 10 registered numbers)',
        columns: [{ header: 'Date', width: 12, type: 'text' }, { header: 'Time', width: 9, type: 'text' },
          { header: 'Road Condition', width: 18, type: 'text' }, { header: 'LED Indicator', width: 13, type: 'led' },
          { header: 'SMS message', width: 90, type: 'text' }, { header: 'Recipients', width: 11, type: 'int' }],
        rows: ev.map((r) => [DATE, r.time, L[r.ci].road, L[r.ci].led, FS_SMS_TEXTS[r.ci].replace('\n', ' '), 10]),
      },
    ]);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!(await FS.requireLogin())) return;
    FS.renderNav('trial');
    link = FS.deviceLink($('device-link'), 'trial');
    build();
    charts();
    showRow(rows.length - 1);
    $('b-play').onclick = play;
    $('b-xlsx').onclick = exportXlsx;
  });
})();
