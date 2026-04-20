/**
 * growth-assumptions.js
 *
 * Asset class real return assumptions for the deterministic planning engine.
 * Registers window.RetireGrowthAssumptions.
 *
 * These assumptions are used to suggest a real growth rate on the Growth tab
 * based on the user's actual portfolio allocation. They are INDEPENDENT of
 * the MC engine assumptions in mc-assumptions.js, which use nominal returns.
 *
 * All returns here are REAL (inflation-adjusted, assuming 2.5% inflation) and
 * NET of the 0.22%/yr blended platform + fund fee.
 *
 * ── Asset class real return assumptions (gross, annualised) ───────────────
 * Sources: Vanguard Capital Markets Model 2024, BlackRock CMA 2024,
 *          Dimson/Marsh/Staunton long-run real return data — midpoint applied.
 *
 *   Global equities (MSCI World / VWRL):  6.00% real gross
 *   Global bonds (agg, GBP hedged):       2.25% real gross
 *   Cashlike (money market / QMMF):       0.75% real gross
 *   Cash (uninvested):                   -2.50% real gross (full inflation drag)
 *
 * ── Fee deduction ─────────────────────────────────────────────────────────
 * ANNUAL_FEE is deducted from the blended gross real return.
 * Matches the fee applied in mc-assumptions.js.
 *
 *   0.22% = approx blended cost across Vanguard SIPP/ISA and Trading 212.
 *
 * ── How to update ─────────────────────────────────────────────────────────
 * 1. Adjust EQ_REAL, BD_REAL, CL_REAL if your long-run return view changes.
 * 2. Adjust ANNUAL_FEE if platform/fund costs change.
 * 3. CA_REAL should remain negative — uninvested cash loses purchasing power.
 */

(function () {
  'use strict';

  // ── Asset class real return assumptions (gross, annualised) ───────────────
  const EQ_REAL = 0.0600;   // Global equities (MSCI World / VWRL)
  const BD_REAL = 0.0225;   // Global bonds
  const CL_REAL = 0.0075;   // Cashlike / money market
  const CA_REAL = -0.0250;  // Uninvested cash (full inflation drag)

  // ── Fee deduction ─────────────────────────────────────────────────────────
  const ANNUAL_FEE = 0.0022; // 0.22% blended platform + fund TER

  /**
   * Compute blended net real return from actual portfolio weights.
   * Weights are normalised to sum to 1 internally.
   *
   * @param {number} equityPct   - overall portfolio equities %
   * @param {number} bondPct     - overall portfolio bonds %
   * @param {number} cashlikePct - overall portfolio cashlike %
   * @param {number} cashPct     - overall portfolio cash %
   *
   * @returns {{ rate: number, equityPct: number, bondPct: number, cashlikePct: number, cashPct: number }}
   *   rate        - blended net real return (decimal)
   *   equityPct   - normalised equity weight (for display)
   *   bondPct     - normalised bond weight (for display)
   *   cashlikePct - normalised cashlike weight (for display)
   *   cashPct     - normalised cash weight (for display)
   */
  function getSuggestedGrowth(equityPct, bondPct, cashlikePct, cashPct) {
    const eq = Math.max(0, equityPct   || 0);
    const bd = Math.max(0, bondPct     || 0);
    const cl = Math.max(0, cashlikePct || 0);
    const ca = Math.max(0, cashPct     || 0);

    const total = eq + bd + cl + ca;
    if (total <= 0) return null;

    const weq = eq / total;
    const wbd = bd / total;
    const wcl = cl / total;
    const wca = ca / total;

    const grossReal =
      weq * EQ_REAL +
      wbd * BD_REAL +
      wcl * CL_REAL +
      wca * CA_REAL;

    const netReal = grossReal - ANNUAL_FEE;

    return {
      rate:        netReal,
      equityPct:   Math.round(weq * 100),
      bondPct:     Math.round(wbd * 100),
      cashlikePct: Math.round(wcl * 100),
      cashPct:     Math.round(wca * 100),
    };
  }

  window.RetireGrowthAssumptions = { getSuggestedGrowth };

})();
