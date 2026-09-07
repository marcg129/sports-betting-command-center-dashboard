const fullMarketState = {
  search: '',
  status: 'all',
  sort: 'edge',
  open: false,
};

function fmPairKey(row) {
  return `${row.analysis_key || `${row.game_pk}:${row.pitcher_id}`}|${String(row.sportsbook || '').toLowerCase()}|${Number(row.line).toFixed(1)}`;
}

function fmPairs() {
  const grouped = new Map();
  for (const row of state.data?.markets || []) {
    const key = fmPairKey(row);
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        analysis_key: row.analysis_key,
        game_pk: row.game_pk,
        pitcher_id: row.pitcher_id,
        pitcher_name: row.pitcher_name,
        team: row.team,
        team_abbr: row.team_abbr,
        opponent: row.opponent,
        opponent_abbr: row.opponent_abbr,
        throwing_hand: row.throwing_hand,
        game_datetime: row.game_datetime,
        projected_k: row.projected_k,
        sportsbook: row.sportsbook,
        line: Number(row.line),
        over: null,
        under: null,
      });
    }
    const pair = grouped.get(key);
    if (String(row.side).toLowerCase() === 'over') pair.over = row;
    if (String(row.side).toLowerCase() === 'under') pair.under = row;
  }
  return [...grouped.values()];
}

function fmFavored(pair) {
  const sides = [pair.over, pair.under].filter(Boolean);
  if (!sides.length) return null;
  return sides.sort((a, b) => Number(b.edge_pp) - Number(a.edge_pp))[0];
}

function fmPairHasResearch(pair) {
  return Boolean(pair.over?.research_candidate || pair.under?.research_candidate);
}

function fmFilteredPairs() {
  let rows = fmPairs();
  const q = fullMarketState.search.trim().toLowerCase();
  if (q) {
    rows = rows.filter((pair) => [pair.pitcher_name, pair.team, pair.team_abbr, pair.opponent, pair.opponent_abbr]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q)));
  }
  if (fullMarketState.status === 'research') rows = rows.filter(fmPairHasResearch);
  if (fullMarketState.status === 'monitor') rows = rows.filter((pair) => !fmPairHasResearch(pair));

  const sorters = {
    edge: (a, b) => Math.max(Number(b.over?.edge_pp ?? -999), Number(b.under?.edge_pp ?? -999)) - Math.max(Number(a.over?.edge_pp ?? -999), Number(a.under?.edge_pp ?? -999)),
    game: (a, b) => (parseDate(a.game_datetime)?.getTime() || 0) - (parseDate(b.game_datetime)?.getTime() || 0),
    pitcher: (a, b) => a.pitcher_name.localeCompare(b.pitcher_name),
    gap: (a, b) => Math.abs(Number(b.projected_k) - Number(b.line)) - Math.abs(Number(a.projected_k) - Number(a.line)),
  };
  rows.sort(sorters[fullMarketState.sort] || sorters.edge);
  return rows;
}

function fmMetric(value, type) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  if (type === 'pct') return `${(Number(value) * 100).toFixed(1)}%`;
  if (type === 'edge') return `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(1)} pp`;
  if (type === 'ev') return `${Number(value) >= 0 ? '+' : ''}${(Number(value) * 100).toFixed(1)}%`;
  return Number(value).toFixed(1);
}

function fmSidePanel(row, label) {
  if (!row) {
    return `<div class="fm-side missing"><div class="fm-side-head"><strong>${label}</strong><span>No price</span></div></div>`;
  }
  const edge = Number(row.edge_pp);
  const edgeClass = edge > 0 ? 'positive' : edge < 0 ? 'negative' : '';
  const research = row.research_candidate;
  return `
    <button class="fm-side ${research ? 'research' : ''}" type="button" data-fm-analysis-key="${row.analysis_key}" data-fm-side="${row.side}">
      <div class="fm-side-head">
        <strong>${row.side} ${Number(row.line).toFixed(1)}</strong>
        <span class="fm-price">${americanOdds(row.american_odds)}</span>
      </div>
      <div class="fm-side-stats">
        <div><span>Model</span><b>${fmMetric(row.model_probability, 'pct')}</b></div>
        <div><span>Fair</span><b>${fmMetric(row.market_fair_probability, 'pct')}</b></div>
        <div><span>Edge</span><b class="${edgeClass}">${fmMetric(row.edge_pp, 'edge')}</b></div>
        <div><span>EV</span><b class="${Number(row.ev) >= 0 ? 'positive' : 'negative'}">${fmMetric(row.ev, 'ev')}</b></div>
      </div>
      <span class="fm-side-status ${research ? 'research' : ''}">${research ? 'Research' : 'Monitor'}</span>
    </button>`;
}

