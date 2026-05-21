/**
 * advanced.js — Power BI-like advanced analytics
 * Group By / Pivot, Data Profiling, Outlier Detection, Correlation Matrix, Cross Tabulation, Binning
 */

const Advanced = (() => {

  function isNull(v) {
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
  }

  // ===== GROUP BY / PIVOT =====

  /**
   * Group rows by a column and aggregate a value column.
   * @param {string[]} headers
   * @param {any[][]} rows
   * @param {string} groupCol
   * @param {string} valueCol
   * @param {string} aggFunc — 'sum'|'avg'|'count'|'min'|'max'|'median'|'countDistinct'
   * @returns {{ headers: string[], rows: any[][] }}
   */
  function groupBy(headers, rows, groupCol, valueCol, aggFunc) {
    const gi = headers.indexOf(groupCol);
    const vi = headers.indexOf(valueCol);
    if (gi === -1) return { headers: [], rows: [] };

    const groups = {};
    rows.forEach(r => {
      const key = isNull(r[gi]) ? '(blank)' : String(r[gi]);
      if (!groups[key]) groups[key] = [];
      if (vi !== -1 && !isNull(r[vi])) {
        const n = Number(r[vi]);
        groups[key].push(isNaN(n) ? r[vi] : n);
      }
    });

    const resultHeaders = [groupCol, `${aggFunc.toUpperCase()}(${valueCol || 'count'})`];
    const resultRows = [];

    Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])).forEach(([key, vals]) => {
      let aggValue;
      const nums = vals.filter(v => typeof v === 'number');

      switch (aggFunc) {
        case 'sum':
          aggValue = nums.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          aggValue = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
          aggValue = Math.round(aggValue * 100) / 100;
          break;
        case 'count':
          aggValue = vals.length;
          break;
        case 'countDistinct':
          aggValue = new Set(vals.map(String)).size;
          break;
        case 'min':
          aggValue = nums.length ? Math.min(...nums) : null;
          break;
        case 'max':
          aggValue = nums.length ? Math.max(...nums) : null;
          break;
        case 'median': {
          if (!nums.length) { aggValue = null; break; }
          const s = nums.sort((a, b) => a - b);
          const mid = Math.floor(s.length / 2);
          aggValue = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
          break;
        }
        default:
          aggValue = vals.length;
      }

      resultRows.push([key, aggValue]);
    });

    return { headers: resultHeaders, rows: resultRows };
  }

  /**
   * Multi-column group by (up to 2 group columns).
   */
  function groupByMulti(headers, rows, groupCols, valueCol, aggFunc) {
    if (groupCols.length === 1) return groupBy(headers, rows, groupCols[0], valueCol, aggFunc);

    const gIndices = groupCols.map(c => headers.indexOf(c));
    const vi = headers.indexOf(valueCol);

    const groups = {};
    rows.forEach(r => {
      const key = gIndices.map(gi => isNull(r[gi]) ? '(blank)' : String(r[gi])).join(' | ');
      if (!groups[key]) groups[key] = [];
      if (vi !== -1 && !isNull(r[vi])) {
        const n = Number(r[vi]);
        groups[key].push(isNaN(n) ? r[vi] : n);
      }
    });

    const resultHeaders = [...groupCols, `${aggFunc.toUpperCase()}(${valueCol || 'count'})`];
    const resultRows = [];

    Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])).forEach(([key, vals]) => {
      const parts = key.split(' | ');
      const nums = vals.filter(v => typeof v === 'number');
      let aggValue;

      switch (aggFunc) {
        case 'sum': aggValue = nums.reduce((a, b) => a + b, 0); break;
        case 'avg': aggValue = nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length * 100) / 100 : 0; break;
        case 'count': aggValue = vals.length; break;
        case 'countDistinct': aggValue = new Set(vals.map(String)).size; break;
        case 'min': aggValue = nums.length ? Math.min(...nums) : null; break;
        case 'max': aggValue = nums.length ? Math.max(...nums) : null; break;
        case 'median': {
          if (!nums.length) { aggValue = null; break; }
          const s = nums.sort((a, b) => a - b);
          const mid = Math.floor(s.length / 2);
          aggValue = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
          break;
        }
        default: aggValue = vals.length;
      }

      resultRows.push([...parts, aggValue]);
    });

    return { headers: resultHeaders, rows: resultRows };
  }

  // ===== DATA PROFILING =====

  /**
   * Generate a profile for each column.
   * @returns array of { column, type, count, nulls, nullPct, unique, topValue, topFreq, quality }
   */
  function profile(headers, rows, colTypes) {
    return headers.map((h, ci) => {
      const vals = rows.map(r => r[ci]);
      let nullCount = 0;
      const freq = {};

      vals.forEach(v => {
        if (isNull(v)) {
          nullCount++;
        } else {
          const s = String(v);
          freq[s] = (freq[s] || 0) + 1;
        }
      });

      const uniqueCount = Object.keys(freq).length;
      let topValue = '—', topFreq = 0;
      Object.entries(freq).forEach(([k, f]) => {
        if (f > topFreq) { topFreq = f; topValue = k; }
      });

      const quality = rows.length ? Math.round((1 - nullCount / rows.length) * 100) : 100;
      const type = colTypes[ci] ? colTypes[ci].type : 'text';

      // For numeric columns, add min/max/mean
      let min = null, max = null, mean = null;
      if (type === 'number') {
        const nums = vals.filter(v => !isNull(v) && !isNaN(v)).map(Number);
        if (nums.length) {
          min = Math.min(...nums);
          max = Math.max(...nums);
          mean = Math.round(nums.reduce((a, b) => a + b, 0) / nums.length * 100) / 100;
        }
      }

      return {
        column: h, type, count: rows.length, nulls: nullCount,
        nullPct: rows.length ? Math.round(nullCount / rows.length * 1000) / 10 : 0,
        unique: uniqueCount, topValue, topFreq, quality,
        min, max, mean
      };
    });
  }

  /**
   * Get value distribution for a column (top N values with counts).
   */
  function valueDistribution(rows, colIndex, topN = 15) {
    const freq = {};
    rows.forEach(r => {
      const v = r[colIndex];
      const key = isNull(v) ? '(blank)' : String(v);
      freq[key] = (freq[key] || 0) + 1;
    });

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([value, count]) => ({ value, count, pct: Math.round(count / rows.length * 1000) / 10 }));
  }

  // ===== OUTLIER DETECTION =====

  /**
   * Detect outliers using IQR or Z-Score method.
   * @param {any[][]} rows
   * @param {number} colIndex
   * @param {string} method — 'iqr' | 'zscore'
   * @param {number} threshold — IQR multiplier (default 1.5) or Z-score threshold (default 3)
   * @returns {{ outlierCount, lowerBound, upperBound, outlierIndices, outlierValues }}
   */
  function detectOutliers(rows, colIndex, method = 'iqr', threshold) {
    const indexed = [];
    rows.forEach((r, i) => {
      const v = r[colIndex];
      if (!isNull(v) && !isNaN(v)) indexed.push({ val: Number(v), idx: i });
    });

    if (indexed.length < 4) return { outlierCount: 0, lowerBound: null, upperBound: null, outlierIndices: [], outlierValues: [] };

    const vals = indexed.map(x => x.val).sort((a, b) => a - b);
    let lowerBound, upperBound;

    if (method === 'iqr') {
      const t = threshold || 1.5;
      const q1Idx = Math.floor(vals.length * 0.25);
      const q3Idx = Math.floor(vals.length * 0.75);
      const q1 = vals[q1Idx], q3 = vals[q3Idx];
      const iqr = q3 - q1;
      lowerBound = q1 - t * iqr;
      upperBound = q3 + t * iqr;
    } else {
      const t = threshold || 3;
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
      lowerBound = mean - t * std;
      upperBound = mean + t * std;
    }

    const outlierIndices = [];
    const outlierValues = [];
    indexed.forEach(({ val, idx }) => {
      if (val < lowerBound || val > upperBound) {
        outlierIndices.push(idx);
        outlierValues.push(val);
      }
    });

    return {
      outlierCount: outlierIndices.length,
      lowerBound: Math.round(lowerBound * 100) / 100,
      upperBound: Math.round(upperBound * 100) / 100,
      outlierIndices,
      outlierValues: outlierValues.slice(0, 50)
    };
  }

  /**
   * Flag outliers by adding a new column.
   */
  function flagOutliers(headers, rows, colName, method, threshold) {
    const ci = headers.indexOf(colName);
    if (ci === -1) return { headers, rows };

    const result = detectOutliers(rows, ci, method, threshold);
    const outlierSet = new Set(result.outlierIndices);

    const newHeaders = [...headers, `${colName}_Outlier`];
    const newRows = rows.map((r, i) => [...r, outlierSet.has(i) ? 'Yes' : 'No']);

    return { headers: newHeaders, rows: newRows, ...result };
  }

  /**
   * Remove outliers.
   */
  function removeOutliers(rows, colIndex, method, threshold) {
    const result = detectOutliers(rows, colIndex, method, threshold);
    const outlierSet = new Set(result.outlierIndices);
    return {
      rows: rows.filter((_, i) => !outlierSet.has(i)),
      removed: result.outlierCount
    };
  }

  // ===== CORRELATION MATRIX =====

  /**
   * Calculate correlation matrix for all numeric columns.
   * @returns {{ labels: string[], matrix: number[][] }}
   */
  function correlationMatrix(headers, rows, colTypes) {
    // Find numeric columns
    const numCols = [];
    headers.forEach((h, ci) => {
      if (colTypes[ci] && colTypes[ci].type === 'number') numCols.push({ name: h, ci });
    });

    const labels = numCols.map(c => c.name);
    const n = numCols.length;
    const matrix = Array.from({ length: n }, () => Array(n).fill(0));

    // Extract numeric arrays
    const colArrays = numCols.map(c => {
      return rows.map(r => {
        const v = r[c.ci];
        return (!isNull(v) && !isNaN(v)) ? Number(v) : null;
      });
    });

    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
          continue;
        }

        // Pearson correlation
        const pairs = [];
        for (let k = 0; k < rows.length; k++) {
          const a = colArrays[i][k], b = colArrays[j][k];
          if (a !== null && b !== null) pairs.push([a, b]);
        }

        if (pairs.length < 2) {
          matrix[i][j] = 0;
          matrix[j][i] = 0;
          continue;
        }

        const mx = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
        const my = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
        let sxy = 0, sx2 = 0, sy2 = 0;
        pairs.forEach(([x, y]) => {
          sxy += (x - mx) * (y - my);
          sx2 += (x - mx) ** 2;
          sy2 += (y - my) ** 2;
        });

        const denom = Math.sqrt(sx2 * sy2);
        const corr = denom ? Math.round(sxy / denom * 1000) / 1000 : 0;
        matrix[i][j] = corr;
        matrix[j][i] = corr;
      }
    }

    return { labels, matrix };
  }

  // ===== CROSS TABULATION =====

  /**
   * Cross-tabulate two categorical columns.
   * @returns {{ rowLabels, colLabels, matrix, totals }}
   */
  function crossTab(headers, rows, col1Name, col2Name) {
    const ci1 = headers.indexOf(col1Name);
    const ci2 = headers.indexOf(col2Name);
    if (ci1 === -1 || ci2 === -1) return null;

    const rowSet = new Set();
    const colSet = new Set();
    const counts = {};

    rows.forEach(r => {
      const v1 = isNull(r[ci1]) ? '(blank)' : String(r[ci1]);
      const v2 = isNull(r[ci2]) ? '(blank)' : String(r[ci2]);
      rowSet.add(v1);
      colSet.add(v2);
      const key = `${v1}|||${v2}`;
      counts[key] = (counts[key] || 0) + 1;
    });

    const rowLabels = [...rowSet].sort();
    const colLabels = [...colSet].sort();

    const matrix = rowLabels.map(rl =>
      colLabels.map(cl => counts[`${rl}|||${cl}`] || 0)
    );

    const rowTotals = matrix.map(r => r.reduce((a, b) => a + b, 0));
    const colTotals = colLabels.map((_, ci) => matrix.reduce((s, r) => s + r[ci], 0));

    return { rowLabels, colLabels, matrix, rowTotals, colTotals };
  }

  // ===== BINNING / BUCKETING =====

  /**
   * Create bins for a numeric column.
   */
  function createBins(headers, rows, colName, numBins = 5) {
    const ci = headers.indexOf(colName);
    if (ci === -1) return { headers, rows };

    const nums = [];
    rows.forEach(r => {
      const v = r[ci];
      if (!isNull(v) && !isNaN(v)) nums.push(Number(v));
    });

    if (nums.length === 0) return { headers: [...headers, `${colName}_Bin`], rows: rows.map(r => [...r, null]) };

    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const binWidth = (max - min) / numBins;

    const newHeaders = [...headers, `${colName}_Bin`];
    const newRows = rows.map(r => {
      const v = r[ci];
      if (isNull(v) || isNaN(v)) return [...r, null];
      const n = Number(v);
      const binIdx = Math.min(Math.floor((n - min) / binWidth), numBins - 1);
      const binStart = Math.round((min + binIdx * binWidth) * 100) / 100;
      const binEnd = Math.round((min + (binIdx + 1) * binWidth) * 100) / 100;
      return [...r, `${binStart}–${binEnd}`];
    });

    return { headers: newHeaders, rows: newRows };
  }

  // ===== DUPLICATE ANALYSIS =====

  function duplicateAnalysis(headers, rows) {
    const freq = {};
    rows.forEach((r, i) => {
      const key = JSON.stringify(r);
      if (!freq[key]) freq[key] = [];
      freq[key].push(i);
    });

    const duplicateGroups = Object.values(freq).filter(g => g.length > 1);
    const totalDuplicateRows = duplicateGroups.reduce((s, g) => s + g.length - 1, 0);

    return {
      totalDuplicateRows,
      duplicateGroups: duplicateGroups.length,
      details: duplicateGroups.slice(0, 20).map(indices => ({
        count: indices.length,
        firstRow: indices[0] + 1,
        sample: rows[indices[0]].slice(0, 5)
      }))
    };
  }

  return {
    groupBy,
    groupByMulti,
    profile,
    valueDistribution,
    detectOutliers,
    flagOutliers,
    removeOutliers,
    correlationMatrix,
    crossTab,
    createBins,
    duplicateAnalysis
  };
})();
