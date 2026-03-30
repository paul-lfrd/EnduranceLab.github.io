/* ═══════════════════════════════════════════════════
   ENDURANCE LAB — app.js
   ═══════════════════════════════════════════════════ */

'use strict';

// ══════════════════════════════════════════════
// DATA STORE
// ══════════════════════════════════════════════

const STORAGE_KEY = 'endurancelab_v2';

const SPORT_CONFIG = {
  'course':        { label: 'Course Route',    color: '#ff6b35', class: 'run',   fields: ['distance','time','deniv'] },
  'triathlon-run': { label: 'Run Triathlon',   color: '#f5a623', class: 'tri',   fields: ['distance','time'] },
  'natation':      { label: 'Natation',        color: '#00bcd4', class: 'swim',  fields: ['distance','time','pace'] },
  'velo':          { label: 'Vélo',            color: '#7c4dff', class: 'bike',  fields: ['distance','time'] },
  'trail':         { label: 'Trail',           color: '#4caf50', class: 'trail', fields: ['distance','time','deniv'] },
  'cross':         { label: 'Cross Country',   color: '#e91e63', class: 'cross', fields: ['distance','time'] },
};

const CAT_LABELS = {
  'velo': 'Vélo', 'chaussures-run': 'Chaussures run', 'chaussures-trail': 'Chaussures trail',
  'chaussures-cross': 'Chaussures cross', 'combinaison': 'Combinaison', 'casque': 'Casque',
  'composant': 'Composant vélo', 'autre': 'Autre'
};

let db = { races: [], physio: [], materiel: [], composants: [] };

function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      db = { races: [], physio: [], materiel: [], composants: [], ...parsed };
    }
  } catch(e) { console.warn('DB load error', e); }
}

function saveDB() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }
  catch(e) { toast('Erreur de sauvegarde', true); }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ══════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════

let currentPage = 'dashboard';
let currentSport = null;
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();

function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  currentPage = page;

  if (page === 'dashboard') renderDashboard();
  else if (SPORT_CONFIG[page]) { currentSport = page; renderSportPage(page); }
  else if (page === 'physio') renderPhysioPage();
  else if (page === 'materiel') renderMaterielPage();
  else if (page === 'calendrier') renderCalendar();

  // close sidebar on mobile
  if (window.innerWidth < 768) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ══════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════

function renderDashboard() {
  document.getElementById('currentYear').textContent = new Date().getFullYear();
  renderDashStats();
  renderDashRecent();
  renderDashPhysio();
  renderDashMaterielAlert();
}

