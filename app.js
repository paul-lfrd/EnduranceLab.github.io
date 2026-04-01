'use strict';

// ══════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════

// Sports simples
const SPORT_CONFIG = {
  'course':   { label: 'Course Route',   color: '#ff6b35', class: 'run',    hasTrail: false },
  'natation': { label: 'Natation',       color: '#00bcd4', class: 'swim',   isSwim: true },
  'velo':     { label: 'Vélo',           color: '#7c4dff', class: 'bike' },
  'trail':    { label: 'Trail',          color: '#4caf50', class: 'trail',  hasTrail: true },
  'cross':    { label: 'Cross Country',  color: '#e91e63', class: 'cross' },
  'autres':   { label: 'Autres Sports',  color: '#9e9e9e', class: 'autres' },
};

// Sports multi-segments
const MULTI_CONFIG = {
  triathlon: {
    label: 'Triathlon',
    color: '#f5a623',
    segments: [
      { key: 'swim', label: 'Natation', icon: '🏊', isSwim: true },
      { key: 't1',   label: 'Transition 1', icon: '↔', isTransition: true },
      { key: 'bike', label: 'Vélo', icon: '🚴' },
      { key: 't2',   label: 'Transition 2', icon: '↔', isTransition: true },
      { key: 'run',  label: 'Course', icon: '🏃' },
    ],
    formats: {
      S: { swim: 0.75, bike: 20, run: 5 },
      O: { swim: 1.5,  bike: 40, run: 10 },
      M: { swim: 1.9,  bike: 90, run: 21.1 },
      L: { swim: 3.8,  bike: 180, run: 42.2 },
    }
  },
  duathlon: {
    label: 'Duathlon',
    color: '#ff9800',
    segments: [
      { key: 'run1', label: 'Course 1', icon: '🏃' },
      { key: 't1',   label: 'Transition', icon: '↔', isTransition: true },
      { key: 'bike', label: 'Vélo', icon: '🚴' },
      { key: 't2',   label: 'Transition 2', icon: '↔', isTransition: true },
      { key: 'run2', label: 'Course 2', icon: '🏃' },
    ]
  }
};

const CAT_LABELS = {
  'velo': 'Vélo', 'chaussures-run': 'Chaussures run', 'chaussures-trail': 'Chaussures trail',
  'chaussures-cross': 'Chaussures cross', 'combinaison': 'Combinaison', 'casque': 'Casque',
  'composant': 'Composant vélo', 'autre': 'Autre'
};

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

// ══════════════════════════════════════════════
// DB
// ══════════════════════════════════════════════

let db = { races: [], physio: [], materiel: [], composants: [] };
let _appReady = false;

// Called by firebase.js when remote data arrives
window.applyDataToApp = function(data) {
  db = { races: [], physio: [], materiel: [], composants: [], ...data };
  if (_appReady) refreshCurrentPage();
};

function saveDB() {
  // Save to Firestore via firebase.js (debounced)
  if (typeof window._scheduleSave === 'function') {
    window._scheduleSave({ ...db });
  }
  // Also cache locally for instant UI
  try { localStorage.setItem('elcache_local', JSON.stringify(db)); } catch(e) {}
}

function loadDB() {
  // Preload from local cache while Firebase loads
  try {
    const raw = localStorage.getItem('elcache_local');
    if (raw) db = { races: [], physio: [], materiel: [], composants: [], ...JSON.parse(raw) };
  } catch(e) {}
}

function refreshCurrentPage() {
  if (currentPage === 'dashboard') renderDashboard();
  else if (SPORT_CONFIG[currentPage]) renderSportPage(currentPage);
  else if (MULTI_CONFIG[currentPage]) renderMultiPage(currentPage);
  else if (currentPage === 'physio') renderPhysioPage();
  else if (currentPage === 'materiel') renderMaterielPage();
  else if (currentPage === 'planning') renderPlanningPage();
  else if (currentPage === 'calendrier') renderCalendar();
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ══════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════

let currentPage = 'dashboard';
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();

function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
  const nav = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (nav) nav.classList.add('active');
  currentPage = page;

  if (page === 'dashboard') renderDashboard();
  else if (SPORT_CONFIG[page]) renderSportPage(page);
  else if (MULTI_CONFIG[page]) renderMultiPage(page);
  else if (page === 'physio') renderPhysioPage();
  else if (page === 'materiel') renderMaterielPage();
  else if (page === 'planning') renderPlanningPage();
  else if (page === 'calendrier') renderCalendar();

  if (window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

function isPlanned(r) { return r.status === 'planned'; }
function isDone(r) { return !isPlanned(r); }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr); target.setHours(0,0,0,0);
  return Math.ceil((target - today) / 86400000);
}

// ══════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════

function renderDashboard() {
  const year = new Date().getFullYear();
  document.getElementById('currentYear').textContent = year;
  renderDashStats(year);
  renderDashRecent();
  renderDashPhysio();
  renderDashMaterielAlert();
}

function renderDashStats(year) {
  const el = document.getElementById('dash-stats');
  const done = db.races.filter(r => isDone(r) && r.date && r.date.startsWith(year.toString()));
  const planned = db.races.filter(r => isPlanned(r));

  const allSports = { ...SPORT_CONFIG, ...MULTI_CONFIG };
  const totalKm = done.reduce((s, r) => s + (r.distance || 0), 0);

  el.innerHTML = `
    <h3>Saison ${year}</h3>
    <div class="stat-row" style="margin-bottom:16px">
      <div class="stat-item"><span class="stat-value">${done.length}</span><span class="stat-label">Courses terminées</span></div>
      <div class="stat-item"><span class="stat-value">${totalKm.toFixed(0)}</span><span class="stat-label">km compétition</span></div>
      <div class="stat-item"><span class="stat-value" style="color:var(--planned)">${planned.length}</span><span class="stat-label">Planifiées</span></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${Object.entries(allSports).map(([k, cfg]) => {
        const count = done.filter(r => r.sport === k).length;
        if (!count) return '';
        return `<div style="display:flex;align-items:center;justify-content:space-between;font-size:12px">
          <span><span class="sport-dot" style="background:${cfg.color}"></span>${cfg.label}</span>
          <span style="font-family:var(--font-mono);color:var(--text2)">${count}</span>
        </div>`;
      }).join('')}
    </div>
  `;
}

