const SHADOW_DATA_URL = './data/shadow.json';

const shadowState = {
  data: null,
  side: 'all',
  edge: 'all',
  sort: 'recent',
  open: false,
};

function slNumber(value, digits = 1, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(digits)}${suffix}`;
}

function slPct(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

function slSigned(value, digits = 1, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}${suffix}`;
}

function slMoney(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  return `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(2)}`;
}

function slDate(value) {
  if (!value) return '—';
  return formatDate(value).replace(/,\s\d{4}$/, '');
}

function slCreateView() {
  const today = document.querySelector('.content-wrap');
  if (!today || document.getElementById('shadowLabView')) return;
  today.id = 'todayView';

  const view = document.createElement('section');
  view.id = 'shadowLabView';
  view.className = 'content-wrap shadow-lab-view hidden';
  view.innerHTML = `
    <section class="sl-header">
      <div>
        <div class="sl-kicker">MODEL VALIDATION · SHADOW TRACKING</div>
        <h1>Shadow Lab</h1>
        <p>Measure whether research signals beat their entry price and move with the later Pinnacle market before treating them as actionable.</p>
      </div>
      <button class="ghost-button" id="shadowReload" type="button">↻ Reload results</button>
    </section>

    <div id="shadowError" class="error-banner hidden"></div>

    <section id="shadowMetrics" class="sl-metric-grid">
      <article class="sl-metric-card"><span>Settled Candidates</span><strong id="slSettled">—</strong><small id="slPending">— pending</small></article>
      <article class="sl-metric-card"><span>Record</span><strong id="slRecord">—</strong><small id="slWinRate">Win rate —</small></article>
      <article class="sl-metric-card"><span>Flat-$1 P/L</span><strong id="slProfit">—</strong><small>Hypothetical only</small></article>
      <article class="sl-metric-card"><span>Flat-$1 ROI</span><strong id="slRoi">—</strong><small>$1 per candidate</small></article>
      <article class="sl-metric-card"><span>Avg Probability CLV</span><strong id="slClv">—</strong><small id="slClvCoverage">Coverage —</small></article>
    </section>

    <section id="slSampleBanner" class="sl-sample-banner">
      <div><span class="status-dot"></span><strong id="slSampleLabel">Waiting for results</strong></div>
      <p id="slSampleMessage">The tracker has not settled a research candidate yet.</p>
    </section>

    <section id="slEmpty" class="sl-empty hidden">
      <div class="sl-empty-icon">◌</div>
      <h2>No settled research candidates yet</h2>
      <p>The scheduled shadow settlement runs each morning after the prior MLB slate finishes. This screen will populate automatically after the first settlement.</p>
    </section>

    <div id="slPopulated" class="hidden">
      <section class="sl-two-column">
        <article class="panel sl-panel">
          <div class="sl-panel-heading"><div><h3>CLV Health</h3><p>Latest captured pregame Pinnacle quote, not necessarily the exact closing tick.</p></div></div>
          <div class="sl-stat-grid">
            <div><span>Avg probability CLV</span><strong id="slAvgClv">—</strong></div>
            <div><span>Positive probability CLV</span><strong id="slPositiveClv">—</strong></div>
            <div><span>Avg line CLV</span><strong id="slLineClv">—</strong></div>
            <div><span>CLV coverage</span><strong id="slCoverage">—</strong></div>
            <div><span>Avg close proxy timing</span><strong id="slCloseTiming">—</strong></div>
            <div><span>Avg entry edge</span><strong id="slEntryEdge">—</strong></div>
          </div>
        </article>

        <article class="panel sl-panel">
          <div class="sl-panel-heading"><div><h3>Over vs Under</h3><p>Flat-$1 shadow performance by selected side.</p></div></div>
          <div id="slSideBreakdown" class="sl-breakdown-list"></div>
        </article>
      </section>

      <section class="panel sl-panel sl-edge-panel">
        <div class="sl-panel-heading"><div><h3>Performance by Model Edge</h3><p>These buckets remain descriptive until sample sizes are materially larger.</p></div></div>
        <div id="slEdgeBreakdown" class="sl-edge-grid"></div>
      </section>

      <section class="market-section sl-results-section">
        <div class="section-heading">
          <div><h2>Settled Research Candidates</h2><p>Entry-time model signal, official result, flat-$1 return and captured CLV proxy.</p></div>
        </div>
        <div class="sl-filter-panel">
          <div class="filter-row">
            <button class="filter-button active" type="button" data-sl-side="all">All</button>
            <button class="filter-button" type="button" data-sl-side="over">Over</button>
            <button class="filter-button" type="button" data-sl-side="under">Under</button>
            <span class="filter-divider"></span>
            <button class="edge-button active" type="button" data-sl-edge="all">All edges</button>
            <button class="edge-button" type="button" data-sl-edge="3_5">3–5 pp</button>
            <button class="edge-button" type="button" data-sl-edge="5_10">5–10 pp</button>
            <button class="edge-button" type="button" data-sl-edge="10_plus">10+ pp</button>
          </div>
          <label class="sort-control">Sort by
            <select id="slSort">
              <option value="recent">Most recent</option>
              <option value="edge">Entry edge</option>
              <option value="clv">Probability CLV</option>
              <option value="profit">$1 result</option>
            </select>
          </label>
        </div>
        <div class="desktop-table-wrap">
          <table class="market-table sl-results-table">
            <thead><tr>
              <th>Date</th><th>Pitcher</th><th>Opponent</th><th>Side</th><th>Line</th><th>Odds</th>
              <th>Proj K</th><th>Edge</th><th>Actual K</th><th>Result</th><th>$1 P/L</th><th>CLV pp</th><th>Line CLV</th>
            </tr></thead>
            <tbody id="slResultsBody"></tbody>
          </table>
        </div>
        <div id="slMobileResults" class="mobile-card-list sl-mobile-results"></div>
        <div id="slNoFiltered" class="empty-state hidden">No settled results match these filters.</div>
      </section>

      <details class="metric-guide sl-methodology">
        <summary>Shadow Lab methodology and limitations</summary>
        <div class="guide-grid">
          <div><strong>Flat-$1 P/L</strong><span>Hypothetical profit or loss assuming exactly $1 risked on every research candidate.</span></div>
          <div><strong>ROI</strong><span>Total hypothetical profit divided by the number of settled $1 entries.</span></div>
          <div><strong>Probability CLV</strong><span>Later same-line Pinnacle no-vig probability minus entry no-vig probability. Positive means the market moved toward our side.</span></div>
          <div><strong>Line CLV</strong><span>Positive means the entry strikeout threshold was better than the latest captured pregame line for that side.</span></div>
          <div><strong>Close proxy</strong><span>The latest Pinnacle quote we captured before first pitch. It is not claimed to be Pinnacle's exact closing tick.</span></div>
        </div>
      </details>
    </div>
  `;
  today.insertAdjacentElement('afterend', view);
}

