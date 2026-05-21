/**
 * stats.js — Statistical analysis
 */

const Stats = (() => {

  /**
   * Generate overview stats for the dataset.
   */
  function overview(headers, rows, colTypes) {
    const totalCells = headers.length * rows.length;
    let nullCells = 0;
    let numericCols = 0;
    let textCols = 0;

    colTypes.forEach(ct => {
      nullCells += ct.nullCount;
      if (ct.type === 'number') numericCols++;
      else textCols++;
    });

    return {
      rows: rows.length,
      columns: headers.length,
      totalCells,
      nullCells,
      fillRate: totalCells ? ((1 - nullCells / totalCells) * 100).toFixed(1) : '100.0',
      numericCols,
      textCols,
      duplicates: countDuplicates(rows)
    };
  }

  function countDuplicates(rows) {
    const seen = new Set();
    let dupes = 0;
    rows.forEach(row => {
      const key = JSON.stringify(row);
      if (seen.has(key)) dupes++;
      else seen.add(key);
    });
    return dupes;
  }

  /**
   * Per-column statistics for numeric columns.
   * Returns array of { column, count, nulls, mean, median, mode, stdDev, min, max, q1, q3 }
   */
  function columnStats(headers, rows, colTypes) {
    const results = [];

    headers.forEach((h, ci) => {
      if (colTypes[ci].type !== 'number') return;

      const vals = [];
      let nullCount = 0;

      rows.forEach(r => {
        const v = r[ci];
        if (v === null || v === undefined || String(v).trim() === '' || isNaN(v)) {
          nullCount++;
        } else {
          vals.push(Number(v));
        }
      });

      if (vals.length === 0) {
        results.push({
          column: h,
          count: 0,
          nulls: nullCount,
          mean: '—',
          median: '—',
          mode: '—',
          stdDev: '—',
          min: '—',
          max: '—',
          q1: '—',
          q3: '—'
        });
        return;
      }

      vals.sort((a, b) => a - b);

      const sum = vals.reduce((a, b) => a + b, 0);
      const mean = sum / vals.length;
      const median = calcMedian(vals);
      const mode = calcMode(vals);
      const stdDev = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
      const min = vals[0];
      const max = vals[vals.length - 1];
      const q1 = calcPercentile(vals, 25);
      const q3 = calcPercentile(vals, 75);

      results.push({
        column: h,
        count: vals.length,
        nulls: nullCount,
        mean: round(mean),
        median: round(median),
        mode: round(mode),
        stdDev: round(stdDev),
        min: round(min),
        max: round(max),
        q1: round(q1),
        q3: round(q3)
      });
    });

    // Also add text column frequency info
    headers.forEach((h, ci) => {
      if (colTypes[ci].type === 'number') return;

      let nullCount = 0;
      const freq = {};

      rows.forEach(r => {
        const v = r[ci];
        if (v === null || v === undefined || String(v).trim() === '') {
          nullCount++;
        } else {
          const key = String(v);
          freq[key] = (freq[key] || 0) + 1;
        }
      });

      const uniqueCount = Object.keys(freq).length;
      let topValue = '—';
      let topFreq = 0;
      Object.entries(freq).forEach(([k, count]) => {
        if (count > topFreq) { topFreq = count; topValue = k; }
      });

      results.push({
        column: h,
        count: rows.length - nullCount,
        nulls: nullCount,
        mean: '—',
        median: '—',
        mode: topValue,
        stdDev: '—',
        min: `${uniqueCount} unique`,
        max: `top: ${topValue} (${topFreq})`,
        q1: '—',
        q3: '—'
      });
    });

    return results;
  }

  function calcMedian(sorted) {
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function calcMode(sorted) {
    const freq = {};
    sorted.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
    let mode = sorted[0];
    let maxF = 0;
    Object.entries(freq).forEach(([k, f]) => {
      if (f > maxF) { maxF = f; mode = Number(k); }
    });
    return mode;
  }

  function calcPercentile(sorted, p) {
    const idx = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
  }

  function round(v) {
    if (typeof v !== 'number' || isNaN(v)) return v;
    return Math.round(v * 1000) / 1000;
  }

  /**
   * Render overview stats cards.
   */
  function renderOverview(overviewData, el) {
    el.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Rows</div>
        <div class="stat-value">${overviewData.rows.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Columns</div>
        <div class="stat-value">${overviewData.columns}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Fill Rate</div>
        <div class="stat-value">${overviewData.fillRate}%</div>
        <div class="stat-sub">${overviewData.nullCells.toLocaleString()} null cells</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Duplicates</div>
        <div class="stat-value">${overviewData.duplicates}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Numeric Cols</div>
        <div class="stat-value">${overviewData.numericCols}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Text Cols</div>
        <div class="stat-value">${overviewData.textCols}</div>
      </div>
    `;
  }

  /**
   * Render per-column stats table.
   */
  function renderTable(colStats, headEl, bodyEl) {
    headEl.innerHTML = `
      <tr>
        <th>Column</th>
        <th>Count</th>
        <th>Nulls</th>
        <th>Mean</th>
        <th>Median</th>
        <th>Mode</th>
        <th>Std Dev</th>
        <th>Min</th>
        <th>Max</th>
        <th>Q1</th>
        <th>Q3</th>
      </tr>
    `;

    bodyEl.innerHTML = colStats.map(s => `
      <tr>
        <td style="font-weight:600;color:var(--text-accent)">${escHtml(s.column)}</td>
        <td>${s.count}</td>
        <td>${s.nulls}</td>
        <td>${s.mean}</td>
        <td>${s.median}</td>
        <td>${escHtml(String(s.mode))}</td>
        <td>${s.stdDev}</td>
        <td>${escHtml(String(s.min))}</td>
        <td>${escHtml(String(s.max))}</td>
        <td>${s.q1}</td>
        <td>${s.q3}</td>
      </tr>
    `).join('');
  }

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Generate text report.
   */
  function generateReport(overviewData, colStats, headers) {
    let report = '=== DataLens Statistical Report ===\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;
    report += `--- Overview ---\n`;
    report += `Rows: ${overviewData.rows}\n`;
    report += `Columns: ${overviewData.columns}\n`;
    report += `Fill Rate: ${overviewData.fillRate}%\n`;
    report += `Null Cells: ${overviewData.nullCells}\n`;
    report += `Duplicates: ${overviewData.duplicates}\n\n`;

    report += `--- Column Statistics ---\n`;
    colStats.forEach(s => {
      report += `\n[${s.column}]\n`;
      report += `  Count: ${s.count}, Nulls: ${s.nulls}\n`;
      report += `  Mean: ${s.mean}, Median: ${s.median}, Mode: ${s.mode}\n`;
      report += `  Std Dev: ${s.stdDev}\n`;
      report += `  Min: ${s.min}, Max: ${s.max}\n`;
      report += `  Q1: ${s.q1}, Q3: ${s.q3}\n`;
    });

    return report;
  }

  return { overview, columnStats, renderOverview, renderTable, generateReport };
})();
