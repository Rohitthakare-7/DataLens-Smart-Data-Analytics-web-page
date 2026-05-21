/**
 * operations.js — Data cleaning, sorting, filtering, column management, find & replace
 */

const Operations = (() => {

  // ===== CLEANING =====

  /**
   * Remove duplicate rows. Returns { rows, removed }
   */
  function removeDuplicates(rows) {
    const seen = new Set();
    const unique = [];
    let removed = 0;

    rows.forEach(row => {
      const key = JSON.stringify(row);
      if (seen.has(key)) {
        removed++;
      } else {
        seen.add(key);
        unique.push(row);
      }
    });

    return { rows: unique, removed };
  }

  /**
   * Handle missing values.
   * @param {string[]} headers
   * @param {any[][]} rows
   * @param {string} strategy — 'drop'|'mean'|'median'|'mode'|'custom'|'ffill'|'bfill'
   * @param {string} column — column name or '__all__'
   * @param {*} customValue
   */
  function handleMissing(headers, rows, strategy, column, customValue) {
    const colIndices = column === '__all__'
      ? headers.map((_, i) => i)
      : [headers.indexOf(column)];

    if (colIndices.includes(-1)) return { rows, affected: 0 };

    let affected = 0;

    if (strategy === 'drop') {
      const before = rows.length;
      const filtered = rows.filter(row => {
        return !colIndices.some(ci => {
          const v = row[ci];
          return v === null || v === undefined || String(v).trim() === '';
        });
      });
      affected = before - filtered.length;
      return { rows: filtered, affected };
    }

    // Deep copy rows for mutation
    const newRows = rows.map(r => [...r]);

    if (strategy === 'mean' || strategy === 'median') {
      colIndices.forEach(ci => {
        const nums = [];
        newRows.forEach(r => {
          const v = r[ci];
          if (v !== null && v !== undefined && String(v).trim() !== '' && !isNaN(v)) {
            nums.push(Number(v));
          }
        });

        let fillValue;
        if (strategy === 'mean') {
          fillValue = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
          fillValue = Math.round(fillValue * 1000) / 1000;
        } else {
          nums.sort((a, b) => a - b);
          const mid = Math.floor(nums.length / 2);
          fillValue = nums.length
            ? (nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2)
            : 0;
        }

        newRows.forEach(r => {
          const v = r[ci];
          if (v === null || v === undefined || String(v).trim() === '') {
            r[ci] = fillValue;
            affected++;
          }
        });
      });
    }

    if (strategy === 'mode') {
      colIndices.forEach(ci => {
        const freq = {};
        newRows.forEach(r => {
          const v = r[ci];
          if (v !== null && v !== undefined && String(v).trim() !== '') {
            const key = String(v);
            freq[key] = (freq[key] || 0) + 1;
          }
        });

        let modeVal = null;
        let maxFreq = 0;
        Object.entries(freq).forEach(([k, count]) => {
          if (count > maxFreq) { maxFreq = count; modeVal = k; }
        });

        if (modeVal !== null) {
          // Try to preserve numeric type
          const asNum = Number(modeVal);
          if (!isNaN(asNum) && String(asNum) === modeVal) modeVal = asNum;
        }

        newRows.forEach(r => {
          const v = r[ci];
          if (v === null || v === undefined || String(v).trim() === '') {
            r[ci] = modeVal;
            affected++;
          }
        });
      });
    }

    if (strategy === 'custom') {
      colIndices.forEach(ci => {
        newRows.forEach(r => {
          const v = r[ci];
          if (v === null || v === undefined || String(v).trim() === '') {
            r[ci] = customValue;
            affected++;
          }
        });
      });
    }

    if (strategy === 'ffill') {
      colIndices.forEach(ci => {
        let last = null;
        newRows.forEach(r => {
          const v = r[ci];
          if (v === null || v === undefined || String(v).trim() === '') {
            if (last !== null) { r[ci] = last; affected++; }
          } else {
            last = v;
          }
        });
      });
    }

    if (strategy === 'bfill') {
      colIndices.forEach(ci => {
        let last = null;
        for (let i = newRows.length - 1; i >= 0; i--) {
          const v = newRows[i][ci];
          if (v === null || v === undefined || String(v).trim() === '') {
            if (last !== null) { newRows[i][ci] = last; affected++; }
          } else {
            last = v;
          }
        }
      });
    }

    return { rows: newRows, affected };
  }

  /**
   * Trim whitespace from all text cells.
   */
  function trimWhitespace(rows) {
    let affected = 0;
    const newRows = rows.map(r =>
      r.map(v => {
        if (typeof v === 'string') {
          const trimmed = v.trim();
          if (trimmed !== v) affected++;
          return trimmed;
        }
        return v;
      })
    );
    return { rows: newRows, affected };
  }

  /**
   * Remove rows that are entirely empty/null.
   */
  function removeEmptyRows(rows) {
    const before = rows.length;
    const filtered = rows.filter(row =>
      row.some(v => v !== null && v !== undefined && String(v).trim() !== '')
    );
    return { rows: filtered, removed: before - filtered.length };
  }

  /**
   * Remove columns that are entirely empty/null.
   */
  function removeEmptyColumns(headers, rows) {
    const keep = [];
    headers.forEach((h, ci) => {
      const hasData = rows.some(r => {
        const v = r[ci];
        return v !== null && v !== undefined && String(v).trim() !== '';
      });
      if (hasData) keep.push(ci);
    });

    const removedCount = headers.length - keep.length;
    const newHeaders = keep.map(ci => headers[ci]);
    const newRows = rows.map(r => keep.map(ci => r[ci]));

    return { headers: newHeaders, rows: newRows, removed: removedCount };
  }

  // ===== SORTING =====

  /**
   * Sort rows by a column.
   */
  function sortByColumn(headers, rows, colName, order) {
    const ci = headers.indexOf(colName);
    if (ci === -1) return rows;

    const sorted = [...rows].sort((a, b) => {
      let va = a[ci];
      let vb = b[ci];

      // Handle nulls — push to end
      const aNull = va === null || va === undefined || String(va).trim() === '';
      const bNull = vb === null || vb === undefined || String(vb).trim() === '';
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;

      // Numeric comparison
      const numA = Number(va);
      const numB = Number(vb);
      if (!isNaN(numA) && !isNaN(numB)) {
        return order === 'asc' ? numA - numB : numB - numA;
      }

      // String comparison
      const strA = String(va).toLowerCase();
      const strB = String(vb).toLowerCase();
      const cmp = strA.localeCompare(strB);
      return order === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }

  // ===== FILTERING =====

  /**
   * Filter rows by condition.
   */
  function filterRows(headers, rows, colName, condition, value, value2) {
    const ci = headers.indexOf(colName);
    if (ci === -1) return rows;

    return rows.filter(row => {
      const cell = row[ci];
      const cellStr = cell != null ? String(cell) : '';
      const cellNum = Number(cell);
      const valStr = value != null ? String(value) : '';
      const valNum = Number(value);

      switch (condition) {
        case 'equals':
          return cellStr.toLowerCase() === valStr.toLowerCase();
        case 'not_equals':
          return cellStr.toLowerCase() !== valStr.toLowerCase();
        case 'contains':
          return cellStr.toLowerCase().includes(valStr.toLowerCase());
        case 'not_contains':
          return !cellStr.toLowerCase().includes(valStr.toLowerCase());
        case 'gt':
          return !isNaN(cellNum) && !isNaN(valNum) && cellNum > valNum;
        case 'gte':
          return !isNaN(cellNum) && !isNaN(valNum) && cellNum >= valNum;
        case 'lt':
          return !isNaN(cellNum) && !isNaN(valNum) && cellNum < valNum;
        case 'lte':
          return !isNaN(cellNum) && !isNaN(valNum) && cellNum <= valNum;
        case 'between': {
          const v2Num = Number(value2);
          return !isNaN(cellNum) && !isNaN(valNum) && !isNaN(v2Num) && cellNum >= valNum && cellNum <= v2Num;
        }
        case 'empty':
          return cell === null || cell === undefined || cellStr.trim() === '';
        case 'not_empty':
          return cell !== null && cell !== undefined && cellStr.trim() !== '';
        default:
          return true;
      }
    });
  }

  // ===== COLUMN MANAGEMENT =====

  function renameColumn(headers, oldName, newName) {
    const newHeaders = [...headers];
    const idx = newHeaders.indexOf(oldName);
    if (idx !== -1) newHeaders[idx] = newName;
    return newHeaders;
  }

  function deleteColumns(headers, rows, colNames) {
    const deleteIndices = new Set(colNames.map(n => headers.indexOf(n)).filter(i => i !== -1));
    const newHeaders = headers.filter((_, i) => !deleteIndices.has(i));
    const newRows = rows.map(r => r.filter((_, i) => !deleteIndices.has(i)));
    return { headers: newHeaders, rows: newRows };
  }

  function convertColumnType(headers, rows, colName, toType) {
    const ci = headers.indexOf(colName);
    if (ci === -1) return { rows, converted: 0 };

    let converted = 0;
    const newRows = rows.map(r => {
      const newRow = [...r];
      const val = newRow[ci];

      if (val === null || val === undefined || String(val).trim() === '') {
        return newRow;
      }

      if (toType === 'number') {
        const n = Number(val);
        if (!isNaN(n)) { newRow[ci] = n; converted++; }
      } else if (toType === 'text') {
        newRow[ci] = String(val);
        converted++;
      } else if (toType === 'date') {
        const d = new Date(val);
        if (!isNaN(d.getTime())) { newRow[ci] = d.toISOString().split('T')[0]; converted++; }
      }
      return newRow;
    });

    return { rows: newRows, converted };
  }

  function addComputedColumn(headers, rows, newName, operation, colAName, colBName) {
    const ciA = headers.indexOf(colAName);
    const ciB = headers.indexOf(colBName);
    if (ciA === -1 || ciB === -1) return { headers, rows, error: 'Column not found' };

    const newHeaders = [...headers, newName];
    const newRows = rows.map(r => {
      const a = r[ciA];
      const b = r[ciB];
      let result;

      switch (operation) {
        case 'sum':
          result = (Number(a) || 0) + (Number(b) || 0);
          break;
        case 'diff':
          result = (Number(a) || 0) - (Number(b) || 0);
          break;
        case 'product':
          result = (Number(a) || 0) * (Number(b) || 0);
          break;
        case 'divide':
          result = Number(b) ? (Number(a) || 0) / Number(b) : null;
          if (result !== null) result = Math.round(result * 1000) / 1000;
          break;
        case 'concat':
          result = `${a != null ? a : ''}${b != null ? b : ''}`;
          break;
        default:
          result = null;
      }

      return [...r, result];
    });

    return { headers: newHeaders, rows: newRows };
  }

  // ===== FIND & REPLACE =====

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Count matches without modifying data (for preview).
   */
  function countMatches(headers, rows, colName, findText, caseSensitive) {
    const colIndices = colName === '__all__'
      ? headers.map((_, i) => i)
      : [headers.indexOf(colName)];

    let matches = 0;
    let cellsMatched = 0;

    rows.forEach(r => {
      colIndices.forEach(ci => {
        if (ci === -1) return;
        const val = r[ci];
        if (val === null || val === undefined) return;

        const str = String(val);
        const flags = caseSensitive ? 'g' : 'gi';
        try {
          const regex = new RegExp(escapeRegExp(findText), flags);
          const found = str.match(regex);
          if (found) {
            matches += found.length;
            cellsMatched++;
          }
        } catch (e) { /* skip */ }
      });
    });

    return { matches, cellsMatched };
  }

  /**
   * Find and replace text — only modifies cells that actually match.
   */
  function findAndReplace(headers, rows, colName, findText, replaceText, caseSensitive) {
    const colIndices = colName === '__all__'
      ? headers.map((_, i) => i)
      : [headers.indexOf(colName)];

    let replacements = 0;

    const newRows = rows.map(r => {
      const newRow = [...r];
      colIndices.forEach(ci => {
        if (ci === -1) return;
        const val = newRow[ci];
        if (val === null || val === undefined) return;

        const str = String(val);
        let regex;
        try {
          const flags = caseSensitive ? 'g' : 'gi';
          regex = new RegExp(escapeRegExp(findText), flags);
        } catch (e) {
          return;
        }

        // Count replacements for this cell
        let cellReplacements = 0;
        const result = str.replace(regex, () => {
          cellReplacements++;
          replacements++;
          return replaceText;
        });

        // Only update cell if something actually changed
        if (cellReplacements > 0) {
          // Try to preserve numeric type
          const asNum = Number(result);
          if (result.trim() === '') {
            newRow[ci] = result;
          } else if (!isNaN(asNum) && isFinite(asNum)) {
            newRow[ci] = asNum;
          } else {
            newRow[ci] = result;
          }
        }
      });
      return newRow;
    });

    return { rows: newRows, replacements };
  }

  return {
    removeDuplicates,
    handleMissing,
    trimWhitespace,
    removeEmptyRows,
    removeEmptyColumns,
    sortByColumn,
    filterRows,
    renameColumn,
    deleteColumns,
    convertColumnType,
    addComputedColumn,
    countMatches,
    findAndReplace
  };
})();