function fmCard(pair) {
  const favored = fmFavored(pair);
  const gap = Number(pair.projected_k) - Number(pair.line);
  const researchCount = [pair.over, pair.under].filter((row) => row?.research_candidate).length;
  return `
    <article class="fm-card">
      <div class="fm-card-main">
        <div class="fm-game-time">${formatTimeET(pair.game_datetime)}</div>
        <div class="fm-player">
          <div><span class="team-pill">${pair.team_abbr}</span><strong>${pair.pitcher_name}</strong></div>
          <span>vs <span class="team-pill">${pair.opponent_abbr}</span>${pair.opponent}</span>
        </div>
        <div class="fm-projection">
          <span>Proj K</span><strong>${Number(pair.projected_k).toFixed(2)}</strong>
          <small>Market line ${Number(pair.line).toFixed(1)} · ${gap >= 0 ? '+' : ''}${gap.toFixed(2)} K gap</small>
        </div>
        <div class="fm-lean">
          <span>Model lean</span>
          <strong>${favored ? `${favored.side} ${Number(favored.line).toFixed(1)}` : '—'}</strong>
          <small>${favored ? fmMetric(favored.edge_pp, 'edge') : ''}</small>
        </div>
        <div class="fm-pair-status">
          <span class="status-badge ${researchCount ? 'research' : ''}">${researchCount ? `${researchCount} Research` : 'Monitor'}</span>
          <button type="button" class="fm-analysis-button" data-fm-open-pair="${pair.key}">Analysis</button>
        </div>
      </div>
      <div class="fm-sides">
        ${fmSidePanel(pair.over, 'Over')}
        ${fmSidePanel(pair.under, 'Under')}
      </div>
    </article>`;
}

function fmIssueRows() {
  return (state.data?.issues || []).filter((issue) => issue.issue_type !== 'live_pitcher_without_fresh_market');
}

function fmCreateView() {
  const today = $('todayView') || document.querySelector('.content-wrap');
  if (!today || $('marketView')) return;
  if (!today.id) today.id = 'todayView';

  const view = document.createElement('section');
  view.id = 'marketView';
  view.className = 'content-wrap fm-view hidden';
  view.innerHTML = `
    <section class="fm-header">
      <div>
        <div class="fm-kicker">FULL MARKET · PRICE DISCOVERY</div>
        <h1>Market</h1>
        <p>Every priced Pinnacle pitcher-strikeout market in today’s snapshot. Research status is context, not a requirement to appear here.</p>
      </div>
      <button class="ghost-button" id="fmReload" type="button">↻ Reload market</button>
    </section>

    <section class="fm-metrics">
      <article><span>Two-Sided Markets</span><strong id="fmPairCount">—</strong><small id="fmSideCount">— priced sides</small></article>
      <article><span>Research Markets</span><strong id="fmResearchPairs">—</strong><small>At least one side clears threshold</small></article>
      <article><span>Largest Model Edge</span><strong id="fmLargestEdge">—</strong><small id="fmLargestEdgePlayer">—</small></article>
      <article class="warning"><span>Market Match Issues</span><strong id="fmIssueCount">—</strong><small>Displayed below; never force-matched</small></article>
      <article><span>Latest Pinnacle Quote</span><strong id="fmFreshness">—</strong><small id="fmFreshnessDetail">—</small></article>
    </section>

    <section class="fm-controls">
      <label class="fm-search">Search market
        <input id="fmSearch" type="search" placeholder="Pitcher, team, opponent…" autocomplete="off">
      </label>
      <div class="fm-status-filters" role="group" aria-label="Market status">
        <button class="filter-button active" type="button" data-fm-status="all">All markets</button>
        <button class="filter-button" type="button" data-fm-status="research">Research</button>
        <button class="filter-button" type="button" data-fm-status="monitor">Monitor only</button>
      </div>
      <label class="sort-control">Sort by
        <select id="fmSort">
          <option value="edge">Largest model edge</option>
          <option value="game">Game time</option>
          <option value="pitcher">Pitcher name</option>
          <option value="gap">Projection vs line gap</option>
        </select>
      </label>
    </section>

    <section class="fm-board-section">
      <div class="section-heading">
        <div><h2>Two-Sided Pitcher-K Board</h2><p>Over and Under are shown together so you can see the full market rather than only the side the model prefers.</p></div>
        <div id="fmVisibleCount" class="fm-visible-count">—</div>
      </div>
      <div id="fmBoard" class="fm-board"></div>
      <div id="fmEmpty" class="empty-state hidden">No markets match these filters.</div>
    </section>

    <section class="panel fm-coverage-panel">
      <div class="fm-panel-heading">
        <div><h3>Market Coverage & Match Issues</h3><p>Fresh sportsbook names that could not be safely matched to one uniquely scored probable starter stay out of pricing.</p></div>
      </div>
      <div class="fm-coverage-stats">
        <div><span>Quotes considered</span><strong id="fmQuotes">—</strong></div>
        <div><span>Two-sided quote pairs</span><strong id="fmQuotePairs">—</strong></div>
        <div><span>Pitchers priced</span><strong id="fmPriced">—</strong></div>
        <div><span>Unmatched live pitchers</span><strong id="fmUnmatchedLive">—</strong></div>
      </div>
      <div id="fmIssues" class="fm-issue-list"></div>
      <div id="fmNoIssues" class="fm-no-issues hidden">No market-name matching issues in this snapshot.</div>
    </section>

    <details class="metric-guide fm-guide">
      <summary>How to read the full market board</summary>
      <div class="guide-grid">
        <div><strong>Model lean</strong><span>The side with the larger model-vs-market probability difference. It is not automatically a research candidate.</span></div>
        <div><strong>Fair</strong><span>Pinnacle’s two-way implied probability after removing vig.</span></div>
        <div><strong>Research</strong><span>The side met the current model edge and EV thresholds at this captured price.</span></div>
        <div><strong>Monitor</strong><span>The market was priced successfully but did not meet the current research threshold.</span></div>
        <div><strong>K gap</strong><span>Projected mean strikeouts minus the listed market line. Probability and EV remain the primary comparisons.</span></div>
      </div>
    </details>
  `;
  const anchor = $('shadowLabView') || today;
  anchor.insertAdjacentElement('afterend', view);
}