function renderDashRecent() {
  const el = document.getElementById('dash-recent');
  const recent = [...db.races].filter(isDone).sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5);
  const allSports = { ...SPORT_CONFIG, ...MULTI_CONFIG };
  el.innerHTML = `<h3>Dernières courses</h3>
    ${recent.length === 0 ? '<div style="color:var(--text3);font-size:13px">Aucune course</div>' :
      recent.map(r => {
        const cfg = allSports[r.sport] || {};
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="showRaceDetail('${r.id}')">
          <div><span class="sport-dot" style="background:${cfg.color}"></span><span style="font-size:13px;font-weight:500">${escHtml(r.name)}</span></div>
          <div style="text-align:right">
            <div style="font-family:var(--font-mono);font-size:12px;color:var(--accent)">${formatTime(r.timeTotal)}</div>
            <div style="font-size:11px;color:var(--text3)">${formatDate(r.date)}</div>
          </div>
        </div>`;
      }).join('')
    }`;
}

function renderDashPhysio() {
  const el = document.getElementById('dash-physio');
  const lc = getLatestPhysio('course'), ln = getLatestPhysio('natation'), lv = getLatestPhysio('velo');
  el.innerHTML = `<h3>Données physio</h3>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${lc ? `<div><span class="badge" style="background:rgba(255,107,53,.1);color:var(--run)">Course</span>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:6px">
          ${lc.vma ? `<div class="physio-pill"><span class="label">VMA</span><span class="value">${lc.vma} km/h</span></div>` : ''}
          ${lc.fcmax ? `<div class="physio-pill"><span class="label">FC max</span><span class="value">${lc.fcmax} bpm</span></div>` : ''}
        </div></div>` : ''}
      ${lv ? `<div><span class="badge" style="background:rgba(124,77,255,.1);color:var(--bike)">Vélo</span>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:6px">
          ${lv.ftp ? `<div class="physio-pill"><span class="label">FTP</span><span class="value">${lv.ftp} W</span></div>` : ''}
          ${lv.pma ? `<div class="physio-pill"><span class="label">PMA</span><span class="value">${lv.pma} W</span></div>` : ''}
          ${lv.wkg ? `<div class="physio-pill"><span class="label">W/kg</span><span class="value">${lv.wkg}</span></div>` : ''}
        </div></div>` : ''}
      ${ln ? `<div><span class="badge" style="background:rgba(0,188,212,.1);color:var(--swim)">Natation</span>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:6px">
          ${ln.vc ? `<div class="physio-pill"><span class="label">Vit. critique</span><span class="value">${ln.vc}/100m</span></div>` : ''}
        </div></div>` : ''}
      ${!lc && !ln && !lv ? '<div style="color:var(--text3);font-size:13px">Aucune donnée</div>' : ''}
    </div>`;
}

function renderDashMaterielAlert() {
  const el = document.getElementById('dash-materiel-alert');
  const alerts = getMaterielAlerts();
  el.innerHTML = `<h3>Alertes matériel</h3>
    ${alerts.length === 0 ? '<div style="color:var(--text3);font-size:13px">Tout est en ordre ✓</div>' :
      alerts.map(a => `<div class="alert-banner ${a.level}"><span>${a.level === 'danger' ? '⚠️' : '⚡'}</span><span><strong>${escHtml(a.nom)}</strong> — ${a.msg}</span></div>`).join('')
    }`;
}

function getMaterielAlerts() {
  const alerts = [];
  db.materiel.forEach(m => {
    if (m.alerte) {
      const pct = m.km / m.alerte;
      if (pct >= 1) alerts.push({ nom: m.nom, msg: `Dépassement : ${m.km}/${m.alerte} km`, level: 'danger' });
      else if (pct >= 0.85) alerts.push({ nom: m.nom, msg: `Bientôt : ${m.km}/${m.alerte} km`, level: '' });
    }
    db.composants.filter(c => c.materielId === m.id && c.nextKm).forEach(c => {
      const since = m.km - c.km;
      const pct = since / c.nextKm;
      if (pct >= 1) alerts.push({ nom: `${m.nom} — ${c.type}`, msg: `Dépassé de ${since - c.nextKm} km`, level: 'danger' });
      else if (pct >= 0.85) alerts.push({ nom: `${m.nom} — ${c.type}`, msg: `Dans ${c.nextKm - since} km`, level: '' });
    });
  });
  return alerts;
}

function getLatestPhysio(sport) {
  return [...db.physio].filter(p => p.sport === sport).sort((a,b) => b.date.localeCompare(a.date))[0] || null;
}

// ══════════════════════════════════════════════
// SPORT PAGE (mono)
// ══════════════════════════════════════════════

function renderSportPage(sport) {
  renderPhysioBar(sport);
  renderRacesTable(sport);
}

function renderPhysioBar(sport) {
  const el = document.getElementById('physio-' + sport);
  if (!el) return;
  const pills = [];
  const lc = getLatestPhysio('course'), ln = getLatestPhysio('natation'), lv = getLatestPhysio('velo');

  if (['course','trail','cross'].includes(sport) && lc) {
    if (lc.vma) pills.push({ label: 'VMA', value: lc.vma + ' km/h', date: lc.date });
    if (lc.seuilAllure) pills.push({ label: 'Allure seuil', value: lc.seuilAllure + '/km', date: lc.date });
    if (lc.fcmax) pills.push({ label: 'FC max', value: lc.fcmax + ' bpm', date: lc.date });
  }
  if (sport === 'natation' && ln) {
    if (ln.vc) pills.push({ label: 'Vit. critique', value: ln.vc + '/100m', date: ln.date });
    if (ln.vsmax) pills.push({ label: 'Sprint', value: ln.vsmax + '/100m', date: ln.date });
  }
  if (sport === 'velo' && lv) {
    if (lv.ftp) pills.push({ label: 'FTP', value: lv.ftp + ' W', date: lv.date });
    if (lv.pma) pills.push({ label: 'PMA', value: lv.pma + ' W', date: lv.date });
    if (lv.wkg) pills.push({ label: 'W/kg', value: lv.wkg, date: lv.date });
  }
  if (sport === 'triathlon') {
    if (lc && lc.vma) pills.push({ label: 'VMA', value: lc.vma + ' km/h', date: lc.date });
    if (lv && lv.ftp) pills.push({ label: 'FTP', value: lv.ftp + ' W', date: lv.date });
    if (ln && ln.vc) pills.push({ label: 'Vit. critique', value: ln.vc + '/100m', date: ln.date });
  }

  if (!pills.length) {
    el.innerHTML = `<span style="color:var(--text3);font-size:12px">Aucune donnée physio — <a href="#" onclick="event.preventDefault();navigate('physio')" style="color:var(--accent)">ajouter</a></span>`;
    return;
  }
  el.innerHTML = pills.map(p => `<div class="physio-pill"><span class="label">${p.label}</span><span class="value">${p.value}</span><span class="date">${formatDate(p.date)}</span></div>`).join('');
}

function renderRacesTable(sport) {
  const el = document.getElementById('races-' + sport);
  if (!el) return;
  const races = db.races.filter(r => r.sport === sport).sort((a,b) => b.date.localeCompare(a.date));
  if (!races.length) { el.innerHTML = `<div class="empty-state"><span class="empty-icon">🏁</span>Aucune course enregistrée</div>`; return; }

  const cfg = SPORT_CONFIG[sport] || {};
  const isSwim = !!cfg.isSwim;
  const hasTrail = !!cfg.hasTrail;
  const isAutres = sport === 'autres';

  el.innerHTML = `<table>
    <thead><tr>
      <th>Statut</th><th>Date</th><th>Course</th>
      ${isAutres ? '<th>Discipline</th>' : ''}
      <th>Dist.</th>
      ${hasTrail ? '<th>D+</th>' : ''}
      <th>Temps</th>
      <th>${isSwim ? 'Allure/100m' : 'Allure/km'}</th>
      <th>Gén.</th><th>Cat.</th><th>Note</th><th></th>
    </tr></thead>
    <tbody>
      ${races.map(r => {
        const planned = isPlanned(r);
        const allure = isSwim ? formatPacePer100m(r.timeTotal, r.distance) : formatPacePerKm(r.timeTotal, r.distance);
        return `<tr class="${planned ? 'row-planned' : ''}" onclick="showRaceDetail('${r.id}')">
          <td>${planned ? `<span class="planned-badge">📅 Planifiée</span>` : `<span style="font-size:11px;color:var(--success)">✓</span>`}</td>
          <td style="color:var(--text2);font-size:12px">${formatDate(r.date)}</td>
          <td style="font-weight:500">${escHtml(r.name)}</td>
          ${isAutres ? `<td style="color:var(--text2);font-size:12px">${escHtml(r.autresSport||'')}</td>` : ''}
          <td>${r.distance ? r.distance + ' km' : '—'}</td>
          ${hasTrail ? `<td>${r.deniv ? r.deniv + ' m' : '—'}</td>` : ''}
          <td class="time-cell">${planned && r.goalTime ? '🎯 ' + formatTime(r.goalTime) : formatTime(r.timeTotal)}</td>
          <td class="time-cell" style="font-size:12px">${planned ? '—' : allure}</td>
          <td class="rank-cell">${r.rankGeneral ? r.rankGeneral + (r.participants ? '/'+r.participants : '') : '—'}</td>
          <td class="rank-cell">${r.rankCat || '—'}</td>
          <td class="stars-cell">${renderStars(r.note)}</td>
          <td onclick="event.stopPropagation()">
            ${planned ? `<button class="btn-planned" onclick="markAsDone('${r.id}')" title="Saisir résultat">✎ Résultat</button>` : ''}
            <button class="btn-icon" onclick="openRaceModal('${sport}','${r.id}')" title="Modifier">✎</button>
            <button class="btn-icon del" onclick="confirmDelete('race','${r.id}')" title="Supprimer">✕</button>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

// ══════════════════════════════════════════════
// RACE MODAL (mono-sport)
// ══════════════════════════════════════════════

let editingRaceId = null;

function openRaceModal(sport, raceId = null) {
  editingRaceId = raceId;
  const cfg = SPORT_CONFIG[sport] || {};
  document.getElementById('raceSport').value = sport;
  document.getElementById('raceModalTitle').textContent = raceId ? 'Modifier la course' : 'Nouvelle course — ' + cfg.label;
  document.getElementById('raceForm').reset();
  document.getElementById('raceId').value = raceId || '';
  document.getElementById('raceNote').value = '0';
  document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.weather-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('raceWeather').value = '';

  document.getElementById('denivField').style.display = cfg.hasTrail ? '' : 'none';
  document.getElementById('swimTimeField').style.display = cfg.isSwim ? '' : 'none';
  document.getElementById('autresSportField').style.display = sport === 'autres' ? '' : 'none';

  setRaceStatus('done');

  if (raceId) {
    const r = db.races.find(x => x.id === raceId);
    if (r) {
      document.getElementById('raceName').value = r.name || '';
      document.getElementById('raceDate').value = r.date || '';
      document.getElementById('raceDistance').value = r.distance || '';
      document.getElementById('raceDeniv').value = r.deniv || '';
      document.getElementById('raceRankGeneral').value = r.rankGeneral || '';
      document.getElementById('raceRankCat').value = r.rankCat || '';
      document.getElementById('raceParticipants').value = r.participants || '';
      document.getElementById('raceNote').value = r.note || '0';
      document.getElementById('raceComment').value = r.comment || '';
      document.getElementById('raceWeather').value = r.weather || '';
      document.getElementById('raceAutresSport').value = r.autresSport || '';

      if (r.status === 'planned') {
        setRaceStatus('planned');
        if (r.goalTime) { const [h,m,s] = secToHMS(r.goalTime); document.getElementById('goalH').value = h; document.getElementById('goalM').value = m; document.getElementById('goalS').value = s; }
      } else {
        setRaceStatus('done');
        if (r.timeTotal) { const [h,m,s] = secToHMS(r.timeTotal); document.getElementById('timeH').value = h; document.getElementById('timeM').value = m; document.getElementById('timeS').value = s; }
        if (cfg.isSwim && r.swimPace) { const [pm,ps] = r.swimPace.split(':'); document.getElementById('swimM').value = pm||''; document.getElementById('swimS').value = ps||''; }
        setStars(r.note || 0);
        if (r.weather) document.querySelectorAll('.weather-btn').forEach(b => { if (b.dataset.val === r.weather) b.classList.add('active'); });
      }
    }
  } else {
    document.getElementById('raceDate').value = todayStr();
  }
  openModal('raceModal');
}

function setRaceStatus(val) {
  document.getElementById('raceStatus').value = val;
  document.querySelectorAll('#raceStatusToggle .status-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.val === val);
  });
  document.getElementById('raceResultFields').style.display = val === 'done' ? '' : 'none';
  document.getElementById('raceGoalFields').style.display = val === 'planned' ? '' : 'none';
}

document.querySelectorAll('#raceStatusToggle .status-btn').forEach(btn => {
  btn.addEventListener('click', function() { setRaceStatus(this.dataset.val); });
});

document.getElementById('raceForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const sport = document.getElementById('raceSport').value;
  const status = document.getElementById('raceStatus').value;
  const id = document.getElementById('raceId').value || uid();

  const h = parseInt(document.getElementById('timeH').value) || 0;
  const m = parseInt(document.getElementById('timeM').value) || 0;
  const s = parseInt(document.getElementById('timeS').value) || 0;
  const timeTotal = h*3600 + m*60 + s;

  const gh = parseInt(document.getElementById('goalH').value) || 0;
  const gm = parseInt(document.getElementById('goalM').value) || 0;
  const gs = parseInt(document.getElementById('goalS').value) || 0;
  const goalTime = gh*3600 + gm*60 + gs;

  const swimM = parseInt(document.getElementById('swimM').value) || 0;
  const swimS = parseInt(document.getElementById('swimS').value) || 0;
  const swimPace = sport === 'natation' ? `${swimM}:${String(swimS).padStart(2,'0')}` : null;

  const race = {
    id, sport, status,
    name: document.getElementById('raceName').value.trim(),
    date: document.getElementById('raceDate').value,
    distance: parseFloat(document.getElementById('raceDistance').value) || 0,
    deniv: parseInt(document.getElementById('raceDeniv').value) || 0,
    autresSport: document.getElementById('raceAutresSport').value.trim(),
    comment: document.getElementById('raceComment').value.trim(),
  };

  if (status === 'done') {
    Object.assign(race, {
      timeTotal, swimPace,
      rankGeneral: parseInt(document.getElementById('raceRankGeneral').value) || 0,
      rankCat: parseInt(document.getElementById('raceRankCat').value) || 0,
      participants: parseInt(document.getElementById('raceParticipants').value) || 0,
      note: parseInt(document.getElementById('raceNote').value) || 0,
      weather: document.getElementById('raceWeather').value,
    });
  } else {
    race.goalTime = goalTime || 0;
  }

  const idx = db.races.findIndex(x => x.id === id);
  if (idx >= 0) db.races[idx] = race; else db.races.push(race);
  saveDB();
  closeModal('raceModal');
  if (SPORT_CONFIG[sport]) renderSportPage(sport);
  if (MULTI_CONFIG[sport]) renderMultiPage(sport);
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'planning') renderPlanningPage();
  toast(editingRaceId ? 'Course modifiée' : 'Course enregistrée');
});

// ══════════════════════════════════════════════
// TRIATHLON / DUATHLON MULTI MODAL
// ══════════════════════════════════════════════

function renderMultiPage(sport) {
  const cfg = MULTI_CONFIG[sport];
  if (!cfg) return;
  renderPhysioBar(sport);
  const el = document.getElementById('races-' + sport);
  if (!el) return;

  const races = db.races.filter(r => r.sport === sport).sort((a,b) => b.date.localeCompare(a.date));
  if (!races.length) { el.innerHTML = `<div class="empty-state"><span class="empty-icon">🏁</span>Aucune course enregistrée</div>`; return; }

  const segKeys = cfg.segments.filter(s => !s.isTransition);

  el.innerHTML = `<table>
    <thead><tr>
      <th>Statut</th><th>Date</th><th>Course</th>
      ${sport === 'triathlon' ? '<th>Format</th>' : ''}
      ${segKeys.map(s => `<th>${s.icon} ${s.label}</th>`).join('')}
      <th>Total</th><th>Gén.</th><th>Cat.</th><th>Note</th><th></th>
    </tr></thead>
    <tbody>
      ${races.map(r => {
        const planned = isPlanned(r);
        const segs = r.segments || {};
        const fmt = r.format ? {S:'Sprint',O:'Olympique',M:'70.3',L:'Ironman',X:''}[r.format]||'' : '';
        return `<tr class="${planned ? 'row-planned' : ''}" onclick="showRaceDetail('${r.id}')">
          <td>${planned ? `<span class="planned-badge">📅</span>` : `<span style="font-size:11px;color:var(--success)">✓</span>`}</td>
          <td style="color:var(--text2);font-size:12px">${formatDate(r.date)}</td>
          <td style="font-weight:500">${escHtml(r.name)}</td>
          ${sport === 'triathlon' ? `<td><span style="font-size:11px;color:var(--tri)">${fmt}</span></td>` : ''}
          ${segKeys.map(s => `<td class="time-cell" style="font-size:11px">${segs[s.key] ? formatSegment(segs[s.key], s) : '—'}</td>`).join('')}
          <td class="time-cell">${planned && r.goalTime ? '🎯 '+formatTime(r.goalTime) : formatTime(r.timeTotal)}</td>
          <td class="rank-cell">${r.rankGeneral ? r.rankGeneral+(r.participants?'/'+r.participants:'') : '—'}</td>
          <td class="rank-cell">${r.rankCat||'—'}</td>
          <td class="stars-cell">${renderStars(r.note)}</td>
          <td onclick="event.stopPropagation()">
            ${planned ? `<button class="btn-planned" onclick="markAsDone('${r.id}')" title="Saisir résultat">✎ Résultat</button>` : ''}
            <button class="btn-icon" onclick="openMultiModal('${sport}','${r.id}')" title="Modifier">✎</button>
            <button class="btn-icon del" onclick="confirmDelete('race','${r.id}')" title="Supprimer">✕</button>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

function formatSegment(seg, cfg) {
  if (!seg) return '—';
  if (cfg.isSwim) {
    return seg.dist ? `${seg.dist}km` : '';
  }
  let out = '';
  if (seg.dist) out += seg.dist + 'km';
  if (seg.time) out += (out ? ' · ' : '') + formatTime(seg.time);
  return out || '—';
}

let editingMultiId = null;

function openMultiModal(sport, raceId = null) {
  editingMultiId = raceId;
  const cfg = MULTI_CONFIG[sport];
  if (!cfg) return;

  document.getElementById('multiSport').value = sport;
  document.getElementById('multiModalTitle').textContent = raceId ? `Modifier — ${cfg.label}` : `Nouvelle course — ${cfg.label}`;
  document.getElementById('multiForm').reset();
  document.getElementById('multiId').value = raceId || '';
  document.getElementById('multiNote').value = '0';
  document.querySelectorAll('.star2').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.weather-btn2').forEach(b => b.classList.remove('active'));
  document.getElementById('multiWeather').value = '';

  // Show format row for triathlon only
  document.getElementById('triathlonFormatRow').style.display = sport === 'triathlon' ? '' : 'none';

  // Build segments form
  buildSegmentFields(sport, null);

  setMultiStatus('done');

  if (raceId) {
    const r = db.races.find(x => x.id === raceId);
    if (r) {
      document.getElementById('multiName').value = r.name || '';
      document.getElementById('multiDate').value = r.date || '';
      document.getElementById('multiComment').value = r.comment || '';

      if (r.format) {
        document.getElementById('multiFormat').value = r.format;
        document.querySelectorAll('#triathlonFormat .format-btn').forEach(b => b.classList.toggle('active', b.dataset.val === r.format));
      }

      buildSegmentFields(sport, r.segments || {});

      if (r.status === 'planned') {
        setMultiStatus('planned');
        if (r.goalTime) { const [h,m,s] = secToHMS(r.goalTime); document.getElementById('multiGoalH').value = h; document.getElementById('multiGoalM').value = m; document.getElementById('multiGoalS').value = s; }
      } else {
        setMultiStatus('done');
        if (r.timeTotal) { const [h,m,s] = secToHMS(r.timeTotal); document.getElementById('multiTotalH').value = h; document.getElementById('multiTotalM').value = m; document.getElementById('multiTotalS').value = s; }
        document.getElementById('multiRankGeneral').value = r.rankGeneral || '';
        document.getElementById('multiRankCat').value = r.rankCat || '';
        document.getElementById('multiParticipants').value = r.participants || '';
        setStars2(r.note || 0);
        if (r.weather) document.querySelectorAll('.weather-btn2').forEach(b => { if (b.dataset.val === r.weather) b.classList.add('active'); });
      }
    }
  } else {
    document.getElementById('multiDate').value = todayStr();
  }

  openModal('multiModal');
}

function buildSegmentFields(sport, existing) {
  const cfg = MULTI_CONFIG[sport];
  if (!cfg) return;
  const el = document.getElementById('multiSegments');
  const segs = existing || {};

  el.innerHTML = `<div class="segments-block">
    <h4>Segments</h4>
    ${cfg.segments.map(seg => {
      const val = segs[seg.key] || {};
      if (seg.isTransition) {
        return `<div class="segment-row" style="grid-template-columns:1fr 1fr">
          <div>
            <div class="segment-label">${seg.icon} ${seg.label}</div>
            <div class="time-input">
              <input type="number" id="seg_${seg.key}_h" min="0" placeholder="0" class="time-part" value="${val.h||''}">
              <span>:</span>
              <input type="number" id="seg_${seg.key}_m" min="0" max="59" placeholder="00" class="time-part" value="${val.m||''}">
              <span>:</span>
              <input type="number" id="seg_${seg.key}_s" min="0" max="59" placeholder="00" class="time-part" value="${val.s||''}">
            </div>
          </div>
          <div></div>
        </div>`;
      }
      if (seg.isSwim) {
        return `<div class="segment-row" style="grid-template-columns:1fr 1fr 1fr">
          <div>
            <div class="segment-label">${seg.icon} ${seg.label}</div>
            <input type="number" id="seg_${seg.key}_dist" step="0.1" placeholder="1.9 km" style="width:100%" value="${val.dist||''}">
          </div>
          <div>
            <div class="segment-label">Temps</div>
            <div class="time-input">
              <input type="number" id="seg_${seg.key}_h" min="0" placeholder="0" class="time-part" value="${val.h||''}">
              <span>:</span>
              <input type="number" id="seg_${seg.key}_m" min="0" max="59" placeholder="00" class="time-part" value="${val.m||''}">
              <span>:</span>
              <input type="number" id="seg_${seg.key}_s" min="0" max="59" placeholder="00" class="time-part" value="${val.s||''}">
            </div>
          </div>
          <div>
            <div class="segment-label">Allure /100m</div>
            <div class="time-input">
              <input type="number" id="seg_${seg.key}_pm" min="0" max="9" placeholder="1" class="time-part" value="${val.pm||''}">
              <span>:</span>
              <input type="number" id="seg_${seg.key}_ps" min="0" max="59" placeholder="30" class="time-part" value="${val.ps||''}">
            </div>
          </div>
        </div>`;
      }
      return `<div class="segment-row">
        <div>
          <div class="segment-label">${seg.icon} ${seg.label}</div>
          <input type="number" id="seg_${seg.key}_dist" step="0.1" placeholder="km" style="width:100%" value="${val.dist||''}">
        </div>
        <div>
          <div class="segment-label">Temps</div>
          <div class="time-input">
            <input type="number" id="seg_${seg.key}_h" min="0" placeholder="0" class="time-part" value="${val.h||''}">
            <span>:</span>
            <input type="number" id="seg_${seg.key}_m" min="0" max="59" placeholder="00" class="time-part" value="${val.m||''}">
            <span>:</span>
            <input type="number" id="seg_${seg.key}_s" min="0" max="59" placeholder="00" class="time-part" value="${val.s||''}">
          </div>
        </div>
        <div>
          <div class="segment-label">Allure /km</div>
          <div style="font-family:var(--font-mono);font-size:13px;color:var(--accent);padding-top:8px" id="seg_${seg.key}_pace">—</div>
        </div>
      </div>`;
    }).join('')}
  </div>`;

  // Live pace calc
  cfg.segments.forEach(seg => {
    if (seg.isTransition || seg.isSwim) return;
    const paceEl = document.getElementById(`seg_${seg.key}_pace`);
    if (!paceEl) return;
    const update = () => {
      const d = parseFloat(document.getElementById(`seg_${seg.key}_dist`)?.value);
      const h = parseInt(document.getElementById(`seg_${seg.key}_h`)?.value) || 0;
      const m = parseInt(document.getElementById(`seg_${seg.key}_m`)?.value) || 0;
      const s = parseInt(document.getElementById(`seg_${seg.key}_s`)?.value) || 0;
      const sec = h*3600 + m*60 + s;
      paceEl.textContent = (d && sec) ? formatPacePerKm(sec, d) : '—';
    };
    ['dist','h','m','s'].forEach(f => {
      const inp = document.getElementById(`seg_${seg.key}_${f}`);
      if (inp) inp.addEventListener('input', update);
    });
  });
}

function setMultiStatus(val) {
  document.getElementById('multiStatus').value = val;
  document.querySelectorAll('#multiStatusToggle .status-btn').forEach(b => b.classList.toggle('active', b.dataset.val === val));
  document.getElementById('multiResultFields').style.display = val === 'done' ? '' : 'none';
  document.getElementById('multiGoalFields').style.display = val === 'planned' ? '' : 'none';
}

document.querySelectorAll('#multiStatusToggle .status-btn').forEach(btn => {
  btn.addEventListener('click', function() { setMultiStatus(this.dataset.val); });
});

// Format buttons
document.querySelectorAll('#triathlonFormat .format-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('#triathlonFormat .format-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    document.getElementById('multiFormat').value = this.dataset.val;
    // Pre-fill distances
    const fmt = MULTI_CONFIG.triathlon.formats[this.dataset.val];
    if (fmt) {
      if (document.getElementById('seg_swim_dist')) document.getElementById('seg_swim_dist').value = fmt.swim;
      if (document.getElementById('seg_bike_dist')) document.getElementById('seg_bike_dist').value = fmt.bike;
      if (document.getElementById('seg_run_dist')) document.getElementById('seg_run_dist').value = fmt.run;
    }
  });
});

document.getElementById('multiForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const sport = document.getElementById('multiSport').value;
  const status = document.getElementById('multiStatus').value;
  const id = document.getElementById('multiId').value || uid();
  const cfg = MULTI_CONFIG[sport];

  // Collect segments
  const segments = {};
  cfg.segments.forEach(seg => {
    const obj = {};
    const distEl = document.getElementById(`seg_${seg.key}_dist`);
    const hEl = document.getElementById(`seg_${seg.key}_h`);
    const mEl = document.getElementById(`seg_${seg.key}_m`);
    const sEl = document.getElementById(`seg_${seg.key}_s`);
    const pmEl = document.getElementById(`seg_${seg.key}_pm`);
    const psEl = document.getElementById(`seg_${seg.key}_ps`);

    if (distEl && distEl.value) obj.dist = parseFloat(distEl.value);
    if (hEl || mEl || sEl) {
      const h = parseInt(hEl?.value)||0, m = parseInt(mEl?.value)||0, s = parseInt(sEl?.value)||0;
      if (h||m||s) { obj.h=h; obj.m=m; obj.s=s; obj.time = h*3600+m*60+s; }
    }
    if (pmEl && psEl && (pmEl.value||psEl.value)) { obj.pm = parseInt(pmEl.value)||0; obj.ps = parseInt(psEl.value)||0; }
    segments[seg.key] = obj;
  });

  const th = parseInt(document.getElementById('multiTotalH').value)||0;
  const tm = parseInt(document.getElementById('multiTotalM').value)||0;
  const ts = parseInt(document.getElementById('multiTotalS').value)||0;
  const timeTotal = th*3600+tm*60+ts;

  const gh = parseInt(document.getElementById('multiGoalH').value)||0;
  const gm = parseInt(document.getElementById('multiGoalM').value)||0;
  const gs = parseInt(document.getElementById('multiGoalS').value)||0;
  const goalTime = gh*3600+gm*60+gs;

  const race = {
    id, sport, status,
    name: document.getElementById('multiName').value.trim(),
    date: document.getElementById('multiDate').value,
    format: document.getElementById('multiFormat').value,
    segments,
    comment: document.getElementById('multiComment').value.trim(),
  };

  if (status === 'done') {
    Object.assign(race, {
      timeTotal,
      rankGeneral: parseInt(document.getElementById('multiRankGeneral').value)||0,
      rankCat: parseInt(document.getElementById('multiRankCat').value)||0,
      participants: parseInt(document.getElementById('multiParticipants').value)||0,
      note: parseInt(document.getElementById('multiNote').value)||0,
      weather: document.getElementById('multiWeather').value,
    });
    // Calc total distance from segments
    let totalDist = 0;
    cfg.segments.forEach(seg => { if (!seg.isTransition) totalDist += segments[seg.key]?.dist || 0; });
    race.distance = totalDist;
  } else {
    race.goalTime = goalTime || 0;
  }

  const idx = db.races.findIndex(x => x.id === id);
  if (idx >= 0) db.races[idx] = race; else db.races.push(race);
  saveDB();
  closeModal('multiModal');
  renderMultiPage(sport);
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'planning') renderPlanningPage();
  toast(editingMultiId ? 'Course modifiée' : 'Course enregistrée');
});

// ══════════════════════════════════════════════
// MARK AS DONE
// ══════════════════════════════════════════════

function markAsDone(id) {
  const r = db.races.find(x => x.id === id);
  if (!r) return;
  const isMulti = !!MULTI_CONFIG[r.sport];
  if (isMulti) openMultiModal(r.sport, id);
  else openRaceModal(r.sport, id);
  // Switch to done status after modal opens
  setTimeout(() => {
    if (isMulti) setMultiStatus('done');
    else setRaceStatus('done');
  }, 50);
}

// ══════════════════════════════════════════════
// RACE DETAIL
// ══════════════════════════════════════════════

function showRaceDetail(id) {
  const r = db.races.find(x => x.id === id);
  if (!r) return;
  const allSports = { ...SPORT_CONFIG, ...MULTI_CONFIG };
  const cfg = allSports[r.sport] || {};
  const planned = isPlanned(r);

  let segHtml = '';
  if (MULTI_CONFIG[r.sport] && r.segments) {
    const mCfg = MULTI_CONFIG[r.sport];
    segHtml = `<div class="sub-section-title">Segments</div>
      <div class="race-detail-grid">
        ${mCfg.segments.map(seg => {
          const s = r.segments[seg.key] || {};
          const timeStr = s.time ? formatTime(s.time) : (s.h||s.m||s.s ? formatTime((s.h||0)*3600+(s.m||0)*60+(s.s||0)) : '—');
          return `<div class="race-detail-stat">
            <div class="label">${seg.icon} ${seg.label}</div>
            <div class="value" style="font-size:14px">${s.dist ? s.dist+'km · ' : ''}${timeStr}</div>
          </div>`;
        }).join('')}
      </div>`;
  }

  document.getElementById('raceDetailTitle').textContent = r.name;
  document.getElementById('raceDetailBody').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">
      <span class="badge" style="background:${cfg.color}22;color:${cfg.color}">${cfg.label}</span>
      <span style="font-family:var(--font-mono);font-size:12px;color:var(--text3)">${formatDate(r.date)}</span>
      ${planned ? `<span class="planned-badge">📅 Planifiée — dans ${daysUntil(r.date)} jours</span>` : ''}
      ${r.weather ? `<span>${r.weather}</span>` : ''}
    </div>
    <div class="race-detail-grid">
      ${planned && r.goalTime ? `<div class="race-detail-stat"><div class="label">Objectif</div><div class="value" style="color:var(--planned)">🎯 ${formatTime(r.goalTime)}</div></div>` : ''}
      ${!planned && r.timeTotal ? `<div class="race-detail-stat"><div class="label">Temps</div><div class="value" style="color:var(--accent)">${formatTime(r.timeTotal)}</div></div>` : ''}
      ${r.distance ? `<div class="race-detail-stat"><div class="label">Distance</div><div class="value">${r.distance} km</div></div>` : ''}
      ${r.deniv ? `<div class="race-detail-stat"><div class="label">Dénivelé +</div><div class="value">${r.deniv} m</div></div>` : ''}
      ${!planned && r.timeTotal && r.distance && !MULTI_CONFIG[r.sport] ? `<div class="race-detail-stat"><div class="label">Allure</div><div class="value">${SPORT_CONFIG[r.sport]?.isSwim ? formatPacePer100m(r.timeTotal, r.distance) : formatPacePerKm(r.timeTotal, r.distance)}</div></div>` : ''}
      ${r.rankGeneral ? `<div class="race-detail-stat"><div class="label">Clas. général</div><div class="value">${r.rankGeneral}${r.participants?'/'+r.participants:''}</div></div>` : ''}
      ${r.rankCat ? `<div class="race-detail-stat"><div class="label">Clas. catégorie</div><div class="value">${r.rankCat}</div></div>` : ''}
      ${r.note ? `<div class="race-detail-stat"><div class="label">Note</div><div class="value">${renderStars(r.note)} (${r.note}/5)</div></div>` : ''}
    </div>
    ${segHtml}
    ${r.comment ? `<div class="sub-section-title">Récap</div><div class="race-detail-comment">${escHtml(r.comment)}</div>` : ''}
    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
      ${planned ? `<button class="btn-planned" onclick="closeModal('raceDetail');markAsDone('${r.id}')">✎ Saisir résultat</button>` : ''}
      <button class="btn-secondary" onclick="closeModal('raceDetail');${MULTI_CONFIG[r.sport] ? `openMultiModal('${r.sport}','${r.id}')` : `openRaceModal('${r.sport}','${r.id}')`}">✎ Modifier</button>
      <button class="btn-danger" onclick="closeModal('raceDetail');confirmDelete('race','${r.id}')">Supprimer</button>
    </div>`;
  openModal('raceDetail');
}

// ══════════════════════════════════════════════
// PLANNING PAGE
// ══════════════════════════════════════════════

function renderPlanningPage() {
  document.getElementById('planningYear').textContent = new Date().getFullYear();
  const el = document.getElementById('planning-content');
  const today = todayStr();
  const planned = db.races.filter(r => isPlanned(r)).sort((a,b) => a.date.localeCompare(b.date));

  if (!planned.length) {
    el.innerHTML = `<div class="empty-state"><span class="empty-icon">📅</span>Aucune course planifiée<br><small>Utilise le bouton "Planifier" ou ajoute une course avec le statut "Planifiée" depuis chaque page sport.</small></div>`;
    return;
  }

  // Group by month
  const byMonth = {};
  planned.forEach(r => {
    const [y, m] = r.date.split('-');
    const key = `${y}-${m}`;
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(r);
  });

  const allSports = { ...SPORT_CONFIG, ...MULTI_CONFIG };

  el.innerHTML = Object.entries(byMonth).map(([key, races]) => {
    const [y, m] = key.split('-');
    const isPast = key < today.slice(0, 7);
    return `<div class="planning-month">
      <div class="planning-month-title" style="${isPast ? 'color:var(--text3)' : ''}">${MONTHS_FR[parseInt(m)-1]} ${y}</div>
      ${races.map(r => {
        const cfg = allSports[r.sport] || {};
        const days = daysUntil(r.date);
        const isPastRace = r.date < today;
        return `<div class="planning-card" onclick="showRaceDetail('${r.id}')">
          <div class="planning-card-left">
            <div style="display:flex;align-items:center;gap:8px">
              <span class="sport-dot" style="background:${cfg.color}"></span>
              <span class="planning-card-name">${escHtml(r.name)}</span>
            </div>
            <div class="planning-card-meta">
              <span>${cfg.label}</span>
              <span>·</span>
              <span>${formatDate(r.date)}</span>
              ${r.distance ? `<span>· ${r.distance} km</span>` : ''}
              ${r.deniv ? `<span>· D+ ${r.deniv}m</span>` : ''}
              ${r.goalTime ? `<span>· 🎯 ${formatTime(r.goalTime)}</span>` : ''}
            </div>
          </div>
          <div class="planning-card-right">
            ${isPastRace
              ? `<button class="btn-planned" onclick="event.stopPropagation();markAsDone('${r.id}')">✎ Saisir résultat</button>`
              : `<span class="days-away">J-${days}</span>`
            }
            <div style="display:flex;gap:4px">
              <button class="btn-icon" onclick="event.stopPropagation();${MULTI_CONFIG[r.sport] ? `openMultiModal('${r.sport}','${r.id}')` : `openRaceModal('${r.sport}','${r.id}')`}" title="Modifier">✎</button>
              <button class="btn-icon del" onclick="event.stopPropagation();confirmDelete('race','${r.id}')" title="Supprimer">✕</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
}

function openPlanModal() { openModal('planModal'); }

function routePlanModal() {
  const sport = document.getElementById('planSport').value;
  closeModal('planModal');
  if (MULTI_CONFIG[sport]) {
    openMultiModal(sport);
    setTimeout(() => setMultiStatus('planned'), 50);
  } else {
    openRaceModal(sport);
    setTimeout(() => setRaceStatus('planned'), 50);
  }
}

// ══════════════════════════════════════════════
// PHYSIO
// ══════════════════════════════════════════════

function renderPhysioPage() {
  const el = document.getElementById('physio-grid');
  const sorted = [...db.physio].sort((a,b) => b.date.localeCompare(a.date));
  if (!sorted.length) { el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">📊</span>Aucune mesure</div>`; return; }
  el.innerHTML = sorted.map(p => {
    const metrics = buildPhysioMetrics(p);
    return `<div class="physio-card">
      <div class="physio-card-header">
        <span class="physio-card-sport ${p.sport}">${p.sport === 'course' ? 'Course' : p.sport === 'natation' ? 'Natation' : 'Vélo'}</span>
        <span class="physio-card-date">${formatDate(p.date)}</span>
      </div>
      <div class="physio-metrics">
        ${metrics.map(m => `<div class="physio-metric"><span class="m-label">${m.label}</span><span class="m-value" style="color:${m.color||'var(--text)'}">${m.value}</span></div>`).join('')}
      </div>
      ${p.notes ? `<div style="margin-top:10px;font-size:11px;color:var(--text3);font-style:italic">${escHtml(p.notes)}</div>` : ''}
      <div style="margin-top:10px;display:flex;gap:6px">
        <button class="btn-icon" onclick="openPhysioModal('${p.id}')" title="Modifier">✎</button>
        <button class="btn-icon del" onclick="confirmDelete('physio','${p.id}')" title="Supprimer">✕</button>
      </div>
    </div>`;
  }).join('');
}

function buildPhysioMetrics(p) {
  const m = [];
  if (p.sport === 'course') {
    if (p.vma) m.push({ label: 'VMA', value: p.vma + ' km/h', color: 'var(--run)' });
    if (p.seuilAllure) m.push({ label: 'Allure seuil', value: p.seuilAllure + ' /km' });
    if (p.fcmax) m.push({ label: 'FC max', value: p.fcmax + ' bpm' });
    if (p.poids) m.push({ label: 'Poids', value: p.poids + ' kg' });
  }
  if (p.sport === 'natation') {
    if (p.vc) m.push({ label: 'Vitesse critique', value: p.vc + ' /100m', color: 'var(--swim)' });
    if (p.vsmax) m.push({ label: 'Sprint max', value: p.vsmax + ' /100m' });
  }
  if (p.sport === 'velo') {
    if (p.ftp) m.push({ label: 'FTP', value: p.ftp + ' W', color: 'var(--bike)' });
    if (p.pma) m.push({ label: 'PMA', value: p.pma + ' W' });
    if (p.wkg) m.push({ label: 'W/kg (FTP)', value: p.wkg });
    if (p.poids) m.push({ label: 'Poids', value: p.poids + ' kg' });
  }
  return m;
}

function openPhysioModal(id = null) {
  document.getElementById('physioForm').reset();
  if (id) {
    const p = db.physio.find(x => x.id === id);
    if (p) {
      document.getElementById('physioDate').value = p.date;
      document.getElementById('physioSport').value = p.sport;
      updatePhysioFields(p.sport);
      if (p.sport === 'course') {
        if (p.vma) document.getElementById('physioVMA').value = p.vma;
        if (p.fcmax) document.getElementById('physioFCmax').value = p.fcmax;
        if (p.seuilAllure) { const [m,s] = p.seuilAllure.split(':'); document.getElementById('physioSeuilM').value=m; document.getElementById('physioSeuilS').value=s; }
        if (p.poids) document.getElementById('physioPoids').value = p.poids;
      }
      if (p.sport === 'natation') {
        if (p.vc) { const [m,s] = p.vc.split(':'); document.getElementById('physioVCm').value=m; document.getElementById('physioVCs').value=s; }
        if (p.vsmax) { const [m,s] = p.vsmax.split(':'); document.getElementById('physioVSmaxM').value=m; document.getElementById('physioVSmaxS').value=s; }
      }
      if (p.sport === 'velo') {
        if (p.ftp) document.getElementById('physioFTP').value = p.ftp;
        if (p.pma) document.getElementById('physioPMA').value = p.pma;
        if (p.poids) document.getElementById('physioPoidsVelo').value = p.poids;
        if (p.wkg) document.getElementById('physioWkg').value = p.wkg;
      }
      if (p.notes) document.getElementById('physioNotes').value = p.notes;
      document.getElementById('physioForm').dataset.id = id;
    }
  } else {
    document.getElementById('physioDate').value = todayStr();
    document.getElementById('physioForm').dataset.id = '';
    updatePhysioFields('course');
  }
  openModal('physioModal');
}

document.getElementById('physioSport').addEventListener('change', function() { updatePhysioFields(this.value); });

function updatePhysioFields(sport) {
  document.querySelectorAll('.physio-sport-fields').forEach(f => f.style.display = 'none');
  const t = document.getElementById('physio-' + sport + '-fields');
  if (t) t.style.display = '';
}

document.getElementById('physioFTP').addEventListener('input', calcWkg);
document.getElementById('physioPoidsVelo').addEventListener('input', calcWkg);
function calcWkg() {
  const ftp = parseFloat(document.getElementById('physioFTP').value);
  const poids = parseFloat(document.getElementById('physioPoidsVelo').value);
  if (ftp && poids) document.getElementById('physioWkg').value = (ftp/poids).toFixed(2);
}

document.getElementById('physioForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const sport = document.getElementById('physioSport').value;
  const id = this.dataset.id || uid();
  const p = { id, sport, date: document.getElementById('physioDate').value, notes: document.getElementById('physioNotes').value.trim() };
  if (sport === 'course') {
    p.vma = parseFloat(document.getElementById('physioVMA').value) || null;
    p.fcmax = parseInt(document.getElementById('physioFCmax').value) || null;
    p.poids = parseFloat(document.getElementById('physioPoids').value) || null;
    const sm = document.getElementById('physioSeuilM').value, ss = document.getElementById('physioSeuilS').value;
    if (sm||ss) p.seuilAllure = `${sm||0}:${String(ss||0).padStart(2,'0')}`;
  }
  if (sport === 'natation') {
    const vcm = document.getElementById('physioVCm').value, vcs = document.getElementById('physioVCs').value;
    if (vcm||vcs) p.vc = `${vcm||0}:${String(vcs||0).padStart(2,'0')}`;
    const vm = document.getElementById('physioVSmaxM').value, vs = document.getElementById('physioVSmaxS').value;
    if (vm||vs) p.vsmax = `${vm||0}:${String(vs||0).padStart(2,'0')}`;
  }
  if (sport === 'velo') {
    p.ftp = parseInt(document.getElementById('physioFTP').value) || null;
    p.pma = parseInt(document.getElementById('physioPMA').value) || null;
    p.poids = parseFloat(document.getElementById('physioPoidsVelo').value) || null;
    p.wkg = document.getElementById('physioWkg').value || null;
  }
  const idx = db.physio.findIndex(x => x.id === id);
  if (idx >= 0) db.physio[idx] = p; else db.physio.push(p);
  saveDB();
  closeModal('physioModal');
  renderPhysioPage();
  toast('Mesure enregistrée');
});

// ══════════════════════════════════════════════
// MATÉRIEL
// ══════════════════════════════════════════════

function renderMaterielPage() {
  const el = document.getElementById('materiel-grid');
  if (!db.materiel.length) { el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">🔧</span>Aucun équipement</div>`; return; }
  el.innerHTML = db.materiel.map(m => {
    const pct = m.alerte ? Math.min(m.km/m.alerte,1) : 0;
    const barClass = pct>=1?'danger':pct>=0.85?'warn':'';
    const cardClass = pct>=1?'danger':pct>=0.85?'alert':'';
    const composants = db.composants.filter(c => c.materielId===m.id).sort((a,b) => b.date.localeCompare(a.date));
    return `<div class="materiel-card ${cardClass}">
      <div class="materiel-card-header">
        <div>
          <div class="materiel-card-title">${escHtml(m.nom)}</div>
          <span class="materiel-cat-badge">${CAT_LABELS[m.cat]||m.cat}</span>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn-icon" onclick="openMaterielModal('${m.id}')" title="Modifier">✎</button>
          <button class="btn-icon del" onclick="confirmDelete('materiel','${m.id}')" title="Supprimer">✕</button>
        </div>
      </div>
      ${m.alerte ? `<div class="km-bar-wrap">
        <div class="km-bar-label"><span>Kilométrage</span><strong>${m.km} / ${m.alerte} km</strong></div>
        <div class="km-bar"><div class="km-bar-fill ${barClass}" style="width:${(pct*100).toFixed(1)}%"></div></div>
      </div>` : `<div style="font-family:var(--font-mono);font-size:13px;margin:8px 0;color:var(--text2)">${m.km||0} km</div>`}
      ${m.dateAchat ? `<div style="font-size:11px;color:var(--text3);margin-bottom:8px">Depuis le ${formatDate(m.dateAchat)}</div>` : ''}
      ${m.notes ? `<div style="font-size:12px;color:var(--text2);margin-bottom:8px;font-style:italic">${escHtml(m.notes)}</div>` : ''}
      <div class="materiel-actions">
        <button class="btn-secondary small" onclick="openUpdateKm('${m.id}')">+ Km</button>
        <button class="btn-secondary small" onclick="openComposantModal('${m.id}')">+ Entretien</button>
      </div>
      ${composants.length ? `<div class="composants-list">
        ${composants.slice(0,3).map(c => `<div class="composant-item">
          <div><span>${escHtml(c.type)}</span><span style="font-size:10px;color:var(--text3);margin-left:6px">${formatDate(c.date)}</span></div>
          <span class="composant-km">${c.km?c.km+' km':''}</span>
        </div>`).join('')}
        ${composants.length>3 ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">+${composants.length-3} autres</div>` : ''}
      </div>` : ''}
    </div>`;
  }).join('');
}

function openMaterielModal(id = null) {
  document.getElementById('materielForm').reset();
  document.getElementById('materielId').value = id || '';
  document.getElementById('materielModalTitle').textContent = id ? 'Modifier équipement' : 'Nouvel équipement';
  document.getElementById('composantsSection').style.display = id ? '' : 'none';
  if (id) {
    const m = db.materiel.find(x => x.id===id);
    if (m) {
      document.getElementById('materielNom').value = m.nom||'';
      document.getElementById('materielCat').value = m.cat||'velo';
      document.getElementById('materielDate').value = m.dateAchat||'';
      document.getElementById('materielKm').value = m.km||0;
      document.getElementById('materielAlerte').value = m.alerte||0;
      document.getElementById('materielNotes').value = m.notes||'';
      renderComposantsList(id);
    }
  } else { document.getElementById('materielDate').value = todayStr(); }
  openModal('materielModal');
}

function openComposantFromMateriel() {
  const id = document.getElementById('materielId').value;
  if (id) openComposantModal(id);
}

function renderComposantsList(materielId) {
  const el = document.getElementById('composantsList');
  const list = db.composants.filter(c => c.materielId===materielId).sort((a,b) => b.date.localeCompare(a.date));
  if (!list.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text3)">Aucun entretien</div>'; return; }
  el.innerHTML = list.map(c => `<div class="composant-item">
    <div><span>${escHtml(c.type)}</span><span style="font-size:10px;color:var(--text3);margin-left:8px">${formatDate(c.date)}</span></div>
    <div style="display:flex;align-items:center;gap:6px">
      <span class="composant-km">${c.km||''} km</span>
      <button class="btn-icon del" onclick="deleteComposant('${c.id}','${materielId}')">✕</button>
    </div>
  </div>`).join('');
}

document.getElementById('materielForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const id = document.getElementById('materielId').value || uid();
  const m = { id, nom: document.getElementById('materielNom').value.trim(), cat: document.getElementById('materielCat').value, dateAchat: document.getElementById('materielDate').value, km: parseInt(document.getElementById('materielKm').value)||0, alerte: parseInt(document.getElementById('materielAlerte').value)||0, notes: document.getElementById('materielNotes').value.trim() };
  const idx = db.materiel.findIndex(x => x.id===id);
  if (idx>=0) db.materiel[idx]=m; else db.materiel.push(m);
  saveDB(); closeModal('materielModal'); renderMaterielPage(); toast('Équipement enregistré');
});

function openUpdateKm(id) {
  const m = db.materiel.find(x => x.id===id);
  if (!m) return;
  const km = prompt(`Km actuels pour "${m.nom}" : ${m.km}\n\nNouveau total (km) :`, m.km);
  if (km!==null && !isNaN(parseInt(km))) {
    m.km = parseInt(km); saveDB(); renderMaterielPage();
    if (currentPage==='dashboard') renderDashboard();
    toast('Kilométrage mis à jour');
  }
}

let composantMaterielId = null;
function openComposantModal(materielId) {
  composantMaterielId = materielId;
  document.getElementById('composantForm').reset();
  document.getElementById('composantMaterielId').value = materielId;
  document.getElementById('composantDate').value = todayStr();
  const m = db.materiel.find(x => x.id===materielId);
  if (m) document.getElementById('composantKm').value = m.km||0;
  openModal('composantModal');
}

document.getElementById('composantForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const c = { id:uid(), materielId: document.getElementById('composantMaterielId').value, type: document.getElementById('composantType').value.trim(), date: document.getElementById('composantDate').value, km: parseInt(document.getElementById('composantKm').value)||0, nextKm: parseInt(document.getElementById('composantNextKm').value)||0, notes: document.getElementById('composantNotes').value.trim() };
  db.composants.push(c);
  saveDB(); closeModal('composantModal'); renderMaterielPage(); toast('Entretien enregistré');
});

function deleteComposant(id, materielId) {
  db.composants = db.composants.filter(c => c.id!==id);
  saveDB(); renderComposantsList(materielId);
}

// ══════════════════════════════════════════════
// CALENDAR
// ══════════════════════════════════════════════

function renderCalendar() {
  const wrap = document.getElementById('calendar-wrap');
  const allSports = { ...SPORT_CONFIG, ...MULTI_CONFIG };
  const racesByDate = {};
  db.races.forEach(r => {
    if (!racesByDate[r.date]) racesByDate[r.date] = [];
    racesByDate[r.date].push(r);
  });

  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth+1, 0);
  let startDow = firstDay.getDay(); startDow = startDow===0?6:startDow-1;

  const cells = [];
  for (let i=0; i<startDow; i++) cells.push({ date: new Date(calYear, calMonth, 1-(startDow-i)), other:true });
  for (let i=1; i<=lastDay.getDate(); i++) cells.push({ date: new Date(calYear, calMonth, i), other:false });
  while (cells.length%7!==0) cells.push({ date: new Date(calYear, calMonth+1, cells.length-lastDay.getDate()-startDow+1), other:true });

  const todayISO = todayStr();

  wrap.innerHTML = `<div class="calendar-header">
    <button class="cal-nav" onclick="calNav(-1)">‹</button>
    <span class="cal-month-label">${MONTHS_FR[calMonth]} ${calYear}</span>
    <button class="cal-nav" onclick="calNav(1)">›</button>
  </div>
  <div class="calendar-grid">
    <div class="cal-days-header">${['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => `<div class="cal-day-name">${d}</div>`).join('')}</div>
    <div class="cal-body">
      ${cells.map(cell => {
        const ds = cell.date.toISOString().split('T')[0];
        const dayRaces = racesByDate[ds] || [];
        return `<div class="cal-cell ${cell.other?'other-month':''} ${ds===todayISO?'today':''}">
          <div class="cal-date">${cell.date.getDate()}</div>
          ${dayRaces.map(r => {
            const cfg = allSports[r.sport]||{};
            const plan = isPlanned(r);
            return `<div class="cal-event ${plan?'planned':''}" style="background:${cfg.color}${plan?'11':'22'};color:${cfg.color};${plan?`border-color:${cfg.color};`:''}" onclick="showRaceDetail('${r.id}')" title="${escHtml(r.name)}">${escHtml(r.name)}</div>`;
          }).join('')}
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function calNav(dir) {
  calMonth += dir;
  if (calMonth<0) { calMonth=11; calYear--; }
  if (calMonth>11) { calMonth=0; calYear++; }
  renderCalendar();
}

// ══════════════════════════════════════════════
// STAR RATINGS
// ══════════════════════════════════════════════

document.querySelectorAll('.star').forEach(star => {
  star.addEventListener('click', function() {
    const val = parseInt(this.dataset.val);
    document.getElementById('raceNote').value = val;
    setStars(val);
  });
});

document.querySelectorAll('.star2').forEach(star => {
  star.addEventListener('click', function() {
    const val = parseInt(this.dataset.val);
    document.getElementById('multiNote').value = val;
    setStars2(val);
  });
});

function setStars(n) { document.querySelectorAll('.star').forEach(s => s.classList.toggle('active', parseInt(s.dataset.val)<=n)); }
function setStars2(n) { document.querySelectorAll('.star2').forEach(s => s.classList.toggle('active', parseInt(s.dataset.val)<=n)); }

// WEATHER
document.querySelectorAll('.weather-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.weather-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    document.getElementById('raceWeather').value = this.dataset.val;
  });
});

document.querySelectorAll('.weather-btn2').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.weather-btn2').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    document.getElementById('multiWeather').value = this.dataset.val;
  });
});

