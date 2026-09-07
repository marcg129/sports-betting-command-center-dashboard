/* Clarify the difference between the model's most likely outcome and its value signal. */

function fmModelLean(pair) {
  const sides = [pair?.over, pair?.under].filter(Boolean);
  if (!sides.length) return null;
  return [...sides].sort((a, b) => Number(b.model_probability) - Number(a.model_probability))[0];
}

function fmValueSide(pair) {
  const sides = [pair?.over, pair?.under].filter(Boolean);
  if (!sides.length) return null;
  return [...sides].sort((a, b) => {
    const edgeDiff = Number(b.edge_pp) - Number(a.edge_pp);
    if (Math.abs(edgeDiff) > 1e-9) return edgeDiff;
    return Number(b.ev) - Number(a.ev);
  })[0];
}

/* Keep existing callers working: "favored" in the first Market draft meant value side. */
fmFavored = fmValueSide;

function fmSignalText(row) {
  if (!row) return '—';
  return `${row.side} ${Number(row.line).toFixed(1)}`;
}

function fmSignalsDisagree(pair) {
  const lean = fmModelLean(pair);
  const value = fmValueSide(pair);
  return Boolean(lean && value && String(lean.side).toLowerCase() !== String(value.side).toLowerCase());
}

/* Replace the initial Market card renderer with explicit outcome/value signals. */
fmCard = function fmCardWithSignalClarity(pair) {
  const lean = fmModelLean(pair);
  const value = fmValueSide(pair);
  const gap = Number(pair.projected_k) - Number(pair.line);
  const researchCount = [pair.over, pair.under].filter((row) => row?.research_candidate).length;
  const disagree = fmSignalsDisagree(pair);
  const valueDetail = value
    ? `${fmMetric(value.edge_pp, 'edge')} · ${fmMetric(value.ev, 'ev')} EV`
    : '—';
  const leanDetail = lean
    ? `${fmMetric(lean.model_probability, 'pct')} model probability`
    : '—';

  return `
    <article class="fm-card ${disagree ? 'fm-signal-split' : ''}">
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
        <div class="fm-lean fm-signal-grid">
          <div class="fm-signal-item">
            <span>Most likely side</span>
            <strong>${fmSignalText(lean)}</strong>
            <small>${leanDetail}</small>
          </div>
          <div class="fm-signal-item value">
            <span>Value side</span>
            <strong>${fmSignalText(value)}</strong>
            <small>${valueDetail}</small>
          </div>
          ${disagree ? '<div class="fm-signal-note">Outcome lean and value side differ</div>' : ''}
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
};

function fmPatchMarketCopy() {
  const boardHeading = document.querySelector('#marketView .fm-board-section .section-heading p');
  if (boardHeading) {
    boardHeading.textContent = 'Over and Under are shown together. “Most likely side” is the higher model win probability; “Value side” is the better price-versus-model signal.';
  }

  const guide = document.querySelector('#marketView .fm-guide .guide-grid');
  if (guide) {
    guide.innerHTML = `
      <div><strong>Most likely side</strong><span>The Over or Under with the higher model win probability. This answers “which outcome is more likely?”</span></div>
      <div><strong>Value side</strong><span>The side with the larger model-vs-market edge at the listed price. It can differ from the most likely side.</span></div>
      <div><strong>Fair</strong><span>Pinnacle’s two-way implied probability after removing vig.</span></div>
      <div><strong>Research</strong><span>The side met the current model edge and EV thresholds at this captured price. It is a value signal, not necessarily the most likely outcome.</span></div>
      <div><strong>K gap</strong><span>Projected mean strikeouts minus the listed market line. The mean alone does not determine whether a sportsbook side offers value.</span></div>`;
  }
}

function fmPairForMarket(row) {
  if (!row || typeof fmPairs !== 'function') return null;
  const key = fmPairKey(row);
  return fmPairs().find((pair) => pair.key === key) || null;
}

function fmPatchTodayRows() {
  if (!state.data) return;
  const rows = typeof marketRows === 'function' ? marketRows() : [];
  const tableRows = Array.from($('marketTableBody')?.children || []);
  tableRows.forEach((tr, index) => {
    const row = rows[index];
    if (!row) return;
    const pair = fmPairForMarket(row);
    const lean = fmModelLean(pair);
    if (!lean) return;
    const sideCell = tr.children?.[6];
    if (!sideCell) return;
    sideCell.querySelector('.value-side-tag')?.remove();
    const differs = String(lean.side).toLowerCase() !== String(row.side).toLowerCase();
    if (row.research_candidate) {
      const tag = document.createElement('span');
      tag.className = `value-side-tag${differs ? ' split' : ''}`;
      tag.textContent = 'Value';
      tag.title = differs
        ? `Value side at this price. Model's more likely outcome: ${lean.side} ${Number(lean.line).toFixed(1)} (${fmMetric(lean.model_probability, 'pct')}).`
        : 'Value side at this price; it is also the model’s more likely outcome.';
      sideCell.appendChild(tag);
    }
  });
}

function fmPatchTodayCopy() {
  const subtitle = document.querySelector('#todayView .market-section .section-heading p');
  if (subtitle) {
    subtitle.textContent = 'Research candidates are value signals versus the market price, not necessarily the model’s most likely outcome. Select a pitcher for analysis.';
  }

  const summary = document.querySelector('#todayView .metric-guide summary');
  if (summary) summary.textContent = 'Metric guide: projection, outcome probability and market value are different concepts';
}

/* Add the same clarity inside Player Analysis, including when opened from Today. */
if (typeof paRender === 'function') {
  const paRenderBeforeValueClarity = paRender;
  paRender = function paRenderWithValueClarity(market) {
    paRenderBeforeValueClarity(market);
    const pair = fmPairForMarket(market);
    const lean = fmModelLean(pair);
    const value = fmValueSide(pair);
    if (!lean || !value) return;

    const marketGrid = document.querySelector('#playerAnalysisContent .pa-market-grid');
    if (!marketGrid || document.querySelector('#playerAnalysisContent .pa-value-context')) return;
    const differs = String(lean.side).toLowerCase() !== String(value.side).toLowerCase();
    const box = document.createElement('div');
    box.className = `pa-value-context${differs ? ' split' : ''}`;
    box.innerHTML = `
      <div>
        <span>Most likely outcome</span>
        <strong>${fmSignalText(lean)}</strong>
        <small>${fmMetric(lean.model_probability, 'pct')} model probability</small>
      </div>
      <div>
        <span>Best market value</span>
        <strong>${fmSignalText(value)} · ${americanOdds(value.american_odds)}</strong>
        <small>${fmMetric(value.edge_pp, 'edge')} · ${fmMetric(value.ev, 'ev')} EV</small>
      </div>
      ${differs ? '<p>The model considers the opposite side more likely to occur, but this side may still offer better value because of the sportsbook price.</p>' : ''}`;
    marketGrid.insertAdjacentElement('afterend', box);
  };
}

function fmInstallClarity() {
  fmPatchMarketCopy();
  fmPatchTodayCopy();
  fmPatchTodayRows();

  const tableBody = $('marketTableBody');
  if (tableBody) new MutationObserver(fmPatchTodayRows).observe(tableBody, { childList: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fmInstallClarity);
else fmInstallClarity();