function fmRenderSummary() {
  const pairs = fmPairs();
  const researchPairs = pairs.filter(fmPairHasResearch);
  const allSides = state.data?.markets || [];
  const best = allSides.length ? [...allSides].sort((a, b) => Number(b.edge_pp) - Number(a.edge_pp))[0] : null;
  const freshness = freshnessInfo();
  const s = state.data?.summary || {};

  $('fmPairCount').textContent = pairs.length;
  $('fmSideCount').textContent = `${allSides.length} priced sides`;
  $('fmResearchPairs').textContent = researchPairs.length;
  $('fmLargestEdge').textContent = best ? fmMetric(best.edge_pp, 'edge') : '—';
  $('fmLargestEdgePlayer').textContent = best ? `${best.pitcher_name} ${best.side} ${Number(best.line).toFixed(1)}` : '—';
  $('fmIssueCount').textContent = fmIssueRows().length;
  $('fmFreshness').textContent = freshness.label;
  $('fmFreshnessDetail').textContent = freshness.detail;
  $('fmQuotes').textContent = s.quotes_considered ?? '—';
  $('fmQuotePairs').textContent = s.quote_pairs_found ?? '—';
  $('fmPriced').textContent = s.pitchers_priced ?? '—';
  $('fmUnmatchedLive').textContent = s.unmatched_live_pitchers ?? '—';
}

function fmRenderIssues() {
  const issues = fmIssueRows();
  $('fmIssues').innerHTML = issues.map((issue) => `
    <div class="fm-issue-row">
      <div><strong>${issue.player_name || 'Unnamed market'}</strong><span>${issue.sportsbook || 'Market'}${issue.line == null ? '' : ` · ${Number(issue.line).toFixed(1)} K`}</span></div>
      <div><span>${String(issue.issue_type || '').replaceAll('_', ' ')}</span><p>${issue.detail}</p></div>
    </div>`).join('');
  $('fmNoIssues').classList.toggle('hidden', issues.length !== 0);
}

function fmRenderBoard() {
  const pairs = fmFilteredPairs();
  $('fmBoard').innerHTML = pairs.map(fmCard).join('');
  $('fmVisibleCount').textContent = `${pairs.length} of ${fmPairs().length} markets`;
  $('fmEmpty').classList.toggle('hidden', pairs.length !== 0);
}

