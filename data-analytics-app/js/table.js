/**
 * table.js — Data table rendering with pagination
 */

const Table = (() => {
  const PAGE_SIZE = 50;
  let currentPage = 1;

  /**
   * Render the data table for the given page.
   * @param {string[]} headers
   * @param {any[][]} rows
   * @param {object[]} colTypes — from Upload.detectTypes
   * @param {number} page — 1-indexed
   * @param {HTMLElement} container — #tableContainer
   * @param {HTMLElement} paginationEl — #pagination
   */
  function render(headers, rows, colTypes, page, container, paginationEl) {
    currentPage = page;
    const totalRows = rows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, totalRows);
    const pageRows = rows.slice(startIdx, endIdx);

    // Build table HTML
    let html = '<table class="data-table"><thead><tr>';
    html += '<th class="row-number">#</th>';

    headers.forEach((h, i) => {
      const typeClass = colTypes[i] ? colTypes[i].type : 'text';
      html += `<th data-col="${i}">${escapeHtml(h)}`;
      html += ` <span class="type-badge ${typeClass}">${typeClass}</span>`;
      html += ` <span class="sort-indicator">⇅</span>`;
      html += '</th>';
    });

    html += '</tr></thead><tbody>';

    pageRows.forEach((row, ri) => {
      html += '<tr>';
      html += `<td class="row-number">${startIdx + ri + 1}</td>`;
      for (let c = 0; c < headers.length; c++) {
        const val = row[c];
        if (val === null || val === undefined || String(val).trim() === '') {
          html += '<td class="null-value">null</td>';
        } else {
          html += `<td>${escapeHtml(String(val))}</td>`;
        }
      }
      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    // Pagination
    renderPagination(totalRows, totalPages, paginationEl);
  }

  function renderPagination(totalRows, totalPages, el) {
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, totalRows);

    let html = `<div class="pagination-info">Showing ${startIdx + 1}–${endIdx} of ${totalRows.toLocaleString()} rows</div>`;
    html += '<div class="pagination-controls">';

    html += `<button class="page-btn" data-page="1" ${currentPage === 1 ? 'disabled' : ''}>«</button>`;
    html += `<button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>‹</button>`;

    // Page numbers
    const range = getPageRange(currentPage, totalPages);
    range.forEach(p => {
      if (p === '...') {
        html += '<span style="padding:0 4px;color:var(--text-muted);">…</span>';
      } else {
        html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
      }
    });

    html += `<button class="page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>›</button>`;
    html += `<button class="page-btn" data-page="${totalPages}" ${currentPage === totalPages ? 'disabled' : ''}>»</button>`;
    html += '</div>';

    el.innerHTML = html;
  }

  function getPageRange(current, total) {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages = [];
    pages.push(1);
    if (current > 3) pages.push('...');
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
      pages.push(p);
    }
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getCurrentPage() {
    return currentPage;
  }

  return { render, getCurrentPage, PAGE_SIZE };
})();
