const DATA_URL = './data/today.json';
const ET = 'America/New_York';

const state = {
  data: null,
  side: 'all',
  minEdge: 3,
  sort: 'edge-desc',
};

const $ = (id) => document.getElementById(id);

function pct(value, digits = 1) {
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

function signed(value, suffix = '') {
  const n = Number(value);
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}${suffix}`;
}

function americanOdds(value) {
  const n = Number(value);
  return n > 0 ? `+${n}` : `${n}`;
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTimeET(value) {
  const d = parseDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    hour: 'numeric',
    minute: '2-digit',
  }).format(d) + ' ET';
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

function formatDateTimeET(value) {
  const d = parseDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d) + ' ET';
}

function freshnessInfo() {
  const latest = parseDate(state.data?.freshness?.latest_quote_seen_at);
  const maxMinutes = Number(state.data?.summary?.max_quote_age_minutes || 180);
  if (!latest) return { level: 'error', label: 'No Quote Time', detail: 'Latest odds scan —' };
  const ageMinutes = Math.max(0, (Date.now() - latest.getTime()) / 60000);
  if (ageMinutes <= maxMinutes) {
    return { level: 'fresh', label: 'Data Fresh', detail: `Last odds scan ${formatTimeET(latest)}` };
  }
  if (ageMinutes <= maxMinutes * 2) {
    return { level: 'stale', label: 'Getting Stale', detail: `Last odds scan ${formatTimeET(latest)}` };
  }
  return { level: 'error', label: 'Snapshot Stale', detail: `Last odds scan ${formatTimeET(latest)}` };
}

function isShadowLabOpen() {
  const view = $('shadowLabView');
  return Boolean(view && !view.classList.contains('hidden'));
}

function setSidebarClockLabel(text) {
  const label = $('sidebarUpdated')?.previousElementSibling;
  if (label?.classList.contains('meta-label')) label.textContent = text;
}

function getShadowData() {
  try {
    return typeof shadowState !== 'undefined' ? shadowState.data : null;
  } catch (_error) {
    return null;
  }
}

function setShadowHeaderState() {
  const d = getShadowData();
  const elements = [$('systemState'), $('topSystemState')];
  elements.forEach((el) => {
    if (!el) return;
    el.classList.remove('stale', 'error');
    el.innerHTML = `<span class="status-dot"></span>${d ? 'Shadow Updated' : 'Loading Shadow'}`;
  });
  setSidebarClockLabel('Shadow Results');

  if (!d) {
    $('topUpdated').textContent = 'Loading results…';
    $('sidebarUpdated').textContent = 'Loading…';
    $('dateChip').textContent = 'Shadow Results';
    return;
  }

  const throughDate = d.latest_settlement_run?.target_date || d.results?.[0]?.target_date || null;
  $('topUpdated').textContent = `Results ${formatDateTimeET(d.generated_at)}`;
  $('sidebarUpdated').textContent = formatDateTimeET(d.generated_at);
  $('dateChip').textContent = throughDate ? `Through ${formatDate(throughDate)}` : 'Shadow Results';
}

function setSystemState() {
  const fresh = freshnessInfo();
  const freshnessTitle = document.querySelector('.freshness-title');
  if (freshnessTitle) freshnessTitle.classList.toggle('stale', fresh.level !== 'fresh');
  if ($('freshnessLabel')) $('freshnessLabel').textContent = fresh.label;
  if ($('oddsScanTime')) $('oddsScanTime').textContent = fresh.detail;

  if (isShadowLabOpen()) {
    setShadowHeaderState();
    return;
  }

  const elements = [$('systemState'), $('topSystemState')];
  elements.forEach((el) => {
    if (!el) return;
    el.classList.remove('stale', 'error');
    if (fresh.level === 'stale') el.classList.add('stale');
    if (fresh.level === 'error') el.classList.add('error');
    el.innerHTML = `<span class="status-dot"></span>${fresh.label}`;
  });
}

function marketRows() {
  if (!state.data) return [];
  let rows = [...state.data.markets];
  if (state.side !== 'all') {
    rows = rows.filter((row) => row.side.toLowerCase() === state.side);
  }
  if (state.minEdge > -900) {
    rows = rows.filter((row) => row.research_candidate && Number(row.edge_pp) >= state.minEdge);
  }

  const sorters = {
    'edge-desc': (a, b) => Number(b.edge_pp) - Number(a.edge_pp),
    'ev-desc': (a, b) => Number(b.ev) - Number(a.ev),
    'game-time': (a, b) => (parseDate(a.game_datetime)?.getTime() || 0) - (parseDate(b.game_datetime)?.getTime() || 0),
    'pitcher': (a, b) => a.pitcher_name.localeCompare(b.pitcher_name),
  };
  rows.sort(sorters[state.sort] || sorters['edge-desc']);
  return rows;
}

function renderTable(rows) {
  const tbody = $('marketTableBody');
  tbody.innerHTML = rows.map((row, index) => {
    const edgeClass = Number(row.edge_pp) >= 0 ? 'edge-positive' : 'edge-negative';
    const evClass = Number(row.ev) >= 0 ? 'ev-positive' : 'ev-negative';
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${formatTimeET(row.game_datetime)}</td>
        <td class="pitcher-cell"><span class="team-pill">${row.team_abbr}</span>${row.pitcher_name}</td>
        <td><span class="team-pill">${row.opponent_abbr}</span>${row.opponent}</td>
        <td>${Number(row.projected_k).toFixed(2)}</td>
        <td>${row.sportsbook}</td>
        <td>${row.side}</td>
        <td>${Number(row.line).toFixed(1)}</td>
        <td>${americanOdds(row.american_odds)}</td>
        <td>${pct(row.model_probability)}</td>
        <td>${pct(row.market_fair_probability)}</td>
        <td class="${edgeClass}">${signed(row.edge_pp)}</td>
        <td class="${evClass}">${signed(Number(row.ev) * 100, '%')}</td>
        <td><span class="status-badge ${row.research_candidate ? 'research' : ''}">${row.research_candidate ? 'Research' : 'Monitor'}</span></td>
      </tr>`;
  }).join('');
}

