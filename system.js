const SYSTEM_DATA_URL = './data/system.json';

const systemViewState = {
  data: null,
  open: false,
};

function sysFmt(value, digits = 1, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(digits)}${suffix}`;
}

function sysStatusClass(value) {
  const v = String(value || 'unknown').toLowerCase();
  if (['success', 'completed', 'healthy'].includes(v)) return 'success';
  if (['failure', 'failed', 'error', 'cancelled', 'timed_out', 'attention'].includes(v)) return 'failure';
  if (['running', 'in_progress', 'queued'].includes(v)) return 'running';
  return '';
}

function sysStatusLabel(value) {
  const v = String(value || 'unknown').replaceAll('_', ' ');
  return v.replace(/\b\w/g, (c) => c.toUpperCase());
}

function sysCreateView() {
  if ($('systemView')) return;
  const today = $('todayView') || document.querySelector('.content-wrap');
  if (!today) return;
  if (!today.id) today.id = 'todayView';
  const view = document.createElement('section');
  view.id = 'systemView';
  view.className = 'content-wrap sys-view hidden';
  view.innerHTML = `
    <section class="sys-header">
      <div>
        <div class="sys-kicker">OPERATIONS · DATA HEALTH · MODEL REGISTRY</div>
        <h1>System</h1>
        <p>One place to verify that the data pipeline, model, market pricing, result settlement and dashboard publishing are healthy before trusting the board.</p>
      </div>
      <button class="ghost-button" id="sysReload" type="button">↻ Reload system</button>
    </section>

    <div id="sysError" class="error-banner hidden"></div>

    <section id="sysHealth" class="sys-health-banner">
      <div class="sys-health-title"><span class="sys-dot"></span><span id="sysHealthLabel">Checking system</span></div>
      <div id="sysHealthDetail" class="sys-health-detail">Loading operational snapshot…</div>
    </section>

    <section class="sys-metrics">
      <article class="sys-metric good"><span>ParlayAPI Credits</span><strong id="sysCredits">—</strong><small id="sysCreditsDetail">Latest collector</small></article>
      <article class="sys-metric"><span>Current Model</span><strong id="sysModelVersion">—</strong><small id="sysModelDetail">—</small></article>
      <article class="sys-metric"><span>Settled Projections</span><strong id="sysSettled">—</strong><small id="sysMae">MAE —</small></article>
      <article class="sys-metric warning"><span>Unmatched Markets</span><strong id="sysUnmatched">—</strong><small id="sysUnmatchedLive">— live pitchers unmatched</small></article>
      <article class="sys-metric"><span>Shadow Results</span><strong id="sysShadowRows">—</strong><small>Version-aware result ledger</small></article>
    </section>

    <section class="sys-grid">
      <article class="panel sys-panel">
        <div class="sys-panel-heading"><div><h3>Backend Components</h3><p>Latest database-recorded execution for each stage. A failed stage is visible here even when the Today board still has older data.</p></div></div>
        <div id="sysComponents" class="sys-component-list"></div>
      </article>

      <article class="panel sys-panel">
        <div class="sys-panel-heading"><div><h3>Model Health</h3><p>Current production model and settled projection performance.</p></div></div>
        <div class="sys-stat-grid">
          <div><span>Point model</span><strong id="sysPointModel">—</strong></div>
          <div><span>Distribution</span><strong id="sysDistribution">—</strong></div>
          <div><span>Trained through</span><strong id="sysTrainedThrough">—</strong></div>
          <div><span>RMSE</span><strong id="sysRmse">—</strong></div>
          <div><span>Bias</span><strong id="sysBias">—</strong></div>
          <div><span>Within 1 K</span><strong id="sysWithin1">—</strong></div>
        </div>
      </article>
    </section>

    <section class="sys-grid">
      <article class="panel sys-panel">
        <div class="sys-panel-heading"><div><h3>GitHub Workflow Health</h3><p>Latest Actions run for the workflows that operate the MLB K command center.</p></div></div>
        <div id="sysWorkflows" class="sys-workflow-list"></div>
        <div id="sysNoWorkflows" class="empty-state hidden">Workflow metadata was unavailable in this snapshot.</div>
      </article>

      <article class="panel sys-panel">
        <div class="sys-panel-heading"><div><h3>Data Quality</h3><p>Coverage and settlement checks from the current warehouse state.</p></div></div>
        <div class="sys-quality-grid">
          <div><span>Markets matched</span><strong id="sysMatched">—</strong></div>
          <div><span>Sides priced</span><strong id="sysSidesPriced">—</strong></div>
          <div><span>Projection ledger</span><strong id="sysProjectionRows">—</strong></div>
          <div><span>Settled coverage</span><strong id="sysSettlementPct">—</strong></div>
        </div>
      </article>
    </section>

    <section class="panel sys-panel">
      <div class="sys-panel-heading"><div><h3>Daily Automation Schedule</h3><p>Expected Eastern-time cadence. GitHub Actions schedules are best-effort, so actual starts can be delayed.</p></div></div>
      <div id="sysSchedule" class="sys-schedule"></div>
    </section>
  `;
  const anchor = $('marketView') || $('shadowLabView') || today;
  anchor.insertAdjacentElement('afterend', view);
}

function sysComponentDetail(item) {
  if (item.name === 'Odds Collector') return `${item.rows ?? 0} quotes · ${item.credits_remaining ?? '—'} credits left`;
  if (item.name === 'Live Projections') return `${item.rows ?? 0} pitchers · trained through ${item.trained_through || '—'}`;
  if (item.name === 'Market Pricing') return `${item.rows ?? 0} sides · ${item.research_candidates ?? 0} research candidates`;
  if (item.name === 'Shadow Settlement') return `${item.rows ?? 0} settled · ${item.wins ?? 0}-${item.losses ?? 0}`;
  if (item.name === 'Model Training') return `${item.selected_model || '—'} · holdout MAE ${item.holdout_mae == null ? '—' : Number(item.holdout_mae).toFixed(3)}`;
  return '';
}

function sysRenderComponents() {
  const rows = systemViewState.data?.components || [];
  $('sysComponents').innerHTML = rows.map((item) => {
    const status = String(item.status || 'unknown').toLowerCase();
    const error = item.error_message ? `<span class="sys-error-text">${item.error_message}</span>` : '';
    return `
      <div class="sys-row">
        <div class="sys-row-main"><strong>${item.name}</strong><span>${formatDateTimeET(item.finished_at || item.started_at)}</span></div>
        <span class="sys-badge ${sysStatusClass(status)}">${sysStatusLabel(status)}</span>
        <div class="sys-row-detail">${sysComponentDetail(item)}${error}</div>
      </div>`;
  }).join('');
}

function sysRenderWorkflows() {
  const rows = systemViewState.data?.workflows || [];
  $('sysWorkflows').innerHTML = rows.map((item) => {
    const effective = item.conclusion || item.status || 'unknown';
    const label = item.status === 'completed' && item.conclusion ? item.conclusion : effective;
    return `
      <div class="sys-row">
        <div class="sys-row-main"><strong>${item.name}</strong><span>Run #${item.run_number ?? '—'} · ${formatDateTimeET(item.updated_at || item.created_at)}</span></div>
        <span class="sys-badge ${sysStatusClass(label)}">${sysStatusLabel(label)}</span>
        <div class="sys-row-detail">Trigger: ${item.event || '—'}</div>
      </div>`;
  }).join('');
  $('sysNoWorkflows').classList.toggle('hidden', rows.length !== 0);
}

function sysRenderSummary() {
  const d = systemViewState.data;
  if (!d) return;
  const status = String(d.overall_status || 'healthy');
  $('sysHealth').classList.toggle('attention', status === 'attention');
  $('sysHealth').classList.toggle('running', status === 'running');
  $('sysHealthLabel').textContent = status === 'attention' ? 'System needs attention' : status === 'running' ? 'Pipeline running' : 'System healthy';
  $('sysHealthDetail').textContent = `Operational snapshot ${formatDateTimeET(d.generated_at)}`;

  const usage = d.api_usage || {};
  const model = d.model || {};
  const q = d.data_quality || {};
  $('sysCredits').textContent = usage.credits_remaining ?? '—';
  $('sysCreditsDetail').textContent = `Last request cost ${usage.last_request_cost ?? '—'} · ${formatDateTimeET(usage.last_collector_at)}`;
  $('sysModelVersion').textContent = model.model_version ? String(model.model_version).replace('_', ' ') : '—';
  $('sysModelDetail').textContent = `${model.point_model || '—'} · ${model.distribution || '—'}`;
  $('sysSettled').textContent = model.settled_projections ?? 0;
  $('sysMae').textContent = `MAE ${model.mae == null ? '—' : Number(model.mae).toFixed(3)}`;
  $('sysUnmatched').textContent = q.unmatched_market_names ?? 0;
  $('sysUnmatchedLive').textContent = `${q.unmatched_live_pitchers ?? 0} live pitchers unmatched`;
  $('sysShadowRows').textContent = q.shadow_result_rows ?? 0;

  $('sysPointModel').textContent = model.point_model || '—';
  $('sysDistribution').textContent = model.distribution || '—';
  $('sysTrainedThrough').textContent = model.trained_through || '—';
  $('sysRmse').textContent = model.rmse == null ? '—' : Number(model.rmse).toFixed(3);
  $('sysBias').textContent = model.bias == null ? '—' : `${Number(model.bias) >= 0 ? '+' : ''}${Number(model.bias).toFixed(3)}`;
  $('sysWithin1').textContent = model.within_1k_pct == null ? '—' : `${Number(model.within_1k_pct).toFixed(1)}%`;

  $('sysMatched').textContent = q.matched_markets ?? 0;
  $('sysSidesPriced').textContent = q.sides_priced ?? 0;
  $('sysProjectionRows').textContent = q.projection_result_rows ?? 0;
  $('sysSettlementPct').textContent = q.projection_settlement_pct == null ? '—' : `${Number(q.projection_settlement_pct).toFixed(1)}%`;
}

function sysRenderSchedule() {
  $('sysSchedule').innerHTML = (systemViewState.data?.schedule || []).map((item) => `
    <div class="sys-schedule-item"><time>${item.time_et}</time><strong>${item.name}</strong><span>${item.purpose}</span></div>`).join('');
}

function sysRender() {
  if (!systemViewState.data) return;
  sysRenderSummary();
  sysRenderComponents();
  sysRenderWorkflows();
  sysRenderSchedule();
}

function sysSetNav(section) {
  document.querySelectorAll('.nav-item[data-section]').forEach((button) => button.classList.toggle('active', button.dataset.section === section));
  document.querySelectorAll('.mobile-bottom-nav [data-section]').forEach((button) => button.classList.toggle('active', button.dataset.section === section));
}

function sysSetHeader() {
  if (!systemViewState.open) return;
  const d = systemViewState.data;
  const status = d?.overall_status || 'running';
  const label = status === 'attention' ? 'System Attention' : status === 'healthy' ? 'System Healthy' : 'System Checking';
  [$('systemState'), $('topSystemState')].forEach((el) => {
    if (!el) return;
    el.classList.remove('stale', 'error');
    if (status === 'attention') el.classList.add('error');
    el.innerHTML = `<span class="status-dot"></span>${label}`;
  });
  const sideLabel = $('sidebarUpdated')?.previousElementSibling;
  if (sideLabel?.classList.contains('meta-label')) sideLabel.textContent = 'System Snapshot';
  $('sidebarUpdated').textContent = d ? formatDateTimeET(d.generated_at) : 'Loading…';
  $('topUpdated').textContent = d ? `Health ${formatDateTimeET(d.generated_at)}` : 'Loading health…';
  $('dateChip').textContent = 'System Health';
}

function sysOpen() {
  systemViewState.open = true;
  try { if (typeof shadowState !== 'undefined') shadowState.open = false; } catch (_e) {}
  try { if (typeof fullMarketState !== 'undefined') fullMarketState.open = false; } catch (_e) {}
  $('todayView')?.classList.add('hidden');
  $('shadowLabView')?.classList.add('hidden');
  $('marketView')?.classList.add('hidden');
  $('systemView')?.classList.remove('hidden');
  sysSetNav('system');
  $('sidebar')?.classList.remove('open');
  sysRender();
  sysSetHeader();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function sysClose(destination = 'today') {
  if (!systemViewState.open) return;
  systemViewState.open = false;
  $('systemView')?.classList.add('hidden');
  if (destination === 'today') {
    $('todayView')?.classList.remove('hidden');
    sysSetNav('today');
    if (state.data) renderSummary();
  } else if (destination === 'shadow' && typeof slOpen === 'function') {
    slOpen();
  } else if (destination === 'market' && typeof fmOpen === 'function') {
    fmOpen();
  } else if (destination === 'player') {
    $('todayView')?.classList.remove('hidden');
    sysSetNav('player');
    const row = state.data?.markets?.[0];
    if (row && typeof paOpen === 'function') paOpen(row);
  }
}

async function sysLoadData() {
  try {
    const response = await fetch(`${SYSTEM_DATA_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`System snapshot returned HTTP ${response.status}`);
    systemViewState.data = await response.json();
    sysRender();
    if (systemViewState.open) sysSetHeader();
  } catch (error) {
    console.error(error);
    if ($('sysError')) {
      $('sysError').textContent = `Unable to load system health: ${error.message}`;
      $('sysError').classList.remove('hidden');
    }
  }
}

function sysBind() {
  document.addEventListener('click', (event) => {
    const systemNav = event.target.closest('[data-section="system"]');
    if (systemNav) {
      event.preventDefault();
      sysOpen();
      return;
    }
    if (!systemViewState.open) return;
    const section = event.target.closest('[data-section]')?.dataset.section;
    if (['today', 'shadow', 'market', 'player'].includes(section)) {
      event.preventDefault();
      sysClose(section);
    }
  });
  $('sysReload')?.addEventListener('click', sysLoadData);
}

function sysInit() {
  sysCreateView();
  sysBind();
  sysLoadData();
}

if (typeof setSystemState === 'function') {
  const baseSetSystemState = setSystemState;
  setSystemState = function systemAwareSetState() {
    if (systemViewState.open) return sysSetHeader();
    return baseSetSystemState();
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sysInit);
else sysInit();