// ══════════════════════════════════════════════
// MODALS
// ══════════════════════════════════════════════

function openModal(id) { document.getElementById(id+'Overlay').classList.add('open'); }
function closeModal(id) { document.getElementById(id+'Overlay').classList.remove('open'); }

let pendingDelete = null;
function confirmDelete(type, id) {
  pendingDelete = {type, id};
  openModal('confirm');
  document.getElementById('confirmDeleteBtn').onclick = function() { doDelete(type, id); closeModal('confirm'); };
}

function doDelete(type, id) {
  if (type === 'race') {
    const r = db.races.find(x => x.id===id);
    const sport = r?.sport;
    db.races = db.races.filter(x => x.id!==id);
    saveDB();
    if (sport && SPORT_CONFIG[sport]) renderSportPage(sport);
    if (sport && MULTI_CONFIG[sport]) renderMultiPage(sport);
    if (currentPage==='dashboard') renderDashboard();
    if (currentPage==='planning') renderPlanningPage();
  } else if (type === 'physio') {
    db.physio = db.physio.filter(x => x.id!==id);
    saveDB(); renderPhysioPage();
  } else if (type === 'materiel') {
    db.materiel = db.materiel.filter(x => x.id!==id);
    db.composants = db.composants.filter(c => c.materielId!==id);
    saveDB(); renderMaterielPage();
  }
  toast('Supprimé');
}