function renderDashStats() {
  const el = document.getElementById('dash-stats');
  const year = new Date().getFullYear();
  const yearRaces = db.races.filter(r => r.date && r.date.startsWith(year.toString()));

  const byType = {};
  Object.keys(SPORT_CONFIG).forEach(k => {
    byType[k] = yearRaces.filter(r => r.sport === k).length;
  });

  const totalKm = yearRaces.reduce((s, r) => s + (r.distance || 0), 0);

  el.innerHTML = `
    <h3>Saison ${year}</h3>
    <div class="stat-row" style="margin-bottom:16px">
      <div class="stat-item">
        <span class="stat-value">${yearRaces.length}</span>
        <span class="stat-label">Courses</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${totalKm.toFixed(0)}</span>
        <span class="stat-label">km compétition</span>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${Object.entries(SPORT_CONFIG).map(([k, cfg]) => `
        <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px">
          <span><span class="sport-dot" style="background:${cfg.color}"></span>${cfg.label}</span>
          <span style="font-family:var(--font-mono);color:var(--text2)">${byType[k]} course${byType[k]>1?'s':''}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderDashRecent() {
  const el = document.getElementById('dash-recent');
  const recent = [...db.races].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5);
  el.innerHTML = `
    <h3>Dernières courses</h3>
    ${recent.length === 0 ? '<div class="empty-state" style="padding:16px">Aucune course enregistrée</div>' :
      recent.map(r => {
        const cfg = SPORT_CONFIG[r.sport] || {};
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="showRaceDetail('${r.id}')">
          <div>
            <span class="sport-dot" style="background:${cfg.color}"></span>
            <span style="font-size:13px;font-weight:500">${escHtml(r.name)}</span>
          </div>
          <div style="text-align:right">
            <div style="font-family:var(--font-mono);font-size:12px;color:var(--accent)">${formatTime(r.timeTotal)}</div>
            <div style="font-size:11px;color:var(--text3)">${formatDate(r.date)}</div>
          </div>
        </div>`;
      }).join('')
    }
  `;
}

function renderDashPhysio() {
  const el = document.getElementById('dash-physio');
  const latest = {};

  db.physio.forEach(p => {
    if (!latest[p.sport] || p.date > latest[p.sport].date) latest[p.sport] = p;
  });

  const lc = latest.course || null;
  const ln = latest.natation || null;
  const lv = latest.velo || null;

  el.innerHTML = `
    <h3>Dernières mesures physio</h3>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${lc ? `<div>
        <span class="badge" style="background:rgba(255,107,53,.1);color:var(--run);margin-bottom:6px">Course</span>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          ${lc.vma ? `<div class="physio-pill"><span class="label">VMA</span><span class="value">${lc.vma} km/h</span></div>` : ''}
          ${lc.fcmax ? `<div class="physio-pill"><span class="label">FC max</span><span class="value">${lc.fcmax} bpm</span></div>` : ''}
        </div>
      </div>` : ''}
      ${lv ? `<div>
        <span class="badge" style="background:rgba(124,77,255,.1);color:var(--bike);margin-bottom:6px">Vélo</span>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          ${lv.ftp ? `<div class="physio-pill"><span class="label">FTP</span><span class="value">${lv.ftp} W</span></div>` : ''}
          ${lv.pma ? `<div class="physio-pill"><span class="label">PMA</span><span class="value">${lv.pma} W</span></div>` : ''}
          ${lv.wkg ? `<div class="physio-pill"><span class="label">W/kg</span><span class="value">${lv.wkg}</span></div>` : ''}
        </div>
      </div>` : ''}
      ${ln ? `<div>
        <span class="badge" style="background:rgba(0,188,212,.1);color:var(--swim);margin-bottom:6px">Natation</span>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          ${ln.vc ? `<div class="physio-pill"><span class="label">Vit. critique</span><span class="value">${ln.vc}/100m</span></div>` : ''}
        </div>
      </div>` : ''}
      ${!lc && !ln && !lv ? '<div style="color:var(--text3);font-size:13px">Aucune donnée physio</div>' : ''}
    </div>
  `;
}

function renderDashMaterielAlert() {
  const el = document.getElementById('dash-materiel-alert');
  const alerts = getMaterielAlerts();

  el.innerHTML = `
    <h3>Alertes matériel</h3>
    ${alerts.length === 0 ? '<div style="color:var(--text3);font-size:13px">Tout est en ordre ✓</div>' :
      alerts.map(a => `
        <div class="alert-banner ${a.level}">
          <span>${a.level === 'danger' ? '⚠️' : '⚡'}</span>
          <span><strong>${escHtml(a.nom)}</strong> — ${a.msg}</span>
        </div>
      `).join('')
    }
  `;
}

function getMaterielAlerts() {
  const alerts = [];
  db.materiel.forEach(m => {
    if (!m.alerte || m.alerte === 0) return;
    const pct = m.km / m.alerte;
    if (pct >= 1) {
      alerts.push({ nom: m.nom, msg: `Dépassement : ${m.km} / ${m.alerte} km`, level: 'danger' });
    } else if (pct >= 0.85) {
      alerts.push({ nom: m.nom, msg: `Bientôt à changer : ${m.km} / ${m.alerte} km`, level: '' });
    }

    // Check composant alerts
    db.composants.filter(c => c.materielId === m.id && c.nextKm).forEach(c => {
      const kmSince = m.km - c.km;
      const pctC = kmSince / c.nextKm;
      if (pctC >= 1) alerts.push({ nom: `${m.nom} — ${c.type}`, msg: `Entretien dépassé de ${kmSince - c.nextKm} km`, level: 'danger' });
      else if (pctC >= 0.85) alerts.push({ nom: `${m.nom} — ${c.type}`, msg: `Entretien dans ${c.nextKm - kmSince} km`, level: '' });
    });
  });
  return alerts;
}

// ══════════════════════════════════════════════
// SPORT PAGES
// ══════════════════════════════════════════════

function renderSportPage(sport) {
  renderPhysioBar(sport);
  renderRacesTable(sport);
}

function renderPhysioBar(sport) {
  const el = document.getElementById('physio-' + sport);
  if (!el) return;

  const pills = [];
  const latestCourse = getLatestPhysio('course');
  const latestNat = getLatestPhysio('natation');
  const latestVelo = getLatestPhysio('velo');

  if (['course', 'triathlon-run', 'cross'].includes(sport) && latestCourse) {
    if (latestCourse.vma) pills.push({ label: 'VMA', value: latestCourse.vma + ' km/h', date: latestCourse.date });
    if (latestCourse.seuilAllure) pills.push({ label: 'Allure seuil', value: latestCourse.seuilAllure + '/km', date: latestCourse.date });
    if (latestCourse.fcmax) pills.push({ label: 'FC max', value: latestCourse.fcmax + ' bpm', date: latestCourse.date });
  }
  if (sport === 'trail' && latestCourse) {
    if (latestCourse.vma) pills.push({ label: 'VMA', value: latestCourse.vma + ' km/h', date: latestCourse.date });
  }
  if (sport === 'natation' && latestNat) {
    if (latestNat.vc) pills.push({ label: 'Vit. critique', value: latestNat.vc + '/100m', date: latestNat.date });
    if (latestNat.vsmax) pills.push({ label: 'Sprint', value: latestNat.vsmax + '/100m', date: latestNat.date });
  }
  if (sport === 'velo' && latestVelo) {
    if (latestVelo.ftp) pills.push({ label: 'FTP', value: latestVelo.ftp + ' W', date: latestVelo.date });
    if (latestVelo.pma) pills.push({ label: 'PMA', value: latestVelo.pma + ' W', date: latestVelo.date });
    if (latestVelo.wkg) pills.push({ label: 'W/kg', value: latestVelo.wkg, date: latestVelo.date });
  }

  if (pills.length === 0) {
    el.innerHTML = `<span style="color:var(--text3);font-size:12px">Aucune donnée physio — <a href="#" onclick="event.preventDefault();navigate('physio')" style="color:var(--accent)">ajouter une mesure</a></span>`;
    return;
  }

  el.innerHTML = pills.map(p => `
    <div class="physio-pill">
      <span class="label">${p.label}</span>
      <span class="value">${p.value}</span>
      <span class="date">${formatDate(p.date)}</span>
    </div>
  `).join('');
}

function getLatestPhysio(sport) {
  const entries = db.physio.filter(p => p.sport === sport).sort((a,b) => b.date.localeCompare(a.date));
  return entries[0] || null;
}

function renderRacesTable(sport) {
  const el = document.getElementById('races-' + sport);
  if (!el) return;

  const races = db.races.filter(r => r.sport === sport).sort((a,b) => b.date.localeCompare(a.date));

  if (races.length === 0) {
    el.innerHTML = `<div class="empty-state"><span class="empty-icon">🏁</span>Aucune course enregistrée</div>`;
    return;
  }

  const isSwim = sport === 'natation';
  const hasTrail = ['trail', 'course', 'cross'].includes(sport);

  el.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Course</th>
          <th>Dist.</th>
          ${hasTrail ? '<th>D+</th>' : ''}
          <th>Temps</th>
          ${isSwim ? '<th>Allure/100m</th>' : '<th>Allure/km</th>'}
          <th>Clas. Gén.</th>
          <th>Clas. Cat.</th>
          <th>Note</th>
          <th>Météo</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${races.map(r => {
          const allure = isSwim
            ? (r.distance ? formatPacePer100m(r.timeTotal, r.distance) : '—')
            : (r.distance ? formatPacePerKm(r.timeTotal, r.distance) : '—');
          return `
            <tr onclick="showRaceDetail('${r.id}')">
              <td style="color:var(--text2);font-size:12px">${formatDate(r.date)}</td>
              <td style="font-weight:500;max-width:180px;overflow:hidden;text-overflow:ellipsis">${escHtml(r.name)}</td>
              <td>${r.distance ? r.distance + ' km' : '—'}</td>
              ${hasTrail ? `<td>${r.deniv ? r.deniv + ' m' : '—'}</td>` : ''}
              <td class="time-cell">${formatTime(r.timeTotal)}</td>
              <td class="time-cell" style="font-size:12px">${allure}</td>
              <td class="rank-cell">${r.rankGeneral ? r.rankGeneral + (r.participants ? '/' + r.participants : '') : '—'}</td>
              <td class="rank-cell">${r.rankCat || '—'}</td>
              <td class="stars-cell">${renderStars(r.note)}</td>
              <td>${r.weather || ''}</td>
              <td onclick="event.stopPropagation()">
                <button class="btn-icon" onclick="openRaceModal('${sport}', '${r.id}')" title="Modifier">✎</button>
                <button class="btn-icon del" onclick="confirmDelete('race', '${r.id}')" title="Supprimer">✕</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// ══════════════════════════════════════════════
