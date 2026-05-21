/**
 * export.js — Export data in various formats
 */

const Export = (() => {

  /**
   * Download data as CSV.
   */
  function downloadCsv(headers, rows, filename) {
    const csvContent = Papa.unparse({
      fields: headers,
      data: rows
    });

    downloadBlob(csvContent, filename + '.csv', 'text/csv;charset=utf-8;');
  }

  /**
   * Download data as XLSX.
   */
  function downloadXlsx(headers, rows, filename) {
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Auto column widths
    const colWidths = headers.map((h, ci) => {
      let max = h.length;
      rows.forEach(r => {
        const val = r[ci] != null ? String(r[ci]) : '';
        if (val.length > max) max = val.length;
      });
      return { wch: Math.min(max + 2, 40) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, filename + '.xlsx');
  }

  /**
   * Download data as JSON.
   */
  function downloadJson(headers, rows, filename) {
    const jsonData = rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i];
      });
      return obj;
    });

    const content = JSON.stringify(jsonData, null, 2);
    downloadBlob(content, filename + '.json', 'application/json;charset=utf-8;');
  }

  /**
   * Download text report.
   */
  function downloadReport(reportText, filename) {
    downloadBlob(reportText, filename + '_report.txt', 'text/plain;charset=utf-8;');
  }

  function downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return { downloadCsv, downloadXlsx, downloadJson, downloadReport };
})();