function renderMobile(rows) {
  $('mobileCards').innerHTML = rows.map((row) => `
    <article class="mobile-market-card">
      <div class="mobile-card-top">
        <span class="team-pill">${row.team_abbr}</span>
        <div class="mobile-card-title">
          <strong>${row.pitcher_name}</strong>
          <span>${row.opponent_abbr} · ${row.throwing_hand ? `${row.throwing_hand}HP` : 'Pitcher'}</span>
        </div>
        <span class="status-badge ${row.research_candidate ? 'research' : ''}">${row.research_candidate ? 'Research' : 'Monitor'}</span>
      </div>
      <div class="mobile-game-time">${formatTimeET(row.game_datetime)}</div>
      <div class="market-line"><span>${row.side}</span><span>${Number(row.line).toFixed(1)}</span><span>${americanOdds(row.american_odds)}</span></div>
      <dl class="card-stats">
        <dt>Projection</dt><dd>${Number(row.projected_k).toFixed(2)} K</dd>
        <dt>Model Prob</dt><dd>${pct(row.model_probability)}</dd>
        <dt>Market Fair</dt><dd>${pct(row.market_fair_probability)}</dd>
        <dt>Edge</dt><dd class="${Number(row.edge_pp) >= 0 ? 'edge-positive' : 'edge-negative'}">${signed(row.edge_pp, ' pp')}</dd>
        <dt>Est. EV</dt><dd class="${Number(row.ev) >= 0 ? 'ev-positive' : 'ev-negative'}">${signed(Number(row.ev) * 100, '%')}</dd>
      </dl>
      <button class="card-analysis" type="button" disabled>Player Analysis coming next</button>
    </article>`).join('');
}

function renderMarkets() {
  const rows = marketRows();
  renderTable(rows);
  renderMobile(rows);
  $('emptyState').classList.toggle('hidden', rows.length !== 0);
}

function renderSummary() {
  const d = state.data;
  const s = d.summary;
  $('pricedCount').textContent = s.pitchers_priced;
  $('pricedSides').textContent = `${s.sides_priced} sides`;
  $('candidateCount').textContent = s.research_candidates;
  $('candidateThreshold').textContent = `≥ ${(Number(s.min_edge) * 100).toFixed(0)} pp edge & ≥ ${(Number(s.min_ev) * 100).toFixed(0)}% EV`;
  $('unmatchedCount').textContent = s.unmatched_market_names;
  $('snapshotTime').textContent = `Latest snapshot ${formatTimeET(d.freshness.latest_quote_seen_at)}`;
  $('modelVersion').textContent = d.model_version.replace('_', ' ');
  setSidebarClockLabel('Today Snapshot');
  $('sidebarUpdated').textContent = formatDateTimeET(d.generated_at);
  $('topUpdated').textContent = `Snapshot ${formatTimeET(d.generated_at)}`;
  $('dateChip').textContent = formatDate(d.target_date);
  $('previewBanner').classList.toggle('hidden', !d.sample_data);

  $('insightCandidates').textContent = s.research_candidates;
  $('insightUnders').textContent = s.candidate_sides?.under ?? 0;
  $('insightOvers').textContent = s.candidate_sides?.over ?? 0;
  $('insightUnmatched').textContent = s.unmatched_market_names;
  $('donutUnders').textContent = s.candidate_sides?.under ?? 0;
  $('donutOvers').textContent = s.candidate_sides?.over ?? 0;
  setSystemState();
}