// RACE MODAL
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

  // Show/hide fields
  const isTrail = ['trail', 'course'].includes(sport);
  document.getElementById('denivField').style.display = isTrail ? '' : 'none';
  document.getElementById('swimTimeField').style.display = sport === 'natation' ? '' : 'none';

  // Reset stars
  document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));

  // Reset weather
  document.querySelectorAll('.weather-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('raceWeather').value = '';

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

      // Set time
      if (r.timeTotal) {
        const [h, m, s] = secToHMS(r.timeTotal);
        document.getElementById('timeH').value = h;
        document.getElementById('timeM').value = m;
        document.getElementById('timeS').value = s;
      }

      // Set swim pace
      if (sport === 'natation' && r.swimPace) {
        const [pm, ps] = r.swimPace.split(':');
        document.getElementById('swimM').value = pm || '';
        document.getElementById('swimS').value = ps || '';
      }

      // Stars
      setStars(r.note || 0);

      // Weather
      if (r.weather) {
        document.querySelectorAll('.weather-btn').forEach(b => {
          if (b.dataset.val === r.weather) b.classList.add('active');
        });
      }
    }
  } else {
    document.getElementById('raceDate').value = new Date().toISOString().split('T')[0];
  }

  openModal('raceModal');
}

document.getElementById('raceForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const sport = document.getElementById('raceSport').value;
  const id = document.getElementById('raceId').value || uid();

  const h = parseInt(document.getElementById('timeH').value) || 0;
  const m = parseInt(document.getElementById('timeM').value) || 0;
  const s = parseInt(document.getElementById('timeS').value) || 0;
  const timeTotal = h * 3600 + m * 60 + s;

  const swimM = parseInt(document.getElementById('swimM').value) || 0;
  const swimS = parseInt(document.getElementById('swimS').value) || 0;
  const swimPace = sport === 'natation' ? `${swimM}:${String(swimS).padStart(2,'0')}` : null;

  const race = {
    id,
    sport,
    name: document.getElementById('raceName').value.trim(),
    date: document.getElementById('raceDate').value,
    distance: parseFloat(document.getElementById('raceDistance').value) || 0,
    deniv: parseInt(document.getElementById('raceDeniv').value) || 0,
    timeTotal,
    swimPace,
    rankGeneral: parseInt(document.getElementById('raceRankGeneral').value) || 0,
    rankCat: parseInt(document.getElementById('raceRankCat').value) || 0,
    participants: parseInt(document.getElementById('raceParticipants').value) || 0,
    note: parseInt(document.getElementById('raceNote').value) || 0,
    comment: document.getElementById('raceComment').value.trim(),
    weather: document.getElementById('raceWeather').value,
  };

  const idx = db.races.findIndex(r => r.id === id);
  if (idx >= 0) db.races[idx] = race;
  else db.races.push(race);

  saveDB();
  closeModal('raceModal');
  renderSportPage(sport);
  if (currentPage === 'dashboard') renderDashboard();
  toast(editingRaceId ? 'Course modifiée' : 'Course enregistrée');
});