function slEdgeKey(edge) {
  const n = Number(edge);
  if (n >= 10) return '10_plus';
  if (n >= 5) return '5_10';
  return '3_5';
}

function slFilteredRows() {
  let rows = [...(shadowState.data?.results || [])];
  if (shadowState.side !== 'all') rows = rows.filter((r) => String(r.side).toLowerCase() === shadowState.side);
  if (shadowState.edge !== 'all') rows = rows.filter((r) => slEdgeKey(r.entry_edge_pp) === shadowState.edge);
  const sorters = {
    recent: (a, b) => new Date(b.game_start || b.target_date) - new Date(a.game_start || a.target_date),
    edge: (a, b) => Number(b.entry_edge_pp) - Number(a.entry_edge_pp),
    clv: (a, b) => Number(b.clv_pp ?? -999) - Number(a.clv_pp ?? -999),
    profit: (a, b) => Number(b.profit ?? -999) - Number(a.profit ?? -999),
  };
  rows.sort(sorters[shadowState.sort] || sorters.recent);
  return rows;
}

function slOutcomeBadge(outcome) {
  const key = String(outcome || '').toLowerCase();
  const label = key ? key[0].toUpperCase() + key.slice(1) : 'Pending';
  return `<span class="sl-outcome ${key}">${label}</span>`;
}