function renderEdgeChart() {
  const buckets = state.data.summary.edge_buckets || {};
  const items = [
    ['0–3 pp', Number(buckets['0_3'] || 0), true],
    ['3–5 pp', Number(buckets['3_5'] || 0), false],
    ['5–10 pp', Number(buckets['5_10'] || 0), false],
    ['10+ pp', Number(buckets['10_plus'] || 0), false],
  ];
  const max = Math.max(1, ...items.map((x) => x[1]));
  $('edgeChart').innerHTML = items.map(([label, value, neutral]) => `
    <div class="bar-group">
      <div class="bar ${neutral ? 'neutral' : ''}" style="height:${Math.max(3, Math.round((value / max) * 82))}px"><span class="bar-value">${value}</span></div>
      <div class="bar-label">${label}</div>
    </div>`).join('');

  const unders = Number(state.data.summary.candidate_sides?.under || 0);
  const overs = Number(state.data.summary.candidate_sides?.over || 0);
  const total = Math.max(1, unders + overs);
  const underDegrees = (unders / total) * 360;
  $('sideDonut').style.background = `conic-gradient(var(--gold) 0deg ${underDegrees}deg, #7d8c98 ${underDegrees}deg 360deg)`;
}

function renderRuns() {
  $('recentRuns').innerHTML = (state.data.recent_runs || []).map((run) => {
    const failed = !['success', 'skipped_no_games'].includes(String(run.status).toLowerCase());
    return `
      <div class="run-card">
        <div class="run-card-top"><span>${run.name}</span><span class="run-status ${failed ? 'failed' : ''}">${failed ? 'Attention' : '✓ Success'}</span></div>
        <div class="run-detail">${formatDateTimeET(run.finished_at)} · ${run.detail}</div>
      </div>`;
  }).join('');
}

function renderAll() {
  renderSummary();
  renderMarkets();
  renderEdgeChart();
  renderRuns();
}

function bindControls() {
  document.querySelectorAll('[data-side]').forEach((button) => {
    button.addEventListener('click', () => {
      state.side = button.dataset.side;
      document.querySelectorAll('[data-side]').forEach((b) => b.classList.toggle('active', b === button));
      renderMarkets();
    });
  });

  document.querySelectorAll('[data-edge]').forEach((button) => {
    button.addEventListener('click', () => {
      state.minEdge = Number(button.dataset.edge);
      document.querySelectorAll('[data-edge]').forEach((b) => b.classList.toggle('active', b === button));
      renderMarkets();
    });
  });

  $('sortSelect').addEventListener('change', (event) => {
    state.sort = event.target.value;
    renderMarkets();
  });

  $('refreshButton').addEventListener('click', () => window.location.reload());
  $('menuButton').addEventListener('click', () => $('sidebar').classList.toggle('open'));
  document.addEventListener('click', (event) => {
    const section = event.target.closest('[data-section]')?.dataset.section;
    if (section === 'shadow') {
      setTimeout(setSystemState, 0);
      setTimeout(setSystemState, 500);
      setTimeout(setSystemState, 1500);
    } else if (section === 'today' || section === 'player') {
      setTimeout(() => {
        if (state.data && !isShadowLabOpen()) renderSummary();
      }, 0);
    }
    if (event.target.closest('#shadowReload')) {
      setTimeout(setSystemState, 500);
      setTimeout(setSystemState, 1500);
    }

    if (window.innerWidth > 820) return;
    if (!$('sidebar').contains(event.target) && !$('menuButton').contains(event.target)) $('sidebar').classList.remove('open');
  });
}

async function loadData() {
  try {
    const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Dashboard snapshot returned HTTP ${response.status}`);
    state.data = await response.json();
    renderAll();
    setInterval(setSystemState, 60000);
  } catch (error) {
    console.error(error);
    $('errorBanner').textContent = `Unable to load the dashboard snapshot: ${error.message}`;
    $('errorBanner').classList.remove('hidden');
  }
}

bindControls();
loadData();