// ══════════════════════════════════════════════
// RACE DETAIL
// ══════════════════════════════════════════════

function showRaceDetail(id) {
  const r = db.races.find(x => x.id === id);
  if (!r) return;
  const cfg = SPORT_CONFIG[r.sport] || {};

  const allure = r.sport === 'natation'
    ? formatPacePer100m(r.timeTotal, r.distance)
    : formatPacePerKm(r.timeTotal, r.distance);

  document.getElementById('raceDetailTitle').textContent = r.name;

  document.getElementById('raceDetailBody').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <span class="badge" style="background:${cfg.color}22;color:${cfg.color}">${cfg.label}</span>
      <span style="font-family:var(--font-mono);font-size:12px;color:var(--text3)">${formatDate(r.date)}</span>
      <span>${r.weather || ''}</span>
    </div>
    <div class="race-detail-grid">
      ${r.timeTotal ? `<div class="race-detail-stat"><div class="label">Temps</div><div class="value" style="color:var(--accent)">${formatTime(r.timeTotal)}</div></div>` : ''}
      ${r.distance ? `<div class="race-detail-stat"><div class="label">Distance</div><div class="value">${r.distance} km</div></div>` : ''}
      ${r.deniv ? `<div class="race-detail-stat"><div class="label">Dénivelé +</div><div class="value">${r.deniv} m</div></div>` : ''}
      ${r.timeTotal && r.distance ? `<div class="race-detail-stat"><div class="label">${r.sport==='natation'?'Allure /100m':'Allure /km'}</div><div class="value">${allure}</div></div>` : ''}
      ${r.rankGeneral ? `<div class="race-detail-stat"><div class="label">Clas. général</div><div class="value">${r.rankGeneral}${r.participants ? '/' + r.participants : ''}</div></div>` : ''}
      ${r.rankCat ? `<div class="race-detail-stat"><div class="label">Clas. catégorie</div><div class="value">${r.rankCat}</div></div>` : ''}
      ${r.participants ? `<div class="race-detail-stat"><div class="label">Participants</div><div class="value">${r.participants}</div></div>` : ''}
      ${r.note ? `<div class="race-detail-stat"><div class="label">Note</div><div class="value">${renderStars(r.note)} <span style="font-size:14px">(${r.note}/5)</span></div></div>` : ''}
    </div>
    ${r.comment ? `
      <div class="sub-section-title">Récap / Commentaire</div>
      <div class="race-detail-comment">${escHtml(r.comment)}</div>
    ` : ''}
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn-secondary" onclick="closeModal('raceDetail');openRaceModal('${r.sport}','${r.id}')">✎ Modifier</button>
      <button class="btn-danger" onclick="closeModal('raceDetail');confirmDelete('race','${r.id}')">Supprimer</button>
    </div>
  `;

  openModal('raceDetail');
}

// ══════════════════════════════════════════════
// PHYSIO PAGE
// ══════════════════════════════════════════════

function renderPhysioPage() {
  const el = document.getElementById('physio-grid');
  const sorted = [...db.physio].sort((a,b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">📊</span>Aucune mesure enregistrée</div>`;
    return;
  }

  el.innerHTML = sorted.map(p => {
    const metrics = buildPhysioMetrics(p);
    return `
      <div class="physio-card">
        <div class="physio-card-header">
          <span class="physio-card-sport ${p.sport}">${p.sport === 'course' ? 'Course' : p.sport === 'natation' ? 'Natation' : 'Vélo'}</span>
          <span class="physio-card-date">${formatDate(p.date)}</span>
        </div>
        <div class="physio-metrics">
          ${metrics.map(m => `
            <div class="physio-metric">
              <span class="m-label">${m.label}</span>
              <span class="m-value" style="color:${m.color||'var(--text)'}">${m.value}</span>
            </div>
          `).join('')}
        </div>
        ${p.notes ? `<div style="margin-top:10px;font-size:11px;color:var(--text3);font-style:italic">${escHtml(p.notes)}</div>` : ''}
        <div style="margin-top:10px;display:flex;gap:6px">
          <button class="btn-icon" onclick="openPhysioModal('${p.id}')" title="Modifier">✎</button>
          <button class="btn-icon del" onclick="confirmDelete('physio','${p.id}')" title="Supprimer">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

function buildPhysioMetrics(p) {
  const metrics = [];
  if (p.sport === 'course') {
    if (p.vma) metrics.push({ label: 'VMA', value: p.vma + ' km/h', color: 'var(--run)' });
    if (p.seuilAllure) metrics.push({ label: 'Allure seuil', value: p.seuilAllure + ' /km' });
    if (p.fcmax) metrics.push({ label: 'FC max', value: p.fcmax + ' bpm' });
    if (p.poids) metrics.push({ label: 'Poids', value: p.poids + ' kg' });
  }
  if (p.sport === 'natation') {
    if (p.vc) metrics.push({ label: 'Vitesse critique', value: p.vc + ' /100m', color: 'var(--swim)' });
    if (p.vsmax) metrics.push({ label: 'Sprint max', value: p.vsmax + ' /100m' });
  }
  if (p.sport === 'velo') {
    if (p.ftp) metrics.push({ label: 'FTP', value: p.ftp + ' W', color: 'var(--bike)' });
    if (p.pma) metrics.push({ label: 'PMA', value: p.pma + ' W' });
    if (p.wkg) metrics.push({ label: 'W/kg (FTP)', value: p.wkg });
    if (p.poids) metrics.push({ label: 'Poids', value: p.poids + ' kg' });
  }
  return metrics;
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
        if (p.seuilAllure) {
          const [m, s] = p.seuilAllure.split(':');
          document.getElementById('physioSeuilM').value = m;
          document.getElementById('physioSeuilS').value = s;
        }
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
    document.getElementById('physioDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('physioForm').dataset.id = '';
    updatePhysioFields('course');
  }

  openModal('physioModal');
}

document.getElementById('physioSport').addEventListener('change', function() {
  updatePhysioFields(this.value);
});

function updatePhysioFields(sport) {
  document.querySelectorAll('.physio-sport-fields').forEach(f => f.style.display = 'none');
  const target = document.getElementById('physio-' + sport + '-fields');
  if (target) target.style.display = '';
}

// Auto-calc W/kg
document.getElementById('physioFTP').addEventListener('input', calcWkg);
document.getElementById('physioPoidsVelo').addEventListener('input', calcWkg);

function calcWkg() {
  const ftp = parseFloat(document.getElementById('physioFTP').value);
  const poids = parseFloat(document.getElementById('physioPoidsVelo').value);
  if (ftp && poids) document.getElementById('physioWkg').value = (ftp / poids).toFixed(2);
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
    const sm = document.getElementById('physioSeuilM').value;
    const ss = document.getElementById('physioSeuilS').value;
    if (sm || ss) p.seuilAllure = `${sm || 0}:${String(ss || 0).padStart(2,'0')}`;
  }
  if (sport === 'natation') {
    const vcm = document.getElementById('physioVCm').value;
    const vcs = document.getElementById('physioVCs').value;
    if (vcm || vcs) p.vc = `${vcm || 0}:${String(vcs || 0).padStart(2,'0')}`;
    const vm = document.getElementById('physioVSmaxM').value;
    const vs = document.getElementById('physioVSmaxS').value;
    if (vm || vs) p.vsmax = `${vm || 0}:${String(vs || 0).padStart(2,'0')}`;
  }
  if (sport === 'velo') {
    p.ftp = parseInt(document.getElementById('physioFTP').value) || null;
    p.pma = parseInt(document.getElementById('physioPMA').value) || null;
    p.poids = parseFloat(document.getElementById('physioPoidsVelo').value) || null;
    p.wkg = document.getElementById('physioWkg').value || null;
  }

  const idx = db.physio.findIndex(x => x.id === id);
  if (idx >= 0) db.physio[idx] = p;
  else db.physio.push(p);

  saveDB();
  closeModal('physioModal');
  renderPhysioPage();
  toast('Mesure enregistrée');
});

// ══════════════════════════════════════════════
// MATÉRIEL PAGE
// ══════════════════════════════════════════════

function renderMaterielPage() {
  const el = document.getElementById('materiel-grid');
  const alerts = getMaterielAlerts();
  const alertIds = new Set(alerts.filter(a => a.level === 'danger').map(a => a.nom.split('—')[0].trim()));

  if (db.materiel.length === 0) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">🔧</span>Aucun équipement enregistré</div>`;
    return;
  }

  el.innerHTML = db.materiel.map(m => {
    const pct = m.alerte ? Math.min(m.km / m.alerte, 1) : 0;
    const barClass = pct >= 1 ? 'danger' : pct >= 0.85 ? 'warn' : '';
    const cardClass = pct >= 1 ? 'danger' : pct >= 0.85 ? 'alert' : '';

    const composants = db.composants.filter(c => c.materielId === m.id).sort((a,b) => b.date.localeCompare(a.date));

    return `
      <div class="materiel-card ${cardClass}">
        <div class="materiel-card-header">
          <div>
            <div class="materiel-card-title">${escHtml(m.nom)}</div>
            <span class="materiel-cat-badge">${CAT_LABELS[m.cat] || m.cat}</span>
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn-icon" onclick="openMaterielModal('${m.id}')" title="Modifier">✎</button>
            <button class="btn-icon del" onclick="confirmDelete('materiel','${m.id}')" title="Supprimer">✕</button>
          </div>
        </div>
        ${m.alerte ? `
          <div class="km-bar-wrap">
            <div class="km-bar-label">
              <span>Kilométrage</span>
              <strong>${m.km} / ${m.alerte} km</strong>
            </div>
            <div class="km-bar"><div class="km-bar-fill ${barClass}" style="width:${(pct*100).toFixed(1)}%"></div></div>
          </div>
        ` : `<div style="font-family:var(--font-mono);font-size:13px;margin:8px 0;color:var(--text2)">${m.km || 0} km</div>`}
        ${m.dateAchat ? `<div style="font-size:11px;color:var(--text3);margin-bottom:8px">Depuis le ${formatDate(m.dateAchat)}</div>` : ''}
        ${m.notes ? `<div style="font-size:12px;color:var(--text2);margin-bottom:8px;font-style:italic">${escHtml(m.notes)}</div>` : ''}
        <div class="materiel-actions">
          <button class="btn-secondary small" onclick="openUpdateKm('${m.id}')">+ Km</button>
          <button class="btn-secondary small" onclick="openComposantModal('${m.id}')">+ Entretien</button>
        </div>
        ${composants.length > 0 ? `
          <div class="composants-list">
            ${composants.slice(0, 3).map(c => `
              <div class="composant-item">
                <div>
                  <span class="composant-type">${escHtml(c.type)}</span>
                  <span style="font-size:10px;color:var(--text3);margin-left:6px">${formatDate(c.date)}</span>
                </div>
                <span class="composant-km">${c.km ? c.km + ' km' : ''}</span>
              </div>
            `).join('')}
            ${composants.length > 3 ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">+${composants.length-3} autres</div>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function openMaterielModal(id = null) {
  document.getElementById('materielForm').reset();
  document.getElementById('materielId').value = id || '';
  document.getElementById('materielModalTitle').textContent = id ? 'Modifier équipement' : 'Nouvel équipement';
  document.getElementById('composantsSection').style.display = id ? '' : 'none';

  if (id) {
    const m = db.materiel.find(x => x.id === id);
    if (m) {
      document.getElementById('materielNom').value = m.nom || '';
      document.getElementById('materielCat').value = m.cat || 'velo';
      document.getElementById('materielDate').value = m.dateAchat || '';
      document.getElementById('materielKm').value = m.km || 0;
      document.getElementById('materielAlerte').value = m.alerte || 0;
      document.getElementById('materielNotes').value = m.notes || '';
      renderComposantsList(id);
    }
  } else {
    document.getElementById('materielDate').value = new Date().toISOString().split('T')[0];
  }

  openModal('materielModal');
}

function renderComposantsList(materielId) {
  const el = document.getElementById('composantsList');
  const list = db.composants.filter(c => c.materielId === materielId).sort((a,b) => b.date.localeCompare(a.date));
  if (list.length === 0) { el.innerHTML = '<div style="font-size:12px;color:var(--text3)">Aucun entretien</div>'; return; }
  el.innerHTML = list.map(c => `
    <div class="composant-item">
      <div><span>${escHtml(c.type)}</span><span style="font-size:10px;color:var(--text3);margin-left:8px">${formatDate(c.date)}</span></div>
      <div style="display:flex;align-items:center;gap:6px">
        <span class="composant-km">${c.km || ''} km</span>
        <button class="btn-icon del" onclick="deleteComposant('${c.id}','${materielId}')">✕</button>
      </div>
    </div>
  `).join('');
}

document.getElementById('materielForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const id = document.getElementById('materielId').value || uid();
  const m = {
    id,
    nom: document.getElementById('materielNom').value.trim(),
    cat: document.getElementById('materielCat').value,
    dateAchat: document.getElementById('materielDate').value,
    km: parseInt(document.getElementById('materielKm').value) || 0,
    alerte: parseInt(document.getElementById('materielAlerte').value) || 0,
    notes: document.getElementById('materielNotes').value.trim(),
  };
  const idx = db.materiel.findIndex(x => x.id === id);
  if (idx >= 0) db.materiel[idx] = m;
  else db.materiel.push(m);
  saveDB();
  closeModal('materielModal');
  renderMaterielPage();
  toast('Équipement enregistré');
});

// Quick Km update
let kmMaterielId = null;
function openUpdateKm(id) {
  kmMaterielId = id;
  const m = db.materiel.find(x => x.id === id);
  if (!m) return;
  const km = prompt(`Mettre à jour les km pour "${m.nom}"\nKm actuels : ${m.km}\n\nNouveau total (km) :`, m.km);
  if (km !== null && !isNaN(parseInt(km))) {
    m.km = parseInt(km);
    saveDB();
    renderMaterielPage();
    if (currentPage === 'dashboard') renderDashboard();
    toast('Kilométrage mis à jour');
  }
}

// Composant Modal
let composantMaterielId = null;
function openComposantModal(materielId) {
  composantMaterielId = materielId;
  document.getElementById('composantForm').reset();
  document.getElementById('composantMaterielId').value = materielId;
  document.getElementById('composantDate').value = new Date().toISOString().split('T')[0];
  const m = db.materiel.find(x => x.id === materielId);
  if (m) document.getElementById('composantKm').value = m.km || 0;
  openModal('composantModal');
}

document.getElementById('composantForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const c = {
    id: uid(),
    materielId: document.getElementById('composantMaterielId').value,
    type: document.getElementById('composantType').value.trim(),
    date: document.getElementById('composantDate').value,
    km: parseInt(document.getElementById('composantKm').value) || 0,
    nextKm: parseInt(document.getElementById('composantNextKm').value) || 0,
    notes: document.getElementById('composantNotes').value.trim(),
  };
  db.composants.push(c);
  saveDB();
  closeModal('composantModal');
  renderMaterielPage();
  toast('Entretien enregistré');
});