// ══════════════════════════════════════════════
// EXPORT / IMPORT
// ══════════════════════════════════════════════

function exportData() {
  const json = JSON.stringify(db, null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], {type:'application/json'}));
  a.download = `endurancelab_${todayStr()}.json`;
  a.click();
  toast('Données exportées');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.races !== undefined) { db = {races:[],physio:[],materiel:[],composants:[],...data}; saveDB(); navigate(currentPage); toast('Données importées'); }
      else toast('Format invalide', true);
    } catch { toast('Erreur de lecture', true); }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ══════════════════════════════════════════════
// FORMATTERS
// ══════════════════════════════════════════════

function formatTime(sec) {
  if (!sec) return '—';
  const [h,m,s] = secToHMS(sec);
  if (h>0) return `${h}h${String(m).padStart(2,'0')}'${String(s).padStart(2,'0')}"`;
  return `${m}'${String(s).padStart(2,'0')}"`;
}

function secToHMS(sec) {
  const s = Math.floor(sec%60), m = Math.floor((sec/60)%60), h = Math.floor(sec/3600);
  return [h,m,s];
}

function formatPacePerKm(totalSec, km) {
  if (!totalSec||!km) return '—';
  const spk = totalSec/km;
  return `${Math.floor(spk/60)}'${String(Math.round(spk%60)).padStart(2,'0')}"`;
}