function fmRender() {
  if (!state.data) return;
  fmRenderSummary();
  fmRenderBoard();
  fmRenderIssues();
}

function fmSetNav(section) {
  document.querySelectorAll('.nav-item[data-section]').forEach((button) => button.classList.toggle('active', button.dataset.section === section));
  document.querySelectorAll('.mobile-bottom-nav [data-section]').forEach((button) => button.classList.toggle('active', button.dataset.section === section));
}

function fmOpen() {
  fullMarketState.open = true;
  if (typeof slClose === 'function' && typeof shadowState !== 'undefined' && shadowState.open) slClose();
  $('todayView')?.classList.add('hidden');
  $('shadowLabView')?.classList.add('hidden');
  $('marketView')?.classList.remove('hidden');
  fmSetNav('market');
  $('sidebar')?.classList.remove('open');
  if (state.data) {
    renderSummary();
    fmRender();
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function fmClose(destination = 'today') {
  if (!fullMarketState.open) return;
  fullMarketState.open = false;
  $('marketView')?.classList.add('hidden');
  if (destination === 'today') $('todayView')?.classList.remove('hidden');
  fmSetNav(destination);
}

function fmFindRow(analysisKey, side) {
  return (state.data?.markets || []).find((row) => row.analysis_key === analysisKey && String(row.side).toLowerCase() === String(side).toLowerCase()) || null;
}

function fmFindPair(key) {
  return fmPairs().find((pair) => pair.key === key) || null;
}

function fmOpenAnalysis(row) {
  if (!row || typeof paOpen !== 'function') return;
  paOpen(row);
}

function fmBind() {
  document.addEventListener('click', (event) => {
    const analysisClose = event.target.closest('[data-close-analysis]') || event.target === $('analysisBackdrop');
    if (analysisClose && fullMarketState.open) queueMicrotask(() => fmSetNav('market'));

    const marketNav = event.target.closest('[data-section="market"]');
    if (marketNav) {
      event.preventDefault();
      fmOpen();
      return;
    }

    const todayNav = event.target.closest('[data-section="today"]');
    if (todayNav && fullMarketState.open) {
      event.preventDefault();
      fmClose('today');
      if (state.data) renderSummary();
      return;
    }

    const shadowNav = event.target.closest('[data-section="shadow"]');
    if (shadowNav && fullMarketState.open) {
      event.preventDefault();
      fullMarketState.open = false;
      $('marketView')?.classList.add('hidden');
      if (typeof slOpen === 'function') slOpen();
      else $('todayView')?.classList.remove('hidden');
      return;
    }

    const playerNav = event.target.closest('[data-section="player"]');
    if (playerNav && fullMarketState.open) {
      const pair = fmFilteredPairs()[0] || fmPairs()[0];
      const row = pair ? fmFavored(pair) : null;
      if (row) {
        event.preventDefault();
        fmOpenAnalysis(row);
      }
      return;
    }

    const side = event.target.closest('[data-fm-analysis-key][data-fm-side]');
    if (side) {
      event.preventDefault();
      fmOpenAnalysis(fmFindRow(side.dataset.fmAnalysisKey, side.dataset.fmSide));
      return;
    }

    const pairButton = event.target.closest('[data-fm-open-pair]');
    if (pairButton) {
      event.preventDefault();
      const pair = fmFindPair(pairButton.dataset.fmOpenPair);
      fmOpenAnalysis(pair ? fmFavored(pair) : null);
      return;
    }

    const status = event.target.closest('[data-fm-status]');
    if (status) {
      fullMarketState.status = status.dataset.fmStatus;
      document.querySelectorAll('[data-fm-status]').forEach((button) => button.classList.toggle('active', button === status));
      fmRenderBoard();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && fullMarketState.open) queueMicrotask(() => fmSetNav('market'));
  });

  $('fmSearch')?.addEventListener('input', (event) => {
    fullMarketState.search = event.target.value;
    fmRenderBoard();
  });
  $('fmSort')?.addEventListener('change', (event) => {
    fullMarketState.sort = event.target.value;
    fmRenderBoard();
  });
  $('fmReload')?.addEventListener('click', () => window.location.reload());
}

function fmInit() {
  fmCreateView();
  fmBind();
  if (state.data) fmRender();
  const board = $('marketTableBody');
  if (board) {
    new MutationObserver(() => {
      if (fullMarketState.open && state.data) fmRender();
    }).observe(board, { childList: true });
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fmInit);
else fmInit();