function deleteComposant(id, materielId) {
  db.composants = db.composants.filter(c => c.id !== id);
  saveDB();
  renderComposantsList(materielId);
}

function addComposant() {
  const id = document.getElementById('materielId').value;
  if (id) openComposantModal(id);
}

// ══════════════════════════════════════════════
// CALENDAR
// ══════════════════════════════════════════════

function renderCalendar() {
  const wrap = document.getElementById('calendar-wrap');
  const now = new Date();
  if (!calYear) calYear = now.getFullYear();
  if (calMonth === undefined) calMonth = now.getMonth();

  const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const days = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

  // Build races map by date
  const racesByDate = {};
  db.races.forEach(r => {
    if (!racesByDate[r.date]) racesByDate[r.date] = [];
    racesByDate[r.date].push(r);
  });

  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth + 1, 0);
  let startDow = firstDay.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1; // Mon-based

  const cells = [];
  for (let i = 0; i < startDow; i++) {
    const d = new Date(calYear, calMonth, 1 - (startDow - i));
    cells.push({ date: d, other: true });
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    cells.push({ date: new Date(calYear, calMonth, i), other: false });
  }
  while (cells.length % 7 !== 0) {
    const d = new Date(calYear, calMonth + 1, cells.length - lastDay.getDate() - startDow + 1);
    cells.push({ date: d, other: true });
  }

  const todayStr = now.toISOString().split('T')[0];

  wrap.innerHTML = `
    <div class="calendar-header">
      <button class="cal-nav" onclick="calNav(-1)">‹</button>
      <span class="cal-month-label">${months[calMonth]} ${calYear}</span>
      <button class="cal-nav" onclick="calNav(1)">›</button>
    </div>
    <div class="calendar-grid">
      <div class="cal-days-header">
        ${days.map(d => `<div class="cal-day-name">${d}</div>`).join('')}
      </div>
      <div class="cal-body">
        ${cells.map(cell => {
          const dateStr = cell.date.toISOString().split('T')[0];
          const dayRaces = racesByDate[dateStr] || [];
          return `
            <div class="cal-cell ${cell.other ? 'other-month' : ''} ${dateStr === todayStr ? 'today' : ''}">
              <div class="cal-date">${cell.date.getDate()}</div>
              ${dayRaces.map(r => {
                const cfg = SPORT_CONFIG[r.sport] || {};
                return `<div class="cal-event" style="background:${cfg.color}22;color:${cfg.color}" onclick="showRaceDetail('${r.id}')" title="${escHtml(r.name)}">${escHtml(r.name)}</div>`;
              }).join('')}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function calNav(dir) {
  calMonth += dir;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
}

