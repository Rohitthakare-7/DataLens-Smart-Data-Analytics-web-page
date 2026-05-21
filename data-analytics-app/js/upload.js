/**
 * upload.js — File upload & parsing (CSV + Excel)
 * Uses Papa Parse for CSV, SheetJS for Excel
 */

const Upload = (() => {
  /**
   * Parse a File object and return { headers: string[], rows: any[][] }
   */
  function parseFile(file) {
    return new Promise((resolve, reject) => {
      const ext = file.name.split('.').pop().toLowerCase();

      if (ext === 'csv') {
        Papa.parse(file, {
          header: false,
          skipEmptyLines: false,
          dynamicTyping: true,
          complete(results) {
            if (!results.data || results.data.length === 0) {
              return reject(new Error('File appears to be empty.'));
            }
            const headers = results.data[0].map((h, i) =>
              h != null && String(h).trim() !== '' ? String(h).trim() : `Column_${i + 1}`
            );
            const rows = results.data.slice(1);
            resolve({ headers, rows });
          },
          error(err) {
            reject(err);
          }
        });
      } else if (ext === 'xlsx' || ext === 'xls') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

            if (!json || json.length === 0) {
              return reject(new Error('Sheet appears to be empty.'));
            }

            const headers = json[0].map((h, i) =>
              h != null && String(h).trim() !== '' ? String(h).trim() : `Column_${i + 1}`
            );
            const rows = json.slice(1);

            // Normalize row lengths
            const colCount = headers.length;
            rows.forEach(row => {
              while (row.length < colCount) row.push(null);
              if (row.length > colCount) row.length = colCount;
            });

            resolve({ headers, rows });
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsArrayBuffer(file);
      } else {
        reject(new Error(`Unsupported file format: .${ext}`));
      }
    });
  }

  /**
   * Detect column data types from a sample of rows.
   * Returns array of { type: 'number'|'text'|'date'|'boolean', nullCount }
   */
  function detectTypes(headers, rows) {
    const colMeta = headers.map(() => ({
      type: 'text',
      nullCount: 0,
      numCount: 0,
      dateCount: 0,
      boolCount: 0,
      textCount: 0
    }));

    const sampleSize = Math.min(rows.length, 200);

    for (let r = 0; r < sampleSize; r++) {
      const row = rows[r];
      for (let c = 0; c < headers.length; c++) {
        const val = row[c];

        if (val === null || val === undefined || String(val).trim() === '') {
          colMeta[c].nullCount++;
          continue;
        }

        const sVal = String(val).trim().toLowerCase();

        // Boolean check
        if (['true', 'false', 'yes', 'no', '1', '0'].includes(sVal) && typeof val !== 'number') {
          colMeta[c].boolCount++;
          continue;
        }

        // Number check
        if (typeof val === 'number' || (!isNaN(val) && !isNaN(parseFloat(val)))) {
          colMeta[c].numCount++;
          continue;
        }

        // Date check
        const d = new Date(val);
        if (!isNaN(d.getTime()) && sVal.length > 4) {
          colMeta[c].dateCount++;
          continue;
        }

        colMeta[c].textCount++;
      }
    }

    // Total nulls across full dataset
    for (let r = sampleSize; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < headers.length; c++) {
        const val = row[c];
        if (val === null || val === undefined || String(val).trim() === '') {
          colMeta[c].nullCount++;
        }
      }
    }

    return colMeta.map(m => {
      const total = m.numCount + m.dateCount + m.boolCount + m.textCount;
      if (total === 0) return { type: 'text', nullCount: m.nullCount };
      const dominant = Math.max(m.numCount, m.dateCount, m.boolCount, m.textCount);
      let type = 'text';
      if (dominant === m.numCount) type = 'number';
      else if (dominant === m.dateCount) type = 'date';
      else if (dominant === m.boolCount) type = 'boolean';
      return { type, nullCount: m.nullCount };
    });
  }

  /**
   * Format file size to human-readable
   */
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  return { parseFile, detectTypes, formatSize };
})();
