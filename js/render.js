(function () {
  const D = window.RetireData;

  function ensureCurrencyInput(el) {
    if (el) el.classList.add('currency-input');
  }

  function initialiseCurrencyInputs() {
    D.MONEY_FIELDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.add('currency-input');
    });
    document.querySelectorAll('[data-currency-input="true"]').forEach((el) => {
      el.classList.add('currency-input');
    });
  }

  function applyCurrencyFormattingToInput(el) {
    if (!el) return;
    const raw = el.value;
    if (raw === null || raw === undefined || String(raw).trim() === '') {
      el.value = '';
      return;
    }
    const parsed = D.parseCurrency(raw);
    el.value = D.formatCurrency(parsed);
  }

  function renderSetupSummary(summary) {
    document.getElementById('sp-total').textContent = D.formatMoney(summary.total);

    D.WRAPPERS.forEach((w) => {
      const el = document.getElementById('wt-' + w);
      if (el) el.textContent = D.formatMoney(summary.wrapperTotals[w] || 0);
    });

    const rows = document.querySelectorAll('#alloc-summary .alloc-row');
    const classes = ['equities', 'bonds', 'cashlike', 'cash'];
    const colors = ['#4472C4', '#70AD47', '#FFC000', '#B0B0B0'];
    classes.forEach((cls, i) => {
      const weighted = summary.overallAllocation[cls] || 0;
      const row = rows[i];
      if (!row) return;
      row.querySelector('.alloc-pct').textContent = weighted.toFixed(1) + '%';
      row.querySelector('.alloc-bar').style.width = weighted.toFixed(1) + '%';
      row.querySelector('.alloc-bar').style.background = colors[i];
    });
    const lbl = document.getElementById('alloc-total-label');
    const pct = Math.round(summary.overallPct);
    lbl.textContent = pct === 100 ? '100.0% Balanced' : summary.overallPct.toFixed(1) + '%';
    lbl.style.color = pct === 100 ? '#16a34a' : '#a16207';
  }

  function updateInterestAccountsBanner(interestAccounts) {
    const banner = document.getElementById('interest-accounts-banner');
    if (!banner) return;
    if (!interestAccounts || !interestAccounts.length) {
      banner.style.display = 'none';
      banner.innerHTML = '';
      return;
    }
    banner.style.display = '';
    banner.style.cssText = 'display:block;background:#f8faff;border:1px solid #dbe7ff;border-radius:6px;padding:8px 10px;font-size:12px;color:#334155';
    banner.innerHTML = interestAccounts.map((a) => {
      const rate = a.rate != null ? a.rate + '%' : '–';
      const draw = a.monthlyDraw != null ? D.formatMoney(a.monthlyDraw) + '/mo' : '–';
      return `<div style="margin-bottom:4px"><strong>${a.name}</strong> (${a.owner}, ${a.wrapper}) – rate ${rate}, draw ${draw}, balance ${D.formatMoney(a.balance || 0)}</div>`;
    }).join('');
  }

  function renderAccountRow(acc, ownerNames) {
    const tbody = document.getElementById('acct-tbody');
    const tr = document.createElement('tr');
    tr.id = 'acct-row-' + acc.id;
    const fixed = D.FIXED_CASH_WRAPPERS.has(acc.wrapper);

    const wrapperOptions = D.WRAPPERS.map((w) => `<option value="${w}" ${acc.wrapper === w ? 'selected' : ''}>${w}</option>`).join('');
    const ownerOptions = ownerNames.map((o) => `<option value="${o}" ${acc.owner === o ? 'selected' : ''}>${o}</option>`).join('');
    const allocInputs = D.ALLOC_CLASSES.map((cls) => `
      <td class="col-alloc">
        <input type="number" min="0" max="100" step="1"
          data-account-id="${acc.id}"
          data-field="${cls}"
          value="${acc.alloc[cls]}"
          ${fixed ? 'disabled' : ''}>
      </td>
    `).join('');

    tr.innerHTML = `
      <td class="col-name">
        <input type="text" value="${acc.name}" placeholder="Account name"
          data-account-id="${acc.id}" data-field="name">
      </td>
      <td class="col-wrap">
        <select data-account-id="${acc.id}" data-field="wrapper">${wrapperOptions}</select>
      </td>
      <td class="col-owner">
        <select data-account-id="${acc.id}" data-field="owner">${ownerOptions}</select>
      </td>
      <td class="col-value">
        <input type="text" inputmode="numeric" data-currency-input="true" data-account-id="${acc.id}" data-field="value" value="${acc.value ? D.formatCurrency(acc.value) : ''}" placeholder="0">
      </td>
      ${allocInputs}
      <td class="col-rate">
        <input type="number" min="0" max="20" step="0.01" value="${acc.rate ?? ''}" placeholder="–"
          title="Annual interest rate %. Leave blank for equity/growth account."
          data-account-id="${acc.id}" data-field="rate">
      </td>
      <td class="col-draw">
        <input type="text" inputmode="numeric" data-currency-input="true" data-account-id="${acc.id}" data-field="monthlyDraw" value="${acc.monthlyDraw != null ? D.formatCurrency(acc.monthlyDraw) : ''}" placeholder="–"
          title="Fixed monthly draw £. Only used if Rate % is set.">
      </td>
      <td class="col-total" id="badge-${acc.id}"></td>
      <td class="col-action"><button type="button" class="btn-remove" data-action="remove-account" data-account-id="${acc.id}">Remove</button></td>
    `;

    tbody.appendChild(tr);
    initialiseCurrencyInputs();
  }

  function updateRowBadge(acc) {
    const el = document.getElementById('badge-' + acc.id);
    if (!el) return;
    const total = D.ALLOC_CLASSES.reduce((s, c) => s + (acc.alloc[c] || 0), 0);
    const pct = Math.round(total);
    let cls = 'total-warn';
    let label = pct + '%';
    if (pct === 100) {
      cls = 'total-ok';
      label = '100%<br><span style="font-weight:400;font-size:10px">Ready</span>';
    } else if (pct > 100) {
      cls = 'total-err';
    }
    el.innerHTML = `<span class="total-badge ${cls}">${label}</span>`;
  }

  function refreshOwnerOptions(accounts, ownerNames) {
    accounts.forEach((acc) => {
      const row = document.getElementById('acct-row-' + acc.id);
      if (!row) return;
      const select = row.querySelector('select[data-field="owner"]');
      if (!select) return;
      select.innerHTML = ownerNames.map((o) => `<option value="${o}" ${acc.owner === o ? 'selected' : ''}>${o}</option>`).join('');
    });
  }

  function applyWrapperFieldState(acc) {
    const row = document.getElementById('acct-row-' + acc.id);
    if (!row) return;
    const fixed = D.FIXED_CASH_WRAPPERS.has(acc.wrapper);
    D.ALLOC_CLASSES.forEach((cls) => {
      const inp = row.querySelector(`[data-field="${cls}"]`);
      if (!inp) return;
      inp.disabled = fixed;
      inp.value = acc.alloc[cls];
    });
  }

  function renderHandoffBanner(info) {
    let banner = document.getElementById('handoff-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'handoff-banner';
      banner.style.cssText = 'background:#dcfce7;border:1px solid #86efac;border-radius:6px;padding:8px 10px;font-size:12px;color:#166534;margin-bottom:1rem;';
      const sidebar = document.querySelector('#main-app .sidebar');
      sidebar.insertBefore(banner, sidebar.firstChild);
    }
    banner.innerHTML = `✓ Portfolio loaded: ${info.nAccts} accounts, ${D.formatMoney(info.total)} total`;
  }

  function renderAlerts(depletions) {
    const c = document.getElementById('alerts-container');
    c.innerHTML = '';
    const entries = Object.entries(depletions).sort((a, b) => a[1].year - b[1].year);
    if (!entries.length) return;
    entries.forEach(([key, payload]) => {
      const d = document.createElement('div');
      d.className = 'alert alert-warn';
      d.innerHTML = `⚠ <strong>${key}</strong> depleted in <strong>${payload.year}</strong> (age ${payload.age})`;
      c.appendChild(d);
    });
  }

  function adj(val, row, useReal) {
    return useReal ? val * row.realDeflator : val;
  }

  function renderMetrics(rows, viewPerson, useReal) {
    if (!rows.length) return;
    const fmt = (n) => D.formatMoney(n);
    const totalTax = rows.reduce((s, r) => {
      const t = viewPerson === 'woody' ? r.woodyIncomeTax + r.woodyCGT + r.woodyNI
        : viewPerson === 'heidi' ? r.heidiIncomeTax + r.heidiCGT + r.heidiNI
          : r.woodyIncomeTax + r.woodyCGT + r.woodyNI + r.heidiIncomeTax + r.heidiCGT + r.heidiNI;
      return s + adj(t, r, useReal);
    }, 0);

    const avgRate = rows.reduce((s, r) => {
      const tax = viewPerson === 'woody' ? r.woodyIncomeTax + r.woodyCGT + r.woodyNI
        : viewPerson === 'heidi' ? r.heidiIncomeTax + r.heidiCGT + r.heidiNI
          : r.woodyIncomeTax + r.woodyCGT + r.woodyNI + r.heidiIncomeTax + r.heidiCGT + r.heidiNI;
      const woodyGross = r.woodySP + r.woodyDrawn.SIPP + r.woodyDrawn.ISA + r.woodyDrawn.GIA + r.woodyIntTaxable + r.woodyIntDraw + r.woodyDrawn.Cash;
      const heidiGross = r.heidiSP + r.heidiSalInc + r.heidiDrawn.SIPP + r.heidiDrawn.ISA + r.heidiDrawn.GIA + r.heidiIntTaxable + r.heidiIntDraw + r.heidiDrawn.Cash;
      const gross = viewPerson === 'woody' ? woodyGross : viewPerson === 'heidi' ? heidiGross : woodyGross + heidiGross;
      return s + (gross > 0 ? tax / gross : 0);
    }, 0) / rows.length;

    let peakYear = rows[0].year;
    let peakTax = 0;
    rows.forEach((r) => {
      const t = viewPerson === 'woody' ? r.woodyTax : viewPerson === 'heidi' ? r.heidiTax : r.woodyTax + r.heidiTax;
      if (t > peakTax) {
        peakTax = t;
        peakYear = r.year;
      }
    });

    const last = rows[rows.length - 1];
    document.getElementById('m-tax').textContent = fmt(totalTax);
    document.getElementById('m-rate').textContent = (avgRate * 100).toFixed(1) + '%';
    document.getElementById('m-peak').textContent = peakYear;
    document.getElementById('m-port').textContent = fmt(adj(last.totalPortfolio, last, useReal));
  }

  function renderIncomeLegend(chart) {
    const host = document.getElementById('incomeLegend');
    if (!host) return;
    host.innerHTML = '';

    const datasets = chart.data.datasets || [];
    const woody = datasets.map((ds, i) => ({ ds, i })).filter((x) => x.ds.label.includes('Woody'));
    const heidi = datasets.map((ds, i) => ({ ds, i })).filter((x) => x.ds.label.includes('Heidi'));

    function makeRow(items) {
      const row = document.createElement('div');
      row.className = 'split-legend-row';
      items.forEach(({ ds, i }) => {
        const item = document.createElement('div');
        item.className = 'split-legend-item';
        if (!chart.isDatasetVisible(i)) item.classList.add('is-hidden');

        const swatch = document.createElement('span');
        swatch.className = 'split-legend-swatch';
        swatch.style.background = ds.backgroundColor;

        const label = document.createElement('span');
        label.textContent = ds.label;

        item.appendChild(swatch);
        item.appendChild(label);
        item.addEventListener('click', () => {
          const visible = chart.isDatasetVisible(i);
          chart.setDatasetVisibility(i, !visible);
          chart.update();
          renderIncomeLegend(chart);
        });
        row.appendChild(item);
      });
      return row;
    }

    if (woody.length) host.appendChild(makeRow(woody));
    if (heidi.length) host.appendChild(makeRow(heidi));
  }

  function renderWealthChart(labels, rows, viewPerson, useReal, charts) {
    function wds(label, fn, color) {
      return {
        label,
        data: rows.map((r) => Math.round(adj(fn(r.snap), r, useReal) / 1000)),
        backgroundColor: color,
        stack: 'wealth',
      };
    }

    const datasets = [];
    if (viewPerson === 'both' || viewPerson === 'woody') {
      datasets.push(wds('SIPP – Woody', (s) => s.woodySIPP, '#E84D4D'));
      datasets.push(wds('ISA – Woody', (s) => s.woodyISA, '#4472C4'));
      datasets.push(wds('GIA – Woody', (s) => s.woodyGIA, '#FFC000'));
      datasets.push(wds('Interest accts – Woody', (s) => s.woodyIntBal || 0, '#9B59B6'));
      datasets.push(wds('Cash – Woody', (s) => s.woodyCash, '#B0B0B0'));
    }
    if (viewPerson === 'both' || viewPerson === 'heidi') {
      datasets.push(wds('SIPP – Heidi', (s) => s.heidiSIPP, '#FF8C8C'));
      datasets.push(wds('ISA – Heidi', (s) => s.heidiISA, '#5B9BD5'));
      datasets.push(wds('GIA – Heidi', (s) => s.heidiGIA, '#FFD966'));
      datasets.push(wds('Interest accts – Heidi', (s) => s.heidiIntBal || 0, '#C39BD3'));
      datasets.push(wds('Cash – Heidi', (s) => s.heidiCash, '#D0D0D0'));
    }

    const ctx = document.getElementById('wealthChart').getContext('2d');
    if (charts.wealthChart) charts.wealthChart.destroy();
    charts.wealthChart = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${D.formatMoney((context.parsed.y || 0) * 1000)}` } },
        },
        scales: {
          x: { stacked: true, ticks: { font: { size: 10 }, maxRotation: 45 } },
          y: {
            stacked: true,
            title: { display: true, text: useReal ? 'Real £k' : 'Nominal £k', font: { size: 11 } },
            ticks: { font: { size: 11 }, callback: (value) => D.formatNumber(value, 0) + 'k' },
          },
        },
      },
    });
  }

  function renderCharts(rows, viewPerson, useReal, charts) {
    if (!rows.length) return;
    const labels = rows.map((r) => r.year);
    const C = {
      woodySP: '#4472C4', heidiSP: '#70AD47',
      woodySIPP: '#ED7D31', heidiSIPP: '#FFC000',
      woodyISA: '#5B9BD5', heidiISA: '#2E86C1',
      woodyGIA: '#A9D18E', heidiGIA: '#78C86A',
      intDraw: '#9B59B6', woodyCash: '#B0B0B0',
      salary: '#FF7F7F',
    };

    function ds(label, fn, color) {
      return { label, data: rows.map((r) => Math.round(adj(fn(r), r, useReal) / 1000)), backgroundColor: color, stack: 'income' };
    }

    const sets = [];
    if (viewPerson === 'both' || viewPerson === 'woody') {
      sets.push(ds('State Pension – Woody', (r) => r.woodySP, C.woodySP));
      sets.push(ds('SIPP – Woody', (r) => r.woodyDrawn.SIPP, C.woodySIPP));
      sets.push(ds('ISA – Woody', (r) => r.woodyDrawn.ISA, C.woodyISA));
      sets.push(ds('GIA – Woody', (r) => r.woodyDrawn.GIA, C.woodyGIA));
      sets.push(ds('Interest draw – Woody', (r) => r.woodyIntDraw, C.intDraw));
      sets.push(ds('Cash draw – Woody', (r) => r.woodyDrawn.Cash, C.woodyCash));
    }
    if (viewPerson === 'both' || viewPerson === 'heidi') {
      sets.push(ds('State Pension – Heidi', (r) => r.heidiSP, C.heidiSP));
      sets.push(ds('Salary – Heidi', (r) => r.heidiSalInc, C.salary));
      sets.push(ds('SIPP – Heidi', (r) => r.heidiDrawn.SIPP, C.heidiSIPP));
      sets.push(ds('ISA – Heidi', (r) => r.heidiDrawn.ISA, C.heidiISA));
      sets.push(ds('GIA – Heidi', (r) => r.heidiDrawn.GIA, C.heidiGIA));
      sets.push(ds('Interest draw – Heidi', (r) => r.heidiIntDraw, C.intDraw));
      sets.push(ds('Cash draw – Heidi', (r) => r.heidiDrawn.Cash, C.woodyCash));
    }

    const incCtx = document.getElementById('incomeChart').getContext('2d');
    if (charts.incomeChart) charts.incomeChart.destroy();
    charts.incomeChart = new Chart(incCtx, {
      type: 'bar',
      data: { labels, datasets: sets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${D.formatMoney((context.parsed.y || 0) * 1000)}` } },
        },
        scales: {
          x: { stacked: true, ticks: { font: { size: 10 }, maxRotation: 45 } },
          y: {
            stacked: true,
            title: { display: true, text: useReal ? 'Real £k' : 'Nominal £k', font: { size: 11 } },
            ticks: { font: { size: 11 }, callback: (value) => D.formatNumber(value, 0) + 'k' },
          },
        },
      },
    });
    renderIncomeLegend(charts.incomeChart);

    const taxData = rows.map((r) => {
      const t = viewPerson === 'woody' ? r.woodyIncomeTax + r.woodyCGT
        : viewPerson === 'heidi' ? r.heidiIncomeTax + r.heidiCGT
          : (r.woodyIncomeTax + r.woodyCGT + r.heidiIncomeTax + r.heidiCGT);
      return Math.round(adj(t, r, useReal));
    });
    const rateData = rows.map((r) => {
      const tax = viewPerson === 'woody' ? r.woodyIncomeTax + r.woodyCGT
        : viewPerson === 'heidi' ? r.heidiIncomeTax + r.heidiCGT
          : (r.woodyIncomeTax + r.woodyCGT + r.heidiIncomeTax + r.heidiCGT);
      const woodyGross = r.woodySP + r.woodyDrawn.SIPP + r.woodyDrawn.ISA + r.woodyDrawn.GIA + r.woodyIntTaxable + r.woodyIntDraw + r.woodyDrawn.Cash;
      const heidiGross = r.heidiSP + r.heidiSalInc + r.heidiDrawn.SIPP + r.heidiDrawn.ISA + r.heidiDrawn.GIA + r.heidiIntTaxable + r.heidiIntDraw + r.heidiDrawn.Cash;
      const gross = viewPerson === 'woody' ? woodyGross : viewPerson === 'heidi' ? heidiGross : woodyGross + heidiGross;
      return gross > 0 ? parseFloat((tax / gross * 100).toFixed(1)) : 0;
    });

    const taxCtx = document.getElementById('taxChart').getContext('2d');
    if (charts.taxChart) charts.taxChart.destroy();
    charts.taxChart = new Chart(taxCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Tax paid (£)', data: taxData, backgroundColor: '#4472C4', yAxisID: 'y', order: 2 },
          { label: 'Effective rate (%)', data: rateData, type: 'line', borderColor: '#E84D4D', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 2, yAxisID: 'y2', order: 1 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (context) => {
                if (context.dataset.yAxisID === 'y2') return `${context.dataset.label}: ${context.parsed.y}%`;
                return `${context.dataset.label}: ${D.formatMoney(context.parsed.y || 0)}`;
              },
            },
          },
        },
        scales: {
          x: { ticks: { font: { size: 10 }, maxRotation: 45 } },
          y: {
            position: 'left',
            title: { display: true, text: useReal ? 'Real £' : 'Nominal £', font: { size: 11 } },
            ticks: { font: { size: 11 }, callback: (value) => D.formatMoney(value) },
          },
          y2: {
            position: 'right',
            title: { display: true, text: 'Effective rate %', font: { size: 11 } },
            grid: { drawOnChartArea: false },
            ticks: { font: { size: 11 }, callback: (v) => v + '%' },
            min: 0,
          },
        },
      },
    });

    renderWealthChart(labels, rows, viewPerson, useReal, charts);
  }

  function renderTables(rows, useReal) {
    if (!rows.length) return;
    const f = (n) => D.formatMoney(n);
    const a = (val, row) => useReal ? val * row.realDeflator : val;

    const taxTbl = document.getElementById('tax-table');
    let cumTax = 0;
    const taxHead = `<thead><tr>
      <th>Year</th><th>Woody age</th><th>Heidi age</th>
      <th>Woody income tax</th><th>Woody CGT</th><th>Woody total</th>
      <th>Heidi income tax</th><th>Heidi CGT</th><th>Heidi total</th>
      <th>B&amp;ISA CGT</th><th>Household tax</th><th>Cumulative tax</th>
    </tr></thead>`;
    let taxBody = '<tbody>';
    let grandTaxWoodyInc = 0;
    let grandTaxWoodyCGT = 0;
    let grandTaxHeidiInc = 0;
    let grandTaxHeidiCGT = 0;
    let grandBniCGT = 0;
    rows.forEach((r) => {
      const wi = a(r.woodyIncomeTax, r); const wc = a(r.woodyCGT, r);
      const hi = a(r.heidiIncomeTax, r); const hc = a(r.heidiCGT, r);
      const bc = a(r.bniCGTBill || 0, r);
      const wt = wi + wc; const ht = hi + hc; const hh = wt + ht + bc;
      cumTax += hh;
      grandTaxWoodyInc += wi; grandTaxWoodyCGT += wc;
      grandTaxHeidiInc += hi; grandTaxHeidiCGT += hc;
      grandBniCGT += bc;
      taxBody += `<tr>
        <td>${r.year}</td><td>${r.woodyAge}</td><td>${r.heidiAge}</td>
        <td>${f(wi)}</td><td>${f(wc)}</td><td>${f(wt)}</td>
        <td>${f(hi)}</td><td>${f(hc)}</td><td>${f(ht)}</td>
        <td>${f(bc)}</td><td>${f(hh)}</td><td>${f(cumTax)}</td>
      </tr>`;
    });
    const grandTotal = grandTaxWoodyInc + grandTaxWoodyCGT + grandTaxHeidiInc + grandTaxHeidiCGT + grandBniCGT;
    taxBody += `<tr class="total-row">
      <td colspan="3">Total</td>
      <td>${f(grandTaxWoodyInc)}</td><td>${f(grandTaxWoodyCGT)}</td><td>${f(grandTaxWoodyInc + grandTaxWoodyCGT)}</td>
      <td>${f(grandTaxHeidiInc)}</td><td>${f(grandTaxHeidiCGT)}</td><td>${f(grandTaxHeidiInc + grandTaxHeidiCGT)}</td>
      <td>${f(grandBniCGT)}</td><td>${f(grandTotal)}</td><td>${f(grandTotal)}</td>
    </tr></tbody>`;
    taxTbl.innerHTML = taxHead + taxBody;

    const wTbl = document.getElementById('wealth-table');
    const wHead = `<thead><tr>
      <th>Year</th><th>Woody age</th><th>Heidi age</th>
      <th>Woody Cash</th><th>Woody Interest</th><th>Woody GIA</th><th>Woody SIPP</th><th>Woody ISA</th>
      <th>Heidi Cash</th><th>Heidi Interest</th><th>Heidi GIA</th><th>Heidi SIPP</th><th>Heidi ISA</th>
      <th>Total</th>
    </tr></thead>`;
    let wBody = '<tbody>';
    rows.forEach((r) => {
      const s = r.snap;
      const av = (v) => a(v, r);
      const wTotal = av((s.woodyCash || 0) + (s.woodyIntBal || 0) + (s.woodyGIA || 0) + (s.woodySIPP || 0) + (s.woodyISA || 0)
        + (s.heidiCash || 0) + (s.heidiIntBal || 0) + (s.heidiGIA || 0) + (s.heidiSIPP || 0) + (s.heidiISA || 0));
      const cell = (v) => {
        const adjusted = a(v, r);
        return `<td${adjusted <= 0 && v === 0 ? '' : adjusted < 1 ? ' class="depleted"' : ''}>${f(adjusted)}</td>`;
      };
      wBody += `<tr>
        <td>${r.year}</td><td>${r.woodyAge}</td><td>${r.heidiAge}</td>
        ${cell(s.woodyCash)}${cell(s.woodyIntBal || 0)}${cell(s.woodyGIA)}${cell(s.woodySIPP)}${cell(s.woodyISA)}
        ${cell(s.heidiCash)}${cell(s.heidiIntBal || 0)}${cell(s.heidiGIA)}${cell(s.heidiSIPP)}${cell(s.heidiISA)}
        <td>${f(wTotal)}</td>
      </tr>`;
    });
    wBody += '</tbody>';
    wTbl.innerHTML = wHead + wBody;
  }

  window.RetireRender = {
    ensureCurrencyInput,
    initialiseCurrencyInputs,
    applyCurrencyFormattingToInput,
    renderSetupSummary,
    updateInterestAccountsBanner,
    renderAccountRow,
    updateRowBadge,
    refreshOwnerOptions,
    applyWrapperFieldState,
    renderHandoffBanner,
    renderAlerts,
    renderMetrics,
    renderCharts,
    renderTables,
  };
}());