// ══════════════════════════════════════════════
// STAR RATING
// ══════════════════════════════════════════════

document.querySelectorAll('.star').forEach(star => {
  star.addEventListener('click', function() {
    const val = parseInt(this.dataset.val);
    document.getElementById('raceNote').value = val;
    setStars(val);
  });
});

function setStars(n) {
  document.querySelectorAll('.star').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.val) <= n);
  });
}

// ══════════════════════════════════════════════
// WEATHER PICKER
// ══════════════════════════════════════════════

document.querySelectorAll('.weather-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.weather-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    document.getElementById('raceWeather').value = this.dataset.val;
  });
});

// ══════════════════════════════════════════════
// MODAL UTILS
// ══════════════════════════════════════════════

function openModal(id) {
  document.getElementById(id + 'Overlay').classList.add('open');
}

function closeModal(id) {
  document.getElementById(id + 'Overlay').classList.remove('open');
}

// ══════════════════════════════════════════════
// DELETE CONFIRM
// ══════════════════════════════════════════════

let pendingDelete = null;

function confirmDelete(type, id) {
  pendingDelete = { type, id };
  openModal('confirm');
  document.getElementById('confirmDeleteBtn').onclick = function() {
    doDelete(type, id);
    closeModal('confirm');
  };
}

function doDelete(type, id) {
  if (type === 'race') {
    const r = db.races.find(x => x.id === id);
    const sport = r ? r.sport : null;
    db.races = db.races.filter(x => x.id !== id);
    saveDB();
    if (sport) renderSportPage(sport);
    if (currentPage === 'dashboard') renderDashboard();
  } else if (type === 'physio') {
    db.physio = db.physio.filter(x => x.id !== id);
    saveDB();
    renderPhysioPage();
  } else if (type === 'materiel') {
    db.materiel = db.materiel.filter(x => x.id !== id);
    db.composants = db.composants.filter(c => c.materielId !== id);
    saveDB();
    renderMaterielPage();
  }
  toast('Supprimé');
}