function formatPacePer100m(totalSec, km) {
  if (!totalSec||!km) return '—';
  const sp100 = totalSec/(km*10);
  return `${Math.floor(sp100/60)}'${String(Math.round(sp100%60)).padStart(2,'0')}"`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y,m,d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function renderStars(n) {
  let h = '';
  for (let i=1; i<=5; i++) h += `<span class="${i<=n?'star-filled':'star-empty'}">★</span>`;
  return h;
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toast(msg, error=false) {
  const ex = document.querySelector('.toast'); if (ex) ex.remove();
  const el = document.createElement('div');
  el.className = 'toast' + (error?' error':'');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════

loadDB();

document.querySelectorAll('.nav-item').forEach(link => {
  link.addEventListener('click', function(e) { e.preventDefault(); navigate(this.dataset.page); });
});

document.addEventListener('keydown', function(e) {
  if (e.key==='Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
});

// Update user avatar initial when name changes
const nameObs = new MutationObserver(() => {
  const name = document.getElementById('userDisplayName')?.textContent || '?';
  const av = document.getElementById('userAvatar');
  if (av) av.textContent = name.charAt(0).toUpperCase();
});
const nameEl = document.getElementById('userDisplayName');
if (nameEl) nameObs.observe(nameEl, { childList: true, characterData: true, subtree: true });

navigate('dashboard');
_appReady = true;
