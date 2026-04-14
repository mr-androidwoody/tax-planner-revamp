/**
 * mc-render.js
 *
 * Renders Monte Carlo results into the Risk Outcomes sub-tab.
 * Registers window.RetireMCRender.
 *
 * Depends on:
 *   window.RetireData  — for D.formatMoney
 *
 * Public API:
 *   RetireMCRender.setResults(result, meanInflation)
 *     — store result from mc-engine.js + mean inflation rate (decimal)
 *   RetireMCRender.render()
 *     — paint narrative (real or nominal per _useReal flag)
 *   RetireMCRender.setReal(bool)
 *     — switch real/nominal and re-render
 */

(function () {
  'use strict';

  const D = window.RetireData;

  // ── Formatters ────────────────────────────────────────────────────────────
  function fmt(n) {
    if (D && D.formatMoney) return D.formatMoney(n);
    return '£' + Math.round(n).toLocaleString('en-GB');
  }

  function fmtPct(ratio) {
    return (ratio * 100).toFixed(1) + '%';
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let _result        = null;
  let _meanInflation = 0.025; // overwritten by setResults
  let _useReal       = true;  // default real, matching other charts

  // ── Deflation ─────────────────────────────────────────────────────────────
  // Real = Nominal / (1 + meanInflation)^yearIndex
  function _deflate(nominalValue, yearIndex) {
    if (!_useReal) return nominalValue;
    return nominalValue / Math.pow(1 + _meanInflation, yearIndex);
  }

  function _deflateArr(arr) {
    return arr.map((v, i) => _deflate(v, i));
  }

  // ── Public: store result ──────────────────────────────────────────────────
  function setResults(result, meanInflation) {
    _result        = result;
    _meanInflation = (typeof meanInflation === 'number' && !isNaN(meanInflation))
      ? meanInflation
      : 0.025;
  }

  // ── Public: toggle real/nominal and re-render ─────────────────────────────
  function setReal(useReal) {
    _useReal = useReal;
    render();
  }

  // ── Public: render ────────────────────────────────────────────────────────
  function render() {
    if (!_result) return;
    _syncToggleButtons();
    _renderNarrative();
  }

  // ── Sync toggle button active states ─────────────────────────────────────
  function _syncToggleButtons() {
    document.querySelectorAll('[data-action="mc-real-on"],[data-action="mc-real-off"]')
      .forEach(b => b.classList.remove('is-active'));
    const activeAction = _useReal ? 'mc-real-on' : 'mc-real-off';
    document.querySelectorAll(`[data-action="${activeAction}"]`)
      .forEach(b => b.classList.add('is-active'));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NARRATIVE REPORT
  // ─────────────────────────────────────────────────────────────────────────
  function _renderNarrative() {
    const el = document.getElementById('mc-narrative');
    if (!el) return;

    const r        = _result;
    const lastIdx  = r.years.length - 1;
    const lastYear = r.years[lastIdx];
    const modeLabel = _useReal ? 'real' : 'nominal';

    // Deflated percentile series
    const p10 = _deflateArr(r.p10Portfolio);
    const p50 = _deflateArr(r.p50Portfolio);
    const p90 = _deflateArr(r.p90Portfolio);
    const tax = _deflateArr(r.medianTotalTax);

    // Update sim count in subtitle
    const simCountEl = document.getElementById('mc-sim-count');
    if (simCountEl) simCountEl.textContent = r.simCount.toLocaleString('en-GB');

    // ── Helpers ───────────────────────────────────────────────────────────
    function depletionYear(arr) {
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] <= 0) return r.years[i];
      }
      return null;
    }

    function peak(arr) {
      let maxVal = -Infinity, maxIdx = 0;
      arr.forEach((v, i) => { if (v > maxVal) { maxVal = v; maxIdx = i; } });
      return { value: maxVal, year: r.years[maxIdx] };
    }

    // ── 1. VERDICT ────────────────────────────────────────────────────────
    const successPaths = Math.round(r.successRate * r.simCount);
    const verdictClass =
      r.successRate >= 0.90 ? 'mc-verdict--strong' :
      r.successRate >= 0.75 ? 'mc-verdict--moderate' :
                              'mc-verdict--weak';
    const verdictLabel =
      r.successRate >= 0.90 ? 'This is a strong result.' :
      r.successRate >= 0.75 ? 'This is a moderate result — some vulnerability to poor sequences.' :
                              'This result warrants attention — a significant proportion of paths fail.';

    const verdictHTML = `
      <section class="mc-section mc-verdict ${verdictClass}">
        <h4 class="mc-section-heading">Verdict</h4>
        <p>Your plan succeeds in ${successPaths.toLocaleString('en-GB')} of
        ${r.simCount.toLocaleString('en-GB')} simulations
        (${fmtPct(r.successRate)}). ${verdictLabel}</p>
      </section>`;

    // ── 2. MEDIAN OUTCOME ─────────────────────────────────────────────────
    const p50Peak     = peak(p50);
    const p50Depletes = depletionYear(p50);
    let medianBody;
    if (p50Depletes) {
      const yearsEarly = lastYear - p50Depletes;
      medianBody = `In the median scenario, the portfolio is exhausted by
        ${p50Depletes} — ${yearsEarly} year${yearsEarly !== 1 ? 's' : ''} before
        the end of the projection.`;
    } else {
      medianBody = `In the median scenario, your portfolio peaks at
        ${fmt(p50Peak.value)} around ${p50Peak.year} and finishes at
        ${fmt(p50[lastIdx])} in ${lastYear} (${modeLabel} terms).`;
    }

    const medianHTML = `
      <section class="mc-section">
        <h4 class="mc-section-heading">Median outcome</h4>
        <p>${medianBody}</p>
      </section>`;

    // ── 3. STRESS CASE (p10) ──────────────────────────────────────────────
    const p10Depletes = depletionYear(p10);
    let stressBody;
    if (p10Depletes) {
      const yearsEarly = lastYear - p10Depletes;
      stressBody = `In the stress case (bottom 10% of outcomes), the portfolio
        runs out by ${p10Depletes} — ${yearsEarly} year${yearsEarly !== 1 ? 's' : ''}
        before the end of the projection. This scenario typically reflects a
        combination of poor early returns and elevated inflation.`;
    } else {
      stressBody = `In a poor returns environment (bottom 10%), your portfolio
        retains ${fmt(p10[lastIdx])} by ${lastYear} (${modeLabel} terms). While
        significantly below the median, the plan remains solvent throughout the
        projection under this stress scenario.`;
    }

    const stressHTML = `
      <section class="mc-section">
        <h4 class="mc-section-heading">Stress case (p10)</h4>
        <p>${stressBody}</p>
      </section>`;

    // ── 4. OPTIMISTIC CASE (p90) ──────────────────────────────────────────
    const p90Final   = p90[lastIdx];
    const legacyNote = p90Final > 500_000
      ? ' This would leave meaningful wealth to pass on or deploy in later life.'
      : '';
    const optimisticHTML = `
      <section class="mc-section">
        <h4 class="mc-section-heading">Optimistic case (p90)</h4>
        <p>In a favourable environment (top 10% of outcomes), your portfolio
        reaches ${fmt(p90Final)} by ${lastYear} (${modeLabel} terms).${legacyNote}</p>
      </section>`;

    // ── 5. TAX DRAG ───────────────────────────────────────────────────────
    const nonZeroTax = tax.filter(v => v > 0);
    const avgTax     = nonZeroTax.length
      ? nonZeroTax.reduce((s, v) => s + v, 0) / nonZeroTax.length
      : 0;
    const taxPeak     = peak(tax);
    const taxPeakYear = taxPeak.value > 0 ? taxPeak.year : null;

    let taxBody;
    if (avgTax < 100) {
      taxBody = `Across the median path, your household pays negligible income
        tax — the withdrawal strategy keeps income within tax-free allowances
        for most of the projection.`;
    } else {
      const peakClause = taxPeakYear
        ? ` Tax drag peaks at ${fmt(taxPeak.value)}/year around ${taxPeakYear}, principally
            reflecting the period of heaviest pension withdrawals.`
        : '';
      taxBody = `Across the median path, your household pays an average of
        ${fmt(avgTax)}/year in income tax, principally on pension withdrawals.${peakClause}`;
    }

    const taxHTML = `
      <section class="mc-section">
        <h4 class="mc-section-heading">Tax drag</h4>
        <p>${taxBody}</p>
      </section>`;

    // ── 6. ASSUMPTIONS NOTE ───────────────────────────────────────────────
    const eVolRaw = r.equityVol  != null ? r.equityVol  : 0.16;
    const iVolRaw = r.inflationVol != null ? r.inflationVol : 0.015;
    const eVol = (eVolRaw * 100).toFixed(0);
    const iVol = (iVolRaw * 100).toFixed(1);
    const volLabel =
      eVolRaw >= 0.18 ? 'an aggressive set of assumptions reflecting very high uncertainty' :
      eVolRaw >= 0.14 ? 'a cautious set of assumptions reflecting elevated uncertainty in both markets and inflation' :
                        'a moderate set of assumptions broadly consistent with long-run historical ranges';

    const assumHTML = `
      <section class="mc-section mc-section--muted">
        <h4 class="mc-section-heading">Assumptions</h4>
        <p>This stress test uses ${eVol}% equity volatility and ${iVol}% inflation
        volatility — ${volLabel}. Each of the
        ${r.simCount.toLocaleString('en-GB')} paths independently samples annual
        returns and inflation, compounding uncertainty across the full
        ${r.years.length}-year projection.
        All values shown in ${modeLabel} terms.</p>
      </section>`;

    el.innerHTML = verdictHTML + medianHTML + stressHTML + optimisticHTML + taxHTML + assumHTML;
  }

  // ── Register global ───────────────────────────────────────────────────────
  window.RetireMCRender = { setResults, render, setReal };

})();
