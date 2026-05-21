/**
 * formulas.js — Comprehensive formula engine (Google Sheets + Power BI style)
 * Supports 50+ formulas across 7 categories
 */

const Formulas = (() => {

  // ========== HELPERS ==========

  function isNull(v) {
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
  }

  function getColValues(rows, ci) {
    return rows.map(r => r[ci]);
  }

  function getNumericValues(rows, ci) {
    const nums = [];
    rows.forEach(r => {
      const v = r[ci];
      if (!isNull(v) && !isNaN(v)) nums.push(Number(v));
    });
    return nums;
  }

  function round(v, decimals = 4) {
    if (typeof v !== 'number' || isNaN(v)) return v;
    const f = Math.pow(10, decimals);
    return Math.round(v * f) / f;
  }

  function median(sorted) {
    if (sorted.length === 0) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function matchesCriteria(cellVal, criteria) {
    if (isNull(cellVal)) return false;
    const cv = String(cellVal).toLowerCase();
    const cr = String(criteria).toLowerCase().trim();

    // Operator-based: >100, <50, >=10, <=20, <>abc, =xyz
    if (cr.startsWith('>=')) { const n = Number(cr.slice(2)); return !isNaN(n) && Number(cellVal) >= n; }
    if (cr.startsWith('<=')) { const n = Number(cr.slice(2)); return !isNaN(n) && Number(cellVal) <= n; }
    if (cr.startsWith('<>')) { return cv !== cr.slice(2).toLowerCase(); }
    if (cr.startsWith('>'))  { const n = Number(cr.slice(1)); return !isNaN(n) && Number(cellVal) > n; }
    if (cr.startsWith('<'))  { const n = Number(cr.slice(1)); return !isNaN(n) && Number(cellVal) < n; }
    if (cr.startsWith('='))  { return cv === cr.slice(1).toLowerCase(); }

    // Wildcard support: * matches any characters
    if (cr.includes('*')) {
      const regexStr = '^' + cr.replace(/\*/g, '.*') + '$';
      try { return new RegExp(regexStr, 'i').test(cv); } catch(e) { return false; }
    }

    // Exact match
    return cv === cr;
  }

  // ========== FORMULA CATALOG ==========

  const CATALOG = [

    // ===== MATH & ARITHMETIC =====
    { key: 'SUM', name: 'SUM', category: 'math', type: 'aggregate',
      desc: 'Adds all numbers in a column.',
      syntax: 'SUM(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const nums = getNumericValues(rows, h.indexOf(p.col));
        return { value: round(nums.reduce((a, b) => a + b, 0)) };
      }
    },
    { key: 'AVERAGE', name: 'AVERAGE', category: 'math', type: 'aggregate',
      desc: 'Calculates the arithmetic mean of numbers in a column.',
      syntax: 'AVERAGE(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const nums = getNumericValues(rows, h.indexOf(p.col));
        return { value: nums.length ? round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0 };
      }
    },
    { key: 'COUNT', name: 'COUNT', category: 'math', type: 'aggregate',
      desc: 'Counts the number of numeric values in a column.',
      syntax: 'COUNT(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        return { value: getNumericValues(rows, h.indexOf(p.col)).length };
      }
    },
    { key: 'COUNTA', name: 'COUNTA', category: 'math', type: 'aggregate',
      desc: 'Counts non-empty cells in a column.',
      syntax: 'COUNTA(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { value: rows.filter(r => !isNull(r[ci])).length };
      }
    },
    { key: 'COUNTBLANK', name: 'COUNTBLANK', category: 'math', type: 'aggregate',
      desc: 'Counts empty/blank cells in a column.',
      syntax: 'COUNTBLANK(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { value: rows.filter(r => isNull(r[ci])).length };
      }
    },
    { key: 'MIN', name: 'MIN', category: 'math', type: 'aggregate',
      desc: 'Returns the smallest number in a column.',
      syntax: 'MIN(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const nums = getNumericValues(rows, h.indexOf(p.col));
        return { value: nums.length ? Math.min(...nums) : null };
      }
    },
    { key: 'MAX', name: 'MAX', category: 'math', type: 'aggregate',
      desc: 'Returns the largest number in a column.',
      syntax: 'MAX(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const nums = getNumericValues(rows, h.indexOf(p.col));
        return { value: nums.length ? Math.max(...nums) : null };
      }
    },
    { key: 'PRODUCT', name: 'PRODUCT', category: 'math', type: 'aggregate',
      desc: 'Multiplies all numbers in a column.',
      syntax: 'PRODUCT(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const nums = getNumericValues(rows, h.indexOf(p.col));
        return { value: nums.length ? round(nums.reduce((a, b) => a * b, 1)) : 0 };
      }
    },
    { key: 'ROUND', name: 'ROUND', category: 'math', type: 'transform',
      desc: 'Rounds each number to a specified number of decimal places.',
      syntax: 'ROUND(column, decimals)',
      params: [
        { key: 'col', label: 'Column', type: 'column' },
        { key: 'decimals', label: 'Decimals', type: 'number', default: 2 }
      ],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        const dec = parseInt(p.decimals) || 0;
        return { column: rows.map(r => {
          const v = r[ci]; if (isNull(v) || isNaN(v)) return v;
          return round(Number(v), dec);
        }), columnName: `ROUND(${p.col},${dec})` };
      }
    },
    { key: 'ABS', name: 'ABS', category: 'math', type: 'transform',
      desc: 'Returns the absolute value of each number.',
      syntax: 'ABS(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => {
          const v = r[ci]; if (isNull(v) || isNaN(v)) return v;
          return Math.abs(Number(v));
        }), columnName: `ABS(${p.col})` };
      }
    },
    { key: 'SQRT', name: 'SQRT', category: 'math', type: 'transform',
      desc: 'Returns the square root of each number.',
      syntax: 'SQRT(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => {
          const v = r[ci]; if (isNull(v) || isNaN(v)) return v;
          const n = Number(v); return n >= 0 ? round(Math.sqrt(n)) : null;
        }), columnName: `SQRT(${p.col})` };
      }
    },
    { key: 'POWER', name: 'POWER', category: 'math', type: 'transform',
      desc: 'Raises each number to the specified power.',
      syntax: 'POWER(column, exponent)',
      params: [
        { key: 'col', label: 'Column', type: 'column' },
        { key: 'exp', label: 'Exponent', type: 'number', default: 2 }
      ],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        const exp = Number(p.exp) || 2;
        return { column: rows.map(r => {
          const v = r[ci]; if (isNull(v) || isNaN(v)) return v;
          return round(Math.pow(Number(v), exp));
        }), columnName: `POWER(${p.col},${exp})` };
      }
    },
    { key: 'MOD', name: 'MOD', category: 'math', type: 'transform',
      desc: 'Returns the remainder after division by a number.',
      syntax: 'MOD(column, divisor)',
      params: [
        { key: 'col', label: 'Column', type: 'column' },
        { key: 'divisor', label: 'Divisor', type: 'number', default: 2 }
      ],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        const d = Number(p.divisor) || 1;
        return { column: rows.map(r => {
          const v = r[ci]; if (isNull(v) || isNaN(v)) return v;
          return Number(v) % d;
        }), columnName: `MOD(${p.col},${d})` };
      }
    },
    { key: 'INT', name: 'INT', category: 'math', type: 'transform',
      desc: 'Truncates each number to an integer.',
      syntax: 'INT(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => {
          const v = r[ci]; if (isNull(v) || isNaN(v)) return v;
          return Math.trunc(Number(v));
        }), columnName: `INT(${p.col})` };
      }
    },
    { key: 'CEILING', name: 'CEILING', category: 'math', type: 'transform',
      desc: 'Rounds each number up to the nearest multiple of significance.',
      syntax: 'CEILING(column, significance)',
      params: [
        { key: 'col', label: 'Column', type: 'column' },
        { key: 'sig', label: 'Significance', type: 'number', default: 1 }
      ],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        const s = Number(p.sig) || 1;
        return { column: rows.map(r => {
          const v = r[ci]; if (isNull(v) || isNaN(v)) return v;
          return Math.ceil(Number(v) / s) * s;
        }), columnName: `CEILING(${p.col},${s})` };
      }
    },
    { key: 'FLOOR', name: 'FLOOR', category: 'math', type: 'transform',
      desc: 'Rounds each number down to the nearest multiple of significance.',
      syntax: 'FLOOR(column, significance)',
      params: [
        { key: 'col', label: 'Column', type: 'column' },
        { key: 'sig', label: 'Significance', type: 'number', default: 1 }
      ],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        const s = Number(p.sig) || 1;
        return { column: rows.map(r => {
          const v = r[ci]; if (isNull(v) || isNaN(v)) return v;
          return Math.floor(Number(v) / s) * s;
        }), columnName: `FLOOR(${p.col},${s})` };
      }
    },
    { key: 'LOG', name: 'LOG', category: 'math', type: 'transform',
      desc: 'Returns the logarithm of each number (base 10 by default).',
      syntax: 'LOG(column, base)',
      params: [
        { key: 'col', label: 'Column', type: 'column' },
        { key: 'base', label: 'Base', type: 'number', default: 10 }
      ],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        const base = Number(p.base) || 10;
        return { column: rows.map(r => {
          const v = r[ci]; if (isNull(v) || isNaN(v)) return v;
          const n = Number(v); return n > 0 ? round(Math.log(n) / Math.log(base)) : null;
        }), columnName: `LOG(${p.col},${base})` };
      }
    },
    { key: 'LN', name: 'LN', category: 'math', type: 'transform',
      desc: 'Returns the natural logarithm (base e) of each number.',
      syntax: 'LN(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => {
          const v = r[ci]; if (isNull(v) || isNaN(v)) return v;
          const n = Number(v); return n > 0 ? round(Math.log(n)) : null;
        }), columnName: `LN(${p.col})` };
      }
    },
    { key: 'EXP', name: 'EXP', category: 'math', type: 'transform',
      desc: 'Returns e raised to the power of each number.',
      syntax: 'EXP(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => {
          const v = r[ci]; if (isNull(v) || isNaN(v)) return v;
          return round(Math.exp(Number(v)));
        }), columnName: `EXP(${p.col})` };
      }
    },

    // ===== STATISTICS =====
    { key: 'MEDIAN', name: 'MEDIAN', category: 'statistics', type: 'aggregate',
      desc: 'Returns the middle value of sorted numbers in a column.',
      syntax: 'MEDIAN(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const nums = getNumericValues(rows, h.indexOf(p.col)).sort((a, b) => a - b);
        return { value: nums.length ? round(median(nums)) : null };
      }
    },
    { key: 'MODE', name: 'MODE', category: 'statistics', type: 'aggregate',
      desc: 'Returns the most frequently occurring value in a column.',
      syntax: 'MODE(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        const freq = {};
        rows.forEach(r => { const v = r[ci]; if (!isNull(v)) { freq[String(v)] = (freq[String(v)] || 0) + 1; }});
        let mode = null, maxF = 0;
        Object.entries(freq).forEach(([k, f]) => { if (f > maxF) { maxF = f; mode = k; } });
        const asNum = Number(mode); if (!isNaN(asNum) && mode !== null) mode = asNum;
        return { value: mode, extra: `(appears ${maxF} times)` };
      }
    },
    { key: 'STDEV', name: 'STDEV', category: 'statistics', type: 'aggregate',
      desc: 'Calculates the standard deviation of numbers in a column.',
      syntax: 'STDEV(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const nums = getNumericValues(rows, h.indexOf(p.col));
        if (nums.length < 2) return { value: 0 };
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        const variance = nums.reduce((s, v) => s + (v - mean) ** 2, 0) / (nums.length - 1);
        return { value: round(Math.sqrt(variance)) };
      }
    },
    { key: 'STDEVP', name: 'STDEVP', category: 'statistics', type: 'aggregate',
      desc: 'Standard deviation of the entire population (not sample).',
      syntax: 'STDEVP(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const nums = getNumericValues(rows, h.indexOf(p.col));
        if (!nums.length) return { value: 0 };
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        const variance = nums.reduce((s, v) => s + (v - mean) ** 2, 0) / nums.length;
        return { value: round(Math.sqrt(variance)) };
      }
    },
    { key: 'VAR', name: 'VAR', category: 'statistics', type: 'aggregate',
      desc: 'Calculates the sample variance of numbers in a column.',
      syntax: 'VAR(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const nums = getNumericValues(rows, h.indexOf(p.col));
        if (nums.length < 2) return { value: 0 };
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        return { value: round(nums.reduce((s, v) => s + (v - mean) ** 2, 0) / (nums.length - 1)) };
      }
    },
    { key: 'PERCENTILE', name: 'PERCENTILE', category: 'statistics', type: 'aggregate',
      desc: 'Returns the value at the given percentile.',
      syntax: 'PERCENTILE(column, percentile)',
      params: [
        { key: 'col', label: 'Column', type: 'column' },
        { key: 'pct', label: 'Percentile (0-1)', type: 'number', default: 0.5 }
      ],
      exec: (h, rows, p) => {
        const nums = getNumericValues(rows, h.indexOf(p.col)).sort((a, b) => a - b);
        const k = Number(p.pct) || 0.5;
        if (!nums.length) return { value: null };
        const idx = k * (nums.length - 1);
        const lo = Math.floor(idx), hi = Math.ceil(idx);
        return { value: lo === hi ? nums[lo] : round(nums[lo] + (nums[hi] - nums[lo]) * (idx - lo)) };
      }
    },
    { key: 'QUARTILE', name: 'QUARTILE', category: 'statistics', type: 'aggregate',
      desc: 'Returns the quartile value (1 = Q1, 2 = Median, 3 = Q3).',
      syntax: 'QUARTILE(column, quartile)',
      params: [
        { key: 'col', label: 'Column', type: 'column' },
        { key: 'q', label: 'Quartile (1-3)', type: 'number', default: 1 }
      ],
      exec: (h, rows, p) => {
        const nums = getNumericValues(rows, h.indexOf(p.col)).sort((a, b) => a - b);
        const q = parseInt(p.q) || 1;
        const k = q * 0.25;
        if (!nums.length) return { value: null };
        const idx = k * (nums.length - 1);
        const lo = Math.floor(idx), hi = Math.ceil(idx);
        return { value: lo === hi ? nums[lo] : round(nums[lo] + (nums[hi] - nums[lo]) * (idx - lo)) };
      }
    },
    { key: 'RANK', name: 'RANK', category: 'statistics', type: 'transform',
      desc: 'Returns the rank of each value within the column (1 = highest).',
      syntax: 'RANK(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        const vals = rows.map(r => r[ci]);
        const sorted = vals.filter(v => !isNull(v) && !isNaN(v)).map(Number).sort((a, b) => b - a);
        return { column: vals.map(v => {
          if (isNull(v) || isNaN(v)) return null;
          return sorted.indexOf(Number(v)) + 1;
        }), columnName: `RANK(${p.col})` };
      }
    },
    { key: 'CORREL', name: 'CORREL', category: 'statistics', type: 'aggregate',
      desc: 'Calculates the Pearson correlation coefficient between two columns.',
      syntax: 'CORREL(column_x, column_y)',
      params: [
        { key: 'col1', label: 'Column X', type: 'column' },
        { key: 'col2', label: 'Column Y', type: 'column' }
      ],
      exec: (h, rows, p) => {
        const ci1 = h.indexOf(p.col1), ci2 = h.indexOf(p.col2);
        const pairs = [];
        rows.forEach(r => {
          const a = r[ci1], b = r[ci2];
          if (!isNull(a) && !isNull(b) && !isNaN(a) && !isNaN(b)) pairs.push([Number(a), Number(b)]);
        });
        if (pairs.length < 2) return { value: null };
        const mx = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
        const my = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
        let sxy = 0, sx2 = 0, sy2 = 0;
        pairs.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sx2 += (x - mx) ** 2; sy2 += (y - my) ** 2; });
        const denom = Math.sqrt(sx2 * sy2);
        return { value: denom ? round(sxy / denom) : 0 };
      }
    },
    { key: 'LARGE', name: 'LARGE', category: 'statistics', type: 'aggregate',
      desc: 'Returns the k-th largest value in a column.',
      syntax: 'LARGE(column, k)',
      params: [
        { key: 'col', label: 'Column', type: 'column' },
        { key: 'k', label: 'K (position)', type: 'number', default: 1 }
      ],
      exec: (h, rows, p) => {
        const nums = getNumericValues(rows, h.indexOf(p.col)).sort((a, b) => b - a);
        const k = parseInt(p.k) || 1;
        return { value: k <= nums.length ? nums[k - 1] : null };
      }
    },
    { key: 'SMALL', name: 'SMALL', category: 'statistics', type: 'aggregate',
      desc: 'Returns the k-th smallest value in a column.',
      syntax: 'SMALL(column, k)',
      params: [
        { key: 'col', label: 'Column', type: 'column' },
        { key: 'k', label: 'K (position)', type: 'number', default: 1 }
      ],
      exec: (h, rows, p) => {
        const nums = getNumericValues(rows, h.indexOf(p.col)).sort((a, b) => a - b);
        const k = parseInt(p.k) || 1;
        return { value: k <= nums.length ? nums[k - 1] : null };
      }
    },

    // ===== TEXT =====
    { key: 'UPPER', name: 'UPPER', category: 'text', type: 'transform',
      desc: 'Converts text to UPPERCASE.',
      syntax: 'UPPER(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => { const v = r[ci]; return isNull(v) ? v : String(v).toUpperCase(); }),
          columnName: `UPPER(${p.col})` };
      }
    },
    { key: 'LOWER', name: 'LOWER', category: 'text', type: 'transform',
      desc: 'Converts text to lowercase.',
      syntax: 'LOWER(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => { const v = r[ci]; return isNull(v) ? v : String(v).toLowerCase(); }),
          columnName: `LOWER(${p.col})` };
      }
    },
    { key: 'PROPER', name: 'PROPER', category: 'text', type: 'transform',
      desc: 'Capitalizes the first letter of each word.',
      syntax: 'PROPER(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => {
          const v = r[ci]; if (isNull(v)) return v;
          return String(v).replace(/\b\w/g, c => c.toUpperCase());
        }), columnName: `PROPER(${p.col})` };
      }
    },
    { key: 'TRIM', name: 'TRIM', category: 'text', type: 'transform',
      desc: 'Removes leading and trailing spaces.',
      syntax: 'TRIM(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => { const v = r[ci]; return isNull(v) ? v : String(v).trim(); }),
          columnName: `TRIM(${p.col})` };
      }
    },
    { key: 'LEN', name: 'LEN', category: 'text', type: 'transform',
      desc: 'Returns the length of text in each cell.',
      syntax: 'LEN(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => { const v = r[ci]; return isNull(v) ? 0 : String(v).length; }),
          columnName: `LEN(${p.col})` };
      }
    },
    { key: 'LEFT', name: 'LEFT', category: 'text', type: 'transform',
      desc: 'Returns the first N characters of text.',
      syntax: 'LEFT(column, num_chars)',
      params: [
        { key: 'col', label: 'Column', type: 'column' },
        { key: 'n', label: 'Characters', type: 'number', default: 1 }
      ],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        const n = parseInt(p.n) || 1;
        return { column: rows.map(r => { const v = r[ci]; return isNull(v) ? v : String(v).substring(0, n); }),
          columnName: `LEFT(${p.col},${n})` };
      }
    },
    { key: 'RIGHT', name: 'RIGHT', category: 'text', type: 'transform',
      desc: 'Returns the last N characters of text.',
      syntax: 'RIGHT(column, num_chars)',
      params: [
        { key: 'col', label: 'Column', type: 'column' },
        { key: 'n', label: 'Characters', type: 'number', default: 1 }
      ],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        const n = parseInt(p.n) || 1;
        return { column: rows.map(r => { const v = r[ci]; return isNull(v) ? v : String(v).slice(-n); }),
          columnName: `RIGHT(${p.col},${n})` };
      }
    },
    { key: 'MID', name: 'MID', category: 'text', type: 'transform',
      desc: 'Extracts a substring from text starting at a position.',
      syntax: 'MID(column, start, length)',
      params: [
        { key: 'col', label: 'Column', type: 'column' },
        { key: 'start', label: 'Start Position', type: 'number', default: 1 },
        { key: 'len', label: 'Length', type: 'number', default: 5 }
      ],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        const st = Math.max(1, parseInt(p.start) || 1) - 1;
        const len = parseInt(p.len) || 5;
        return { column: rows.map(r => { const v = r[ci]; return isNull(v) ? v : String(v).substring(st, st + len); }),
          columnName: `MID(${p.col},${st + 1},${len})` };
      }
    },
    { key: 'CONCATENATE', name: 'CONCATENATE', category: 'text', type: 'transform',
      desc: 'Joins two columns with an optional separator.',
      syntax: 'CONCATENATE(col_a, col_b, separator)',
      params: [
        { key: 'col1', label: 'Column A', type: 'column' },
        { key: 'col2', label: 'Column B', type: 'column' },
        { key: 'sep', label: 'Separator', type: 'text', default: ' ' }
      ],
      exec: (h, rows, p) => {
        const ci1 = h.indexOf(p.col1), ci2 = h.indexOf(p.col2);
        const sep = p.sep || '';
        return { column: rows.map(r => {
          const a = isNull(r[ci1]) ? '' : String(r[ci1]);
          const b = isNull(r[ci2]) ? '' : String(r[ci2]);
          return a + sep + b;
        }), columnName: `CONCAT(${p.col1},${p.col2})` };
      }
    },
    { key: 'SUBSTITUTE', name: 'SUBSTITUTE', category: 'text', type: 'transform',
      desc: 'Replaces occurrences of text within each cell.',
      syntax: 'SUBSTITUTE(column, find, replace)',
      params: [
        { key: 'col', label: 'Column', type: 'column' },
        { key: 'find', label: 'Find Text', type: 'text' },
        { key: 'replace', label: 'Replace With', type: 'text', default: '' }
      ],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => {
          const v = r[ci]; if (isNull(v)) return v;
          return String(v).split(p.find).join(p.replace || '');
        }), columnName: `SUBSTITUTE(${p.col})` };
      }
    },
    { key: 'REPT', name: 'REPT', category: 'text', type: 'transform',
      desc: 'Repeats text a given number of times.',
      syntax: 'REPT(column, times)',
      params: [
        { key: 'col', label: 'Column', type: 'column' },
        { key: 'times', label: 'Times', type: 'number', default: 2 }
      ],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        const t = parseInt(p.times) || 2;
        return { column: rows.map(r => { const v = r[ci]; return isNull(v) ? v : String(v).repeat(t); }),
          columnName: `REPT(${p.col},${t})` };
      }
    },
    { key: 'VALUE', name: 'VALUE', category: 'text', type: 'transform',
      desc: 'Converts text to a number.',
      syntax: 'VALUE(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => { const v = r[ci]; if (isNull(v)) return null;
          const n = Number(String(v).replace(/[,$]/g, '')); return isNaN(n) ? null : n;
        }), columnName: `VALUE(${p.col})` };
      }
    },
    { key: 'TEXT', name: 'TEXT', category: 'text', type: 'transform',
      desc: 'Converts a value to text.',
      syntax: 'TEXT(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => { const v = r[ci]; return isNull(v) ? '' : String(v); }),
          columnName: `TEXT(${p.col})` };
      }
    },

    // ===== LOGICAL =====
    { key: 'IF', name: 'IF', category: 'logical', type: 'transform',
      desc: 'Returns one value if a condition is true and another if false.',
      syntax: 'IF(column operator value, true_result, false_result)',
      params: [
        { key: 'col', label: 'Column to Test', type: 'column' },
        { key: 'op', label: 'Operator', type: 'select', options: ['=', '!=', '>', '>=', '<', '<=', 'contains', 'is empty', 'is not empty'] },
        { key: 'testVal', label: 'Test Value', type: 'text', default: '' },
        { key: 'trueVal', label: 'If True', type: 'text', default: 'Yes' },
        { key: 'falseVal', label: 'If False', type: 'text', default: 'No' }
      ],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => {
          const v = r[ci];
          let result = false;
          const vn = Number(v), tn = Number(p.testVal);
          switch (p.op) {
            case '=': result = String(v).toLowerCase() === String(p.testVal).toLowerCase(); break;
            case '!=': result = String(v).toLowerCase() !== String(p.testVal).toLowerCase(); break;
            case '>': result = !isNaN(vn) && !isNaN(tn) && vn > tn; break;
            case '>=': result = !isNaN(vn) && !isNaN(tn) && vn >= tn; break;
            case '<': result = !isNaN(vn) && !isNaN(tn) && vn < tn; break;
            case '<=': result = !isNaN(vn) && !isNaN(tn) && vn <= tn; break;
            case 'contains': result = !isNull(v) && String(v).toLowerCase().includes(String(p.testVal).toLowerCase()); break;
            case 'is empty': result = isNull(v); break;
            case 'is not empty': result = !isNull(v); break;
          }
          const res = result ? p.trueVal : p.falseVal;
          const asNum = Number(res); return (!isNaN(asNum) && res.trim() !== '') ? asNum : res;
        }), columnName: `IF(${p.col})` };
      }
    },
    { key: 'IFS', name: 'IFS', category: 'logical', type: 'transform',
      desc: 'Tests multiple conditions — returns value for the first true condition.',
      syntax: 'IFS(column, val1→result1, val2→result2, default)',
      params: [
        { key: 'col', label: 'Column to Test', type: 'column' },
        { key: 'cond1', label: 'If value is', type: 'text' },
        { key: 'res1', label: 'Then return', type: 'text' },
        { key: 'cond2', label: 'Else if value is', type: 'text' },
        { key: 'res2', label: 'Then return', type: 'text' },
        { key: 'default', label: 'Otherwise', type: 'text', default: 'Other' }
      ],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => {
          const v = String(r[ci]).toLowerCase();
          if (p.cond1 && v === String(p.cond1).toLowerCase()) return p.res1;
          if (p.cond2 && v === String(p.cond2).toLowerCase()) return p.res2;
          return p.default || 'Other';
        }), columnName: `IFS(${p.col})` };
      }
    },
    { key: 'ISBLANK', name: 'ISBLANK', category: 'logical', type: 'transform',
      desc: 'Returns TRUE if the cell is empty, FALSE otherwise.',
      syntax: 'ISBLANK(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => isNull(r[ci]) ? 'TRUE' : 'FALSE'),
          columnName: `ISBLANK(${p.col})` };
      }
    },
    { key: 'ISNUMBER', name: 'ISNUMBER', category: 'logical', type: 'transform',
      desc: 'Returns TRUE if the cell contains a number, FALSE otherwise.',
      syntax: 'ISNUMBER(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => {
          const v = r[ci]; return (!isNull(v) && !isNaN(v)) ? 'TRUE' : 'FALSE';
        }), columnName: `ISNUMBER(${p.col})` };
      }
    },
    { key: 'IFERROR', name: 'IFERROR', category: 'logical', type: 'transform',
      desc: 'Returns a default value if the cell is empty/invalid, otherwise the cell value.',
      syntax: 'IFERROR(column, default_value)',
      params: [
        { key: 'col', label: 'Column', type: 'column' },
        { key: 'default', label: 'Default Value', type: 'text', default: '0' }
      ],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => {
          const v = r[ci]; return isNull(v) ? p.default : v;
        }), columnName: `IFERROR(${p.col})` };
      }
    },

    // ===== DATE & TIME =====
    { key: 'YEAR', name: 'YEAR', category: 'date', type: 'transform',
      desc: 'Extracts the year from a date column.',
      syntax: 'YEAR(column)',
      params: [{ key: 'col', label: 'Date Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => { const d = new Date(r[ci]); return isNaN(d) ? null : d.getFullYear(); }),
          columnName: `YEAR(${p.col})` };
      }
    },
    { key: 'MONTH', name: 'MONTH', category: 'date', type: 'transform',
      desc: 'Extracts the month (1–12) from a date column.',
      syntax: 'MONTH(column)',
      params: [{ key: 'col', label: 'Date Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => { const d = new Date(r[ci]); return isNaN(d) ? null : d.getMonth() + 1; }),
          columnName: `MONTH(${p.col})` };
      }
    },
    { key: 'DAY', name: 'DAY', category: 'date', type: 'transform',
      desc: 'Extracts the day of the month from a date column.',
      syntax: 'DAY(column)',
      params: [{ key: 'col', label: 'Date Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => { const d = new Date(r[ci]); return isNaN(d) ? null : d.getDate(); }),
          columnName: `DAY(${p.col})` };
      }
    },
    { key: 'WEEKDAY', name: 'WEEKDAY', category: 'date', type: 'transform',
      desc: 'Returns the day of the week (1=Sun, 7=Sat).',
      syntax: 'WEEKDAY(column)',
      params: [{ key: 'col', label: 'Date Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        return { column: rows.map(r => { const d = new Date(r[ci]); return isNaN(d) ? null : d.getDay() + 1; }),
          columnName: `WEEKDAY(${p.col})` };
      }
    },
    { key: 'DATEDIF', name: 'DATEDIF', category: 'date', type: 'transform',
      desc: 'Calculates the difference between two date columns.',
      syntax: 'DATEDIF(start_date, end_date, unit)',
      params: [
        { key: 'col1', label: 'Start Date Column', type: 'column' },
        { key: 'col2', label: 'End Date Column', type: 'column' },
        { key: 'unit', label: 'Unit', type: 'select', options: ['days', 'months', 'years'] }
      ],
      exec: (h, rows, p) => {
        const ci1 = h.indexOf(p.col1), ci2 = h.indexOf(p.col2);
        return { column: rows.map(r => {
          const d1 = new Date(r[ci1]), d2 = new Date(r[ci2]);
          if (isNaN(d1) || isNaN(d2)) return null;
          const diffMs = d2 - d1;
          if (p.unit === 'days') return Math.round(diffMs / 86400000);
          if (p.unit === 'months') return Math.round(diffMs / 86400000 / 30.44);
          return Math.round(diffMs / 86400000 / 365.25);
        }), columnName: `DATEDIF(${p.unit})` };
      }
    },
    { key: 'TODAY', name: 'TODAY', category: 'date', type: 'aggregate',
      desc: 'Returns today\'s date.',
      syntax: 'TODAY()',
      params: [],
      exec: () => ({ value: new Date().toISOString().split('T')[0] })
    },
    { key: 'NOW', name: 'NOW', category: 'date', type: 'aggregate',
      desc: 'Returns the current date and time.',
      syntax: 'NOW()',
      params: [],
      exec: () => ({ value: new Date().toISOString() })
    },

    // ===== CONDITIONAL AGGREGATES =====
    { key: 'SUMIF', name: 'SUMIF', category: 'conditional', type: 'aggregate',
      desc: 'Sums values where criteria is met. Criteria supports: =, >, <, >=, <=, <>, wildcards (*).',
      syntax: 'SUMIF(criteria_col, criteria, sum_col)',
      params: [
        { key: 'critCol', label: 'Criteria Column', type: 'column' },
        { key: 'criteria', label: 'Criteria (e.g. ">100", "Sales", "A*")', type: 'text' },
        { key: 'sumCol', label: 'Sum Column', type: 'column' }
      ],
      exec: (h, rows, p) => {
        const cci = h.indexOf(p.critCol), sci = h.indexOf(p.sumCol);
        let sum = 0;
        rows.forEach(r => {
          if (matchesCriteria(r[cci], p.criteria)) {
            const v = Number(r[sci]); if (!isNaN(v)) sum += v;
          }
        });
        return { value: round(sum) };
      }
    },
    { key: 'COUNTIF', name: 'COUNTIF', category: 'conditional', type: 'aggregate',
      desc: 'Counts cells where criteria is met.',
      syntax: 'COUNTIF(criteria_col, criteria)',
      params: [
        { key: 'critCol', label: 'Criteria Column', type: 'column' },
        { key: 'criteria', label: 'Criteria', type: 'text' }
      ],
      exec: (h, rows, p) => {
        const cci = h.indexOf(p.critCol);
        let count = 0;
        rows.forEach(r => { if (matchesCriteria(r[cci], p.criteria)) count++; });
        return { value: count };
      }
    },
    { key: 'AVERAGEIF', name: 'AVERAGEIF', category: 'conditional', type: 'aggregate',
      desc: 'Averages values where criteria is met.',
      syntax: 'AVERAGEIF(criteria_col, criteria, avg_col)',
      params: [
        { key: 'critCol', label: 'Criteria Column', type: 'column' },
        { key: 'criteria', label: 'Criteria', type: 'text' },
        { key: 'avgCol', label: 'Average Column', type: 'column' }
      ],
      exec: (h, rows, p) => {
        const cci = h.indexOf(p.critCol), aci = h.indexOf(p.avgCol);
        const nums = [];
        rows.forEach(r => {
          if (matchesCriteria(r[cci], p.criteria)) {
            const v = Number(r[aci]); if (!isNaN(v)) nums.push(v);
          }
        });
        return { value: nums.length ? round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0 };
      }
    },
    { key: 'MINIFS', name: 'MINIFS', category: 'conditional', type: 'aggregate',
      desc: 'Returns the minimum value where criteria is met.',
      syntax: 'MINIFS(value_col, criteria_col, criteria)',
      params: [
        { key: 'valCol', label: 'Value Column', type: 'column' },
        { key: 'critCol', label: 'Criteria Column', type: 'column' },
        { key: 'criteria', label: 'Criteria', type: 'text' }
      ],
      exec: (h, rows, p) => {
        const vci = h.indexOf(p.valCol), cci = h.indexOf(p.critCol);
        const nums = [];
        rows.forEach(r => {
          if (matchesCriteria(r[cci], p.criteria)) {
            const v = Number(r[vci]); if (!isNaN(v)) nums.push(v);
          }
        });
        return { value: nums.length ? Math.min(...nums) : null };
      }
    },
    { key: 'MAXIFS', name: 'MAXIFS', category: 'conditional', type: 'aggregate',
      desc: 'Returns the maximum value where criteria is met.',
      syntax: 'MAXIFS(value_col, criteria_col, criteria)',
      params: [
        { key: 'valCol', label: 'Value Column', type: 'column' },
        { key: 'critCol', label: 'Criteria Column', type: 'column' },
        { key: 'criteria', label: 'Criteria', type: 'text' }
      ],
      exec: (h, rows, p) => {
        const vci = h.indexOf(p.valCol), cci = h.indexOf(p.critCol);
        const nums = [];
        rows.forEach(r => {
          if (matchesCriteria(r[cci], p.criteria)) {
            const v = Number(r[vci]); if (!isNaN(v)) nums.push(v);
          }
        });
        return { value: nums.length ? Math.max(...nums) : null };
      }
    },
    { key: 'SUMIFS', name: 'SUMIFS', category: 'conditional', type: 'aggregate',
      desc: 'Sums values where multiple criteria are met.',
      syntax: 'SUMIFS(sum_col, criteria_col1, criteria1, criteria_col2, criteria2)',
      params: [
        { key: 'sumCol', label: 'Sum Column', type: 'column' },
        { key: 'critCol1', label: 'Criteria Column 1', type: 'column' },
        { key: 'crit1', label: 'Criteria 1', type: 'text' },
        { key: 'critCol2', label: 'Criteria Column 2', type: 'column' },
        { key: 'crit2', label: 'Criteria 2', type: 'text' }
      ],
      exec: (h, rows, p) => {
        const sci = h.indexOf(p.sumCol), cci1 = h.indexOf(p.critCol1), cci2 = h.indexOf(p.critCol2);
        let sum = 0;
        rows.forEach(r => {
          if (matchesCriteria(r[cci1], p.crit1) && matchesCriteria(r[cci2], p.crit2)) {
            const v = Number(r[sci]); if (!isNaN(v)) sum += v;
          }
        });
        return { value: round(sum) };
      }
    },
    { key: 'COUNTIFS', name: 'COUNTIFS', category: 'conditional', type: 'aggregate',
      desc: 'Counts cells where multiple criteria are met.',
      syntax: 'COUNTIFS(criteria_col1, criteria1, criteria_col2, criteria2)',
      params: [
        { key: 'critCol1', label: 'Criteria Column 1', type: 'column' },
        { key: 'crit1', label: 'Criteria 1', type: 'text' },
        { key: 'critCol2', label: 'Criteria Column 2', type: 'column' },
        { key: 'crit2', label: 'Criteria 2', type: 'text' }
      ],
      exec: (h, rows, p) => {
        const cci1 = h.indexOf(p.critCol1), cci2 = h.indexOf(p.critCol2);
        let count = 0;
        rows.forEach(r => { if (matchesCriteria(r[cci1], p.crit1) && matchesCriteria(r[cci2], p.crit2)) count++; });
        return { value: count };
      }
    },
    { key: 'AVERAGEIFS', name: 'AVERAGEIFS', category: 'conditional', type: 'aggregate',
      desc: 'Averages values where multiple criteria are met.',
      syntax: 'AVERAGEIFS(avg_col, criteria_col1, criteria1, criteria_col2, criteria2)',
      params: [
        { key: 'avgCol', label: 'Average Column', type: 'column' },
        { key: 'critCol1', label: 'Criteria Column 1', type: 'column' },
        { key: 'crit1', label: 'Criteria 1', type: 'text' },
        { key: 'critCol2', label: 'Criteria Column 2', type: 'column' },
        { key: 'crit2', label: 'Criteria 2', type: 'text' }
      ],
      exec: (h, rows, p) => {
        const aci = h.indexOf(p.avgCol), cci1 = h.indexOf(p.critCol1), cci2 = h.indexOf(p.critCol2);
        const nums = [];
        rows.forEach(r => {
          if (matchesCriteria(r[cci1], p.crit1) && matchesCriteria(r[cci2], p.crit2)) {
            const v = Number(r[aci]); if (!isNaN(v)) nums.push(v);
          }
        });
        return { value: nums.length ? round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0 };
      }
    },

    // ===== LOOKUP & REFERENCE =====
    { key: 'VLOOKUP', name: 'VLOOKUP', category: 'lookup', type: 'transform',
      desc: 'For each row, looks up a value in a reference column and returns the corresponding value from a return column.',
      syntax: 'VLOOKUP(lookup_col, ref_col, return_col)',
      params: [
        { key: 'lookupCol', label: 'Lookup Values Column', type: 'column' },
        { key: 'refCol', label: 'Reference Column (to search in)', type: 'column' },
        { key: 'returnCol', label: 'Return Column', type: 'column' }
      ],
      exec: (h, rows, p) => {
        const li = h.indexOf(p.lookupCol), ri = h.indexOf(p.refCol), rti = h.indexOf(p.returnCol);
        // Build lookup table from ref → return
        const lookupMap = {};
        rows.forEach(r => {
          const refVal = r[ri];
          if (!isNull(refVal)) lookupMap[String(refVal).toLowerCase()] = r[rti];
        });
        return { column: rows.map(r => {
          const lv = r[li];
          if (isNull(lv)) return null;
          return lookupMap[String(lv).toLowerCase()] ?? '#N/A';
        }), columnName: `VLOOKUP(${p.lookupCol})` };
      }
    },
    { key: 'XLOOKUP', name: 'XLOOKUP', category: 'lookup', type: 'transform',
      desc: 'Modern lookup: searches for a value and returns a match from a return column. Supports a default if not found.',
      syntax: 'XLOOKUP(lookup_col, ref_col, return_col, if_not_found)',
      params: [
        { key: 'lookupCol', label: 'Lookup Values Column', type: 'column' },
        { key: 'refCol', label: 'Search In Column', type: 'column' },
        { key: 'returnCol', label: 'Return From Column', type: 'column' },
        { key: 'notFound', label: 'If Not Found', type: 'text', default: '#N/A' }
      ],
      exec: (h, rows, p) => {
        const li = h.indexOf(p.lookupCol), ri = h.indexOf(p.refCol), rti = h.indexOf(p.returnCol);
        const lookupMap = {};
        rows.forEach(r => {
          const refVal = r[ri];
          if (!isNull(refVal)) lookupMap[String(refVal).toLowerCase()] = r[rti];
        });
        return { column: rows.map(r => {
          const lv = r[li];
          if (isNull(lv)) return null;
          return lookupMap[String(lv).toLowerCase()] ?? (p.notFound || '#N/A');
        }), columnName: `XLOOKUP(${p.lookupCol})` };
      }
    },
    { key: 'INDEX_MATCH', name: 'INDEX / MATCH', category: 'lookup', type: 'aggregate',
      desc: 'Finds the row where a column matches a value, and returns the value from another column at that row.',
      syntax: 'INDEX(return_col, MATCH(lookup_value, search_col))',
      params: [
        { key: 'searchCol', label: 'Search Column', type: 'column' },
        { key: 'searchVal', label: 'Search Value', type: 'text' },
        { key: 'returnCol', label: 'Return Column', type: 'column' }
      ],
      exec: (h, rows, p) => {
        const si = h.indexOf(p.searchCol), ri = h.indexOf(p.returnCol);
        const sv = String(p.searchVal).toLowerCase();
        for (const r of rows) {
          if (String(r[si]).toLowerCase() === sv) return { value: r[ri] };
        }
        return { value: '#N/A' };
      }
    },
    { key: 'UNIQUE', name: 'UNIQUE', category: 'lookup', type: 'aggregate',
      desc: 'Returns the count of unique values in a column and lists top values.',
      syntax: 'UNIQUE(column)',
      params: [{ key: 'col', label: 'Column', type: 'column' }],
      exec: (h, rows, p) => {
        const ci = h.indexOf(p.col);
        const unique = new Set(rows.filter(r => !isNull(r[ci])).map(r => String(r[ci])));
        const arr = [...unique].slice(0, 20);
        return { value: unique.size, extra: `Top values: ${arr.join(', ')}` };
      }
    },
  ];

  // ========== CATEGORY METADATA ==========
  const CATEGORY_META = {
    math:        { name: 'Math & Arithmetic', icon: '🔢' },
    statistics:  { name: 'Statistics',         icon: '📊' },
    text:        { name: 'Text',               icon: '📝' },
    logical:     { name: 'Logical',            icon: '🔀' },
    date:        { name: 'Date & Time',        icon: '📅' },
    conditional: { name: 'Conditional',        icon: '🎯' },
    lookup:      { name: 'Lookup & Reference', icon: '🔎' },
  };

  function getCategoryMeta() { return CATEGORY_META; }

  function getByCategory(cat) {
    return CATALOG.filter(f => f.category === cat);
  }

  function getByKey(key) {
    return CATALOG.find(f => f.key === key);
  }

  function getAllFormulas() {
    return CATALOG;
  }

  /**
   * Execute a formula.
   * @returns { type: 'aggregate'|'transform', value?, extra?, column?, columnName? }
   */
  function execute(key, headers, rows, paramValues) {
    const formula = getByKey(key);
    if (!formula) return { error: 'Formula not found' };

    try {
      const result = formula.exec(headers, rows, paramValues);
      return { type: formula.type, ...result };
    } catch (e) {
      return { error: e.message || 'Formula execution failed' };
    }
  }

  return { CATEGORY_META, getCategoryMeta, getByCategory, getByKey, getAllFormulas, execute };
})();
