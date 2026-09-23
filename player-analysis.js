const playerAnalysisState = {
  market: null,
};

function paNumber(value, digits = 1, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(digits)}${suffix}`;
}

function paPercent(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

function paSigned(value, digits = 1, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}${suffix}`;
}

function paPlayerKey(market) {
  return market?.analysis_key || `${market?.game_pk}:${market?.pitcher_id}`;
}

function paFindPlayer(market) {
  const key = paPlayerKey(market);
  return (state.data?.players || []).find((player) => player.analysis_key === key) || null;
}

function paRateTile(label, value, hint = '') {
  return `
    <div class="pa-stat">
      <span>${label}</span>
      <strong>${paPercent(value)}</strong>
      ${hint ? `<small>${hint}</small>` : ''}
    </div>`;
}

function paNumberTile(label, value, digits = 1, suffix = '', hint = '') {
  return `
    <div class="pa-stat">
      <span>${label}</span>
      <strong>${paNumber(value, digits, suffix)}</strong>
      ${hint ? `<small>${hint}</small>` : ''}
    </div>`;
}

function paRecentStarts(player) {
  const starts = player?.recent_starts || [];
  if (!starts.length) {
    return `<div class="pa-empty">Recent-start history is not available in this snapshot.</div>`;
  }
  return `
    <div class="pa-recent-table-wrap">
      <table class="pa-recent-table">
        <thead>
          <tr><th>Date</th><th>Opponent</th><th>K</th><th>Pitches</th><th>BF</th></tr>
        </thead>
        <tbody>
          ${starts.map((start) => `
            <tr>
              <td>${formatDate(start.game_date).replace(/,\s\d{4}$/, '')}</td>
              <td>${start.opponent_abbr || start.opponent || '—'}</td>
              <td><strong>${start.strikeouts ?? '—'}</strong></td>
              <td>${start.pitches ?? '—'}</td>
              <td>${start.batters_faced ?? '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function paProbabilityBars(market) {
  const model = Math.max(0, Math.min(100, Number(market.model_probability || 0) * 100));
  const fair = Math.max(0, Math.min(100, Number(market.market_fair_probability || 0) * 100));
  return `
    <div class="pa-probability">
      <div class="pa-prob-row">
        <div><span>Model</span><strong>${model.toFixed(1)}%</strong></div>
        <div class="pa-prob-track"><i class="model" style="width:${model}%"></i></div>
      </div>
      <div class="pa-prob-row">
        <div><span>Pinnacle fair</span><strong>${fair.toFixed(1)}%</strong></div>
        <div class="pa-prob-track"><i class="market" style="width:${fair}%"></i></div>
      </div>
    </div>`;
}

function paEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function paSafeUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function paContextStatusLabel(status) {
  const labels = {
    clear: 'CLEAR',
    watch: 'WATCH',
    material: 'MATERIAL',
    numeric_limit: 'NUMERIC LIMIT',
  };
  return labels[status] || 'UNAVAILABLE';
}

function paContextGapText(ratio) {
  if (ratio === null || ratio === undefined || Number.isNaN(Number(ratio))) return '—';
  const delta = (Number(ratio) - 1) * 100;
  if (Math.abs(delta) < 0.5) return '≈ normal opportunity';
  return `${Math.abs(delta).toFixed(0)}% ${delta < 0 ? 'less' : 'more'} opportunity`;
}

function paContextSignalList(signals) {
  if (!signals?.length) {
    return `<div class="pa-context-empty">No structured pregame workload signal is stored for this pitcher/game.</div>`;
  }
  return `
    <div class="pa-context-signals">
      ${signals.map((signal) => {
        const safeUrl = paSafeUrl(signal.source_url);
        const source = signal.source_name
          ? (safeUrl
            ? `<a href="${paEscape(safeUrl)}" target="_blank" rel="noopener noreferrer">${paEscape(signal.source_name)} ↗</a>`
            : `<span>${paEscape(signal.source_name)}</span>`)
          : '';
        return `
          <div class="pa-context-signal">
            <div>
              <span class="pa-context-signal-type">${paEscape(String(signal.signal_type || '').replaceAll('_', ' '))}</span>
              <span class="pa-context-signal-severity">${paEscape(signal.severity || 'watch')}</span>
            </div>
            <p>${paEscape(signal.evidence_summary || 'Structured context signal')}</p>
            ${source ? `<small>${source}</small>` : ''}
          </div>`;
      }).join('')}
    </div>`;
}

function paContextSection(market) {
  const context = market?.context;
  if (!context) {
    return `
      <section class="pa-section pa-context">
        <div class="pa-section-heading">
          <div>
            <h3>Pregame Context</h3>
            <p>Workload diagnostics are unavailable in this snapshot.</p>
          </div>
        </div>
      </section>`;
  }

  const baseline = context.baseline_opportunity || {};
  const ratio = context.market_implied_opportunity_ratio;
  const status = context.status || 'clear';
  const adjusted = context.context_adjusted_mean;
  const explicit = context.explicit_workload;
  const selectedSide = String(market.side || 'Over');
  const scenarioRows = (context.scenarios || []).map((scenario) => {
    const over = Number(scenario.over_probability);
    const sideProb = selectedSide.toLowerCase() === 'under' ? 1 - over : over;
    return `
      <tr>
        <td>${Math.round(Number(scenario.workload_ratio) * 100)}%</td>
        <td>${paNumber(scenario.expected_bf, 1)}</td>
        <td>${paNumber(scenario.projected_mean, 2)}</td>
        <td>${paPercent(sideProb, 1)}</td>
      </tr>`;
  }).join('');

  const adjustedCard = adjusted === null || adjusted === undefined ? '' : `
    <div class="pa-context-adjusted">
      <div>
        <span>Context-adjusted projection</span>
        <strong>${paNumber(adjusted, 2)} K</strong>
      </div>
      <div>
        <span>${selectedSide} ${Number(market.line).toFixed(1)}</span>
        <strong>${paPercent(context.context_adjusted_side_probability)}</strong>
      </div>
      <p>
        Based only on explicit quantitative workload evidence
        ${explicit?.expected_pitches ? `· ~${paNumber(explicit.expected_pitches, 0)} pitches` : ''}
        ${explicit?.expected_bf ? `· ~${paNumber(explicit.expected_bf, 1)} BF` : ''}.
      </p>
    </div>`;

  return `
    <section class="pa-section pa-context">
      <div class="pa-section-heading pa-context-heading">
        <div>
          <h3>Pregame Context</h3>
          <p>Opportunity diagnostics layered on top of the unchanged base MLB K model.</p>
        </div>
        <span class="pa-context-status ${status}">${paContextStatusLabel(status)}</span>
      </div>

      <div class="pa-context-metrics">
        <div>
          <span>Base model K</span>
          <strong>${paNumber(context.base_projected_mean, 2)}</strong>
        </div>
        <div>
          <span>Market-implied K</span>
          <strong>${paNumber(context.market_implied_mean, 2)}</strong>
          <small>Probability-equivalent mean</small>
        </div>
        <div>
          <span>Opportunity gap</span>
          <strong>${paContextGapText(ratio)}</strong>
          <small>Skill held constant</small>
        </div>
        <div>
          <span>Baseline BF</span>
          <strong>${paNumber(baseline.baseline_bf, 1)}</strong>
          <small>Recent workload estimate</small>
        </div>
      </div>

      ${adjustedCard}

      <div class="pa-context-subhead">
        <strong>Context evidence</strong>
        <span>Auditable signals only</span>
      </div>
      ${paContextSignalList(context.signals || [])}

      <div class="pa-context-subhead">
        <strong>Workload scenarios</strong>
        <span>What the selected side looks like if opportunity changes</span>
      </div>
      <div class="pa-scenario-wrap">
        <table class="pa-scenario-table">
          <thead>
            <tr><th>Workload</th><th>BF</th><th>Proj K</th><th>${paEscape(selectedSide)} Prob.</th></tr>
          </thead>
          <tbody>${scenarioRows}</tbody>
        </table>
      </div>

      <div class="pa-context-guardrail">
        <strong>Guardrail:</strong> qualitative context flags risk and scenarios only. It does not change the central projection.
        A context-adjusted projection appears only when explicit expected pitch-count or batters-faced evidence is stored.
      </div>
    </section>`;
}

function paRender(market) {
  const player = paFindPlayer(market);
  const f = player?.features || {};
  const detail = player || market;
  const handText = detail.throwing_hand ? `${detail.throwing_hand}HP` : 'Pitcher';
  const venue = player?.venue_name || 'Venue unavailable';
  const edgeClass = Number(market.edge_pp) >= 0 ? 'positive' : 'negative';
  const evClass = Number(market.ev) >= 0 ? 'positive' : 'negative';

  const missingDetail = !player ? `
    <div class="pa-warning">
      Detailed pregame feature context is unavailable in this snapshot. Market and projection values are still shown below.
    </div>` : '';

  $('playerAnalysisContent').innerHTML = `
    <div class="pa-hero">
      <div>
        <div class="pa-kicker">PLAYER ANALYSIS · PRE-GAME</div>
        <h2>${market.pitcher_name}</h2>
        <p>
          <span class="team-pill">${market.team_abbr}</span>${market.team}
          <span class="pa-separator">vs</span>
          <span class="team-pill">${market.opponent_abbr}</span>${market.opponent}
        </p>
        <div class="pa-meta">${formatTimeET(market.game_datetime)} · ${handText} · ${venue}</div>
      </div>
      <span class="status-badge ${market.research_candidate ? 'research' : ''}">
        ${market.research_candidate ? 'Research Candidate' : 'Monitor'}
      </span>
    </div>

    ${missingDetail}

    <section class="pa-section">
      <div class="pa-section-heading">
        <div>
          <h3>Model vs Market</h3>
          <p>The selected sportsbook side from the Today board.</p>
        </div>
      </div>
      <div class="pa-market-grid">
        <div class="pa-market-main">
          <span>${market.side} ${Number(market.line).toFixed(1)}</span>
          <strong>${americanOdds(market.american_odds)}</strong>
          <small>${market.sportsbook}</small>
        </div>
        <div class="pa-market-metric">
          <span>Proj K</span><strong>${Number(market.projected_k).toFixed(2)}</strong>
        </div>
        <div class="pa-market-metric ${edgeClass}">
          <span>Edge</span><strong>${paSigned(market.edge_pp, 1, ' pp')}</strong>
        </div>
        <div class="pa-market-metric ${evClass}">
          <span>Est. EV</span><strong>${paSigned(Number(market.ev) * 100, 1, '%')}</strong>
        </div>
      </div>
      ${paProbabilityBars(market)}
    </section>

    ${paContextSection(market)}

    <section class="pa-section">
      <div class="pa-section-heading">
        <div>
          <h3>Recent Starts</h3>
          <p>Official MLB results before today’s scheduled start.</p>
        </div>
      </div>
      ${paRecentStarts(player)}
    </section>

    <section class="pa-section">
      <div class="pa-section-heading">
        <div>
          <h3>Pitcher Form</h3>
          <p>Curated pregame model inputs — not feature-importance scores.</p>
        </div>
      </div>
      <div class="pa-stat-grid">
        ${paNumberTile('Avg K · L3', f.avg_k_l3, 2)}
        ${paNumberTile('Avg K · L5', f.avg_k_l5, 2)}
        ${paNumberTile('Avg K · L10', f.avg_k_l10, 2)}
        ${paRateTile('K / BF · L5', f.k_per_bf_l5)}
        ${paRateTile('SwStr% · L5', f.swstr_l5, 'Swinging strikes / pitches')}
        ${paRateTile('CSW% · L5', f.csw_l5, 'Called + swinging strikes / pitches')}
        ${paRateTile('Whiff% · L5', f.whiff_l5, 'Whiffs / swings')}
        ${paNumberTile('Avg Pitches · L5', f.avg_pitches_l5, 1)}
        ${paNumberTile('Avg BF · L5', f.avg_bf_l5, 1)}
      </div>
    </section>

    <section class="pa-section">
      <div class="pa-section-heading">
        <div>
          <h3>Workload & Velocity</h3>
          <p>Rest, previous-start workload, and recent velocity context.</p>
        </div>
      </div>
      <div class="pa-stat-grid compact">
        ${paNumberTile('Rest Days', f.rest_days, 0)}
        ${paNumberTile('Last Start K', f.prior_start_strikeouts, 0)}
        ${paNumberTile('Last Start Pitches', f.prior_start_pitches, 0)}
        ${paNumberTile('Last Start BF', f.prior_start_batters_faced, 0)}
        ${paNumberTile('Velocity · L3', f.velo_l3, 1, ' mph')}
        ${paNumberTile('Season Velo', f.season_velo_prior, 1, ' mph')}
        ${paNumberTile('Velo Δ', f.velo_delta_l3_vs_season, 2, ' mph')}
      </div>
    </section>

    <section class="pa-section">
      <div class="pa-section-heading">
        <div>
          <h3>Opponent Strikeout Context</h3>
          <p>${market.opponent} offense before this matchup.</p>
        </div>
      </div>
      <div class="pa-stat-grid">
        ${paRateTile('Season K%', f.opponent_k_rate_season_prior)}
        ${paRateTile('K% · Last 14d', f.opponent_k_rate_l14d)}
        ${paRateTile('K% · Last 30d', f.opponent_k_rate_l30d)}
        ${paRateTile(`K% vs ${market.throwing_hand || 'Hand'}`, f.opponent_k_rate_vs_hand_season_prior, 'Season prior')}
        ${paRateTile(`K% vs ${market.throwing_hand || 'Hand'} · 30d`, f.opponent_k_rate_vs_hand_l30d)}
        ${paRateTile('Whiff% · 14d', f.opponent_whiff_rate_l14d)}
        ${paRateTile('Contact% · 14d', f.opponent_contact_rate_l14d)}
      </div>
    </section>

    <div class="pa-footnote">
      <strong>How to read this:</strong> the base MLB_K_v0.1 projection remains separate from the Pregame Context layer.
      Context can explain opportunity risk and show scenarios, but qualitative context does not rewrite the model.
      These values do not prove that the listed edge is a profitable wager; shadow results and CLV remain the validation layer.
    </div>
  `;
}

function paOpen(market) {
  if (!market) return;
  playerAnalysisState.market = market;
  paRender(market);
  $('playerAnalysisDrawer').classList.add('open');
  $('analysisBackdrop').classList.add('open');
  $('playerAnalysisDrawer').setAttribute('aria-hidden', 'false');
  document.body.classList.add('analysis-open');
  document.querySelectorAll('.nav-item[data-section]').forEach((button) => {
    button.classList.toggle('active', button.dataset.section === 'player');
  });
}

function paClose() {
  $('playerAnalysisDrawer').classList.remove('open');
  $('analysisBackdrop').classList.remove('open');
  $('playerAnalysisDrawer').setAttribute('aria-hidden', 'true');
  document.body.classList.remove('analysis-open');
  document.querySelectorAll('.nav-item[data-section]').forEach((button) => {
    button.classList.toggle('active', button.dataset.section === 'today');
  });
}

function paDecorateRows() {
  if (!state.data) return;
  const rows = marketRows();
  Array.from($('marketTableBody')?.children || []).forEach((tr, index) => {
    tr.classList.add('analysis-row');
    tr.dataset.analysisIndex = String(index);
    tr.title = 'Open player analysis';
  });
  Array.from($('mobileCards')?.querySelectorAll('.mobile-market-card') || []).forEach((card, index) => {
    const button = card.querySelector('.card-analysis');
    if (!button) return;
    button.disabled = false;
    button.textContent = 'View player analysis';
    button.dataset.analysisIndex = String(index);
  });
}

function paOpenIndex(index) {
  const rows = marketRows();
  paOpen(rows[Number(index)]);
}

function paOpenDefault() {
  const rows = marketRows();
  if (rows.length) {
    paOpen(rows[0]);
    return;
  }
  if (state.data?.markets?.length) paOpen(state.data.markets[0]);
}

function paInstallObservers() {
  const decorate = () => queueMicrotask(paDecorateRows);
  const tableObserver = new MutationObserver(decorate);
  const cardObserver = new MutationObserver(decorate);
  if ($('marketTableBody')) tableObserver.observe($('marketTableBody'), { childList: true });
  if ($('mobileCards')) cardObserver.observe($('mobileCards'), { childList: true });
  decorate();
}

document.addEventListener('click', (event) => {
  const mobileTrigger = event.target.closest('.card-analysis[data-analysis-index]');
  if (mobileTrigger) {
    event.preventDefault();
    paOpenIndex(mobileTrigger.dataset.analysisIndex);
    return;
  }

  const tableRow = event.target.closest('tr.analysis-row[data-analysis-index]');
  if (tableRow && tableRow.closest('#marketTableBody')) {
    paOpenIndex(tableRow.dataset.analysisIndex);
    return;
  }

  const playerNav = event.target.closest('[data-section="player"]');
  if (playerNav) {
    event.preventDefault();
    paOpenDefault();
    if (window.innerWidth <= 820) $('sidebar')?.classList.remove('open');
    return;
  }

  if (event.target.closest('[data-close-analysis]') || event.target === $('analysisBackdrop')) {
    paClose();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && $('playerAnalysisDrawer')?.classList.contains('open')) paClose();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', paInstallObservers);
} else {
  paInstallObservers();
}