function slRenderResults() {
  const rows = slFilteredRows();
  $('slResultsBody').innerHTML = rows.map((row) => `
    <tr>
      <td>${slDate(row.target_date)}</td>
      <td class="pitcher-cell">${row.pitcher_name}</td>
      <td>${row.opponent}</td>
      <td>${row.side}</td>
      <td>${Number(row.entry_line).toFixed(1)}</td>
      <td>${americanOdds(row.entry_american_odds)}</td>
      <td>${slNumber(row.projected_k, 2)}</td>
      <td class="edge-positive">${slSigned(row.entry_edge_pp, 1, ' pp')}</td>
      <td>${row.actual_k ?? '—'}</td>
      <td>${slOutcomeBadge(row.outcome)}</td>
      <td class="${Number(row.profit) >= 0 ? 'ev-positive' : 'ev-negative'}">${slMoney(row.profit)}</td>
      <td class="${Number(row.clv_pp) > 0 ? 'edge-positive' : Number(row.clv_pp) < 0 ? 'edge-negative' : ''}">${slSigned(row.clv_pp, 1, ' pp')}</td>
      <td class="${Number(row.line_clv_k) > 0 ? 'edge-positive' : Number(row.line_clv_k) < 0 ? 'edge-negative' : ''}">${slSigned(row.line_clv_k, 1, ' K')}</td>
    </tr>`).join('');

  $('slMobileResults').innerHTML = rows.map((row) => `
    <article class="mobile-market-card sl-result-card">
      <div class="mobile-card-top">
        <div class="mobile-card-title"><strong>${row.pitcher_name}</strong><span>${slDate(row.target_date)} · vs ${row.opponent}</span></div>
        ${slOutcomeBadge(row.outcome)}
      </div>
      <div class="market-line"><span>${row.side}</span><span>${Number(row.entry_line).toFixed(1)}</span><span>${americanOdds(row.entry_american_odds)}</span></div>
      <dl class="card-stats">
        <dt>Projection</dt><dd>${slNumber(row.projected_k, 2)} K</dd>
        <dt>Actual</dt><dd>${row.actual_k ?? '—'} K</dd>
        <dt>Entry edge</dt><dd class="edge-positive">${slSigned(row.entry_edge_pp, 1, ' pp')}</dd>
        <dt>$1 P/L</dt><dd class="${Number(row.profit) >= 0 ? 'ev-positive' : 'ev-negative'}">${slMoney(row.profit)}</dd>
        <dt>Probability CLV</dt><dd>${slSigned(row.clv_pp, 1, ' pp')}</dd>
        <dt>Line CLV</dt><dd>${slSigned(row.line_clv_k, 1, ' K')}</dd>
      </dl>
    </article>`).join('');
  $('slNoFiltered').classList.toggle('hidden', rows.length !== 0);
}

function slBreakdownRow(row) {
  const roiClass = Number(row.roi) >= 0 ? 'positive' : 'negative';
  return `
    <div class="sl-breakdown-row">
      <div><strong>${row.label}</strong><span>${row.n} settled · ${row.wins}-${row.losses}-${row.pushes}</span></div>
      <div><small>ROI</small><strong class="${roiClass}">${slPct(row.roi)}</strong></div>
      <div><small>Avg CLV</small><strong>${slSigned(row.avg_clv_pp, 1, ' pp')}</strong></div>
    </div>`;
}