// ══════════════════════════════════════════════
// EXPORT / IMPORT
// ══════════════════════════════════════════════

function exportData() {
  const json = JSON.stringify(db, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `endurancelab_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Données exportées');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.races !== undefined) {
        db = { races: [], physio: [], materiel: [], composants: [], ...data };
        saveDB();
        navigate(currentPage);
        toast('Données importées avec succès');
      } else {
        toast('Format de fichier invalide', true);
      }
    } catch(err) { toast('Erreur de lecture du fichier', true); }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ══════════════════════════════════════════════
// FORMATTERS
// ══════════════════════════════════════════════

function formatTime(seconds) {
  if (!seconds) return '—';
  const [h, m, s] = secToHMS(seconds);
  if (h > 0) return `${h}h${String(m).padStart(2,'0')}'${String(s).padStart(2,'0')}"`;
  return `${m}'${String(s).padStart(2,'0')}"`;
}

function secToHMS(sec) {
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  return [h, m, s];
}

function formatPacePerKm(totalSec, km) {
  if (!totalSec || !km) return '—';
  const secPerKm = totalSec / km;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}'${String(s).padStart(2,'0')}"`;
}

function formatPacePer100m(totalSec, km) {
  if (!totalSec || !km) return '—';
  const secPer100m = totalSec / (km * 10);
  const m = Math.floor(secPer100m / 60);
  const s = Math.round(secPer100m % 60);
  return `${m}'${String(s).padStart(2,'0')}"`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function renderStars(n) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="${i <= n ? 'star-filled' : 'star-empty'}">★</span>`;
  }
  return html;
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toast(msg, error = false) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'toast' + (error ? ' error' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════

loadDB();

// Nav links
document.querySelectorAll('.nav-item').forEach(link => {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    navigate(this.dataset.page);
  });
});

// Keyboard close modals
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

navigate('dashboard');