function slRender() {
  const d = shadowState.data;
  const s = d.summary;
  const hasSettled = Number(s.n || 0) > 0;

  $('slSettled').textContent = s.n ?? 0;
  $('slPending').textContent = `${s.pending ?? 0} pending`;
  $('slRecord').textContent = `${s.wins ?? 0}-${s.losses ?? 0}-${s.pushes ?? 0}`;
  $('slWinRate').textContent = `Win rate ${slPct(s.win_rate)}`;
  $('slProfit').textContent = slMoney(s.profit);
  $('slProfit').className = Number(s.profit) >= 0 ? 'positive' : 'negative';
  $('slRoi').textContent = slPct(s.roi);
  $('slRoi').className = Number(s.roi) >= 0 ? 'positive' : 'negative';
  $('slClv').textContent = slSigned(s.avg_clv_pp, 1, ' pp');
  $('slClv').className = Number(s.avg_clv_pp) > 0 ? 'positive' : Number(s.avg_clv_pp) < 0 ? 'negative' : '';
  $('slClvCoverage').textContent = `Coverage ${slPct(s.clv_coverage)}`;

  $('slSampleLabel').textContent = s.sample_stage?.label || 'Tracking sample';
  $('slSampleMessage').textContent = s.sample_stage?.message || '';
  $('slSampleBanner').dataset.stage = s.sample_stage?.key || 'very_early';

  $('slEmpty').classList.toggle('hidden', hasSettled);
  $('slPopulated').classList.toggle('hidden', !hasSettled);
  if (!hasSettled) return;

  $('slAvgClv').textContent = slSigned(s.avg_clv_pp, 2, ' pp');
  $('slPositiveClv').textContent = slPct(s.positive_clv_pct);
  $('slLineClv').textContent = slSigned(s.avg_line_clv_k, 2, ' K');
  $('slCoverage').textContent = `${s.clv_rows}/${s.n} · ${slPct(s.clv_coverage)}`;
  $('slCloseTiming').textContent = s.avg_close_minutes_before_start == null ? '—' : `${Math.round(Number(s.avg_close_minutes_before_start))} min pregame`;
  $('slEntryEdge').textContent = slSigned(s.avg_entry_edge_pp, 1, ' pp');

  $('slSideBreakdown').innerHTML = (d.side_breakdown || []).map(slBreakdownRow).join('');
  $('slEdgeBreakdown').innerHTML = (d.edge_breakdown || []).map((row) => `
    <article class="sl-edge-card">
      <span>${row.label}</span>
      <strong>${row.n}</strong>
      <small>${row.wins}-${row.losses}-${row.pushes} · ROI ${slPct(row.roi)}</small>
      <div>Avg CLV <b>${slSigned(row.avg_clv_pp, 1, ' pp')}</b></div>
    </article>`).join('');
  slRenderResults();
}

async function slLoad(force = false) {
  if (shadowState.data && !force) return slRender();
  try {
    const response = await fetch(`${SHADOW_DATA_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Shadow snapshot returned HTTP ${response.status}`);
    shadowState.data = await response.json();
    $('shadowError').classList.add('hidden');
    slRender();
  } catch (error) {
    console.error(error);
    $('shadowError').textContent = `Unable to load Shadow Lab data: ${error.message}`;
    $('shadowError').classList.remove('hidden');
  }
}

function slSetNav(section) {
  document.querySelectorAll('.nav-item[data-section]').forEach((button) => button.classList.toggle('active', button.dataset.section === section));
  document.querySelectorAll('.mobile-bottom-nav [data-section]').forEach((button) => button.classList.toggle('active', button.dataset.section === section));
}

function slOpen() {
  shadowState.open = true;
  $('todayView').classList.add('hidden');
  $('shadowLabView').classList.remove('hidden');
  slSetNav('shadow');
  $('sidebar')?.classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'instant' });
  slLoad();
}

function slClose() {
  if (!shadowState.open) return;
  shadowState.open = false;
  $('shadowLabView').classList.add('hidden');
  $('todayView').classList.remove('hidden');
  slSetNav('today');
}

function slBind() {
  document.addEventListener('click', (event) => {
    const shadowNav = event.target.closest('[data-section="shadow"]');
    if (shadowNav) {
      event.preventDefault();
      slOpen();
      return;
    }
    const todayNav = event.target.closest('[data-section="today"]');
    if (todayNav && shadowState.open) {
      event.preventDefault();
      slClose();
      return;
    }
    const playerNav = event.target.closest('[data-section="player"]');
    if (playerNav && shadowState.open) slClose();

    const side = event.target.closest('[data-sl-side]');
    if (side) {
      shadowState.side = side.dataset.slSide;
      document.querySelectorAll('[data-sl-side]').forEach((b) => b.classList.toggle('active', b === side));
      slRenderResults();
      return;
    }
    const edge = event.target.closest('[data-sl-edge]');
    if (edge) {
      shadowState.edge = edge.dataset.slEdge;
      document.querySelectorAll('[data-sl-edge]').forEach((b) => b.classList.toggle('active', b === edge));
      slRenderResults();
    }
  });

  $('shadowReload')?.addEventListener('click', () => slLoad(true));
  $('slSort')?.addEventListener('change', (event) => {
    shadowState.sort = event.target.value;
    slRenderResults();
  });
}

function slInit() {
  slCreateView();
  slBind();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', slInit);
else slInit();
