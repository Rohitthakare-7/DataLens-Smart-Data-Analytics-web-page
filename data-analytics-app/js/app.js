/**
 * app.js — Main application controller & state management
 * Wires: Upload, Preview, Clean, Sort, Filter, Columns, Find & Replace,
 *        Formulas, Stats, Charts, Group By, Profiling, Outliers, Correlation,
 *        Cross Tab, Export, History
 */

(function () {
  'use strict';

  // ===== APPLICATION STATE =====
  const state = {
    originalHeaders: [],
    originalRows: [],
    headers: [],
    rows: [],
    colTypes: [],
    fileName: '',
    fileSize: 0,
    history: [],
    currentView: 'upload',
    isDataLoaded: false,
    selectedFormula: null,
  };

  // ===== DOM REFERENCES =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const views = {
    upload: $('#viewUpload'),
    preview: $('#viewPreview'),
    clean: $('#viewClean'),
    sort: $('#viewSort'),
    filter: $('#viewFilter'),
    columns: $('#viewColumns'),
    findreplace: $('#viewFindReplace'),
    formulas: $('#viewFormulas'),
    stats: $('#viewStats'),
    charts: $('#viewCharts'),
    groupby: $('#viewGroupby'),
    profiling: $('#viewProfiling'),
    outliers: $('#viewOutliers'),
    correlation: $('#viewCorrelation'),
    crosstab: $('#viewCrosstab'),
    export: $('#viewExport'),
    history: $('#viewHistory'),
  };

  // ===== TOAST =====
  function toast(message, type = 'info') {
    const container = $('#toastContainer');
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span class="toast-msg">${message}</span>`;
    container.appendChild(el);
    setTimeout(() => { el.classList.add('toast-out'); setTimeout(() => el.remove(), 300); }, 3500);
  }

  // ===== NAVIGATION =====
  function switchView(viewName) {
    if (!state.isDataLoaded && viewName !== 'upload') return;
    state.currentView = viewName;

    Object.values(views).forEach(v => { if (v) v.classList.remove('active'); });
    $$('.nav-item').forEach(n => n.classList.remove('active'));

    if (views[viewName]) views[viewName].classList.add('active');
    const navItem = $(`.nav-item[data-view="${viewName}"]`);
    if (navItem) navItem.classList.add('active');

    // Refresh view-specific content
    switch (viewName) {
      case 'preview': refreshTable(); break;
      case 'stats': refreshStats(); break;
      case 'clean': populateCleanSelects(); break;
      case 'sort': populateSortSelects(); break;
      case 'filter': populateFilterSelects(); break;
      case 'columns': populateColumnSelects(); break;
      case 'findreplace': populateFrSelects(); break;
      case 'formulas': renderFormulaCatalog(); break;
      case 'charts': populateChartSelects(); break;
      case 'groupby': populateGroupBySelects(); break;
      case 'profiling': refreshProfiling(); break;
      case 'outliers': populateOutlierSelects(); break;
      case 'correlation': /* on-demand */ break;
      case 'crosstab': populateCrossTabSelects(); break;
      case 'history': renderHistory(); break;
    }
  }

  function enableNavigation() {
    $$('.nav-item').forEach(item => item.classList.remove('disabled'));
  }

  $$('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      if (view) switchView(view);
    });
  });

  // ===== FILE UPLOAD =====
  const uploadZone = $('#uploadZone');
  const fileInput = $('#fileInput');
  const uploadBtn = $('#uploadBtn');

  uploadBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
  uploadZone.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
  uploadZone.addEventListener('drop', (e) => { e.preventDefault(); uploadZone.classList.remove('dragover'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

  $('#btnNewFile').addEventListener('click', () => {
    state.isDataLoaded = false;
    state.headers = []; state.rows = []; state.originalHeaders = []; state.originalRows = [];
    state.colTypes = []; state.history = []; state.fileName = ''; state.fileSize = 0;
    fileInput.value = '';
    $('#fileBadge').classList.remove('active');
    $('#btnNewFile').style.display = 'none';
    updateStatusBar();
    $$('.nav-item').forEach(item => { if (item.dataset.view !== 'upload') item.classList.add('disabled'); });
    switchView('upload');
  });

  async function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) { toast('Unsupported format. Use .csv, .xlsx, or .xls', 'error'); return; }
    setStatus('Parsing file…', true);
    try {
      const { headers, rows } = await Upload.parseFile(file);
      state.headers = [...headers]; state.rows = rows.map(r => [...r]);
      state.originalHeaders = [...headers]; state.originalRows = rows.map(r => [...r]);
      state.colTypes = Upload.detectTypes(headers, rows);
      state.fileName = file.name; state.fileSize = file.size;
      state.isDataLoaded = true; state.history = [];
      $('#fileName').textContent = file.name;
      $('#fileSize').textContent = Upload.formatSize(file.size);
      $('#fileBadge').classList.add('active');
      $('#btnNewFile').style.display = '';
      enableNavigation(); updateStatusBar();
      switchView('preview');
      toast(`Loaded ${rows.length.toLocaleString()} rows × ${headers.length} columns`, 'success');
    } catch (err) { toast('Failed to parse: ' + err.message, 'error'); }
    setStatus('Ready', false);
  }

  // ===== STATUS BAR =====
  function setStatus(text, busy) {
    $('#statusText').textContent = text;
    const dot = $('#statusDot');
    if (busy) { dot.classList.remove('idle'); dot.style.background = 'var(--accent-cyan)'; dot.style.animation = 'pulse 1s infinite'; }
    else { dot.style.animation = ''; if (state.isDataLoaded) { dot.classList.remove('idle'); dot.style.background = 'var(--accent-green)'; } else { dot.classList.add('idle'); dot.style.background = ''; } }
  }

  function updateStatusBar() {
    if (state.isDataLoaded) {
      $('#statusRows').textContent = `${state.rows.length.toLocaleString()} rows`;
      $('#statusCols').textContent = `${state.headers.length} cols`;
      $('#chipRows').textContent = `${state.rows.length.toLocaleString()} rows`;
      $('#chipCols').textContent = `${state.headers.length} columns`;
    } else { $('#statusRows').textContent = '—'; $('#statusCols').textContent = '—'; }
  }

  // ===== HISTORY / UNDO =====
  function pushHistory(label, icon) {
    state.history.push({ label, icon, time: new Date().toLocaleTimeString(),
      snapshot: { headers: [...state.headers], rows: state.rows.map(r => [...r]) }
    });
    const badge = $('#historyBadge'); badge.textContent = state.history.length; badge.style.display = '';
  }

  function undoLast() {
    if (!state.history.length) { toast('Nothing to undo', 'info'); return; }
    const last = state.history.pop();
    state.headers = last.snapshot.headers; state.rows = last.snapshot.rows;
    state.colTypes = Upload.detectTypes(state.headers, state.rows);
    updateStatusBar(); toast(`Undone: ${last.label}`, 'info');
    const badge = $('#historyBadge'); badge.textContent = state.history.length;
    if (!state.history.length) badge.style.display = 'none';
    switchView(state.currentView);
  }

  function resetAll() {
    if (!state.originalRows.length) return;
    state.headers = [...state.originalHeaders]; state.rows = state.originalRows.map(r => [...r]);
    state.colTypes = Upload.detectTypes(state.headers, state.rows);
    state.history = []; updateStatusBar();
    const badge = $('#historyBadge'); badge.textContent = '0'; badge.style.display = 'none';
    toast('Data reset to original', 'success'); switchView(state.currentView);
  }

  // ===== TABLE PREVIEW =====
  function refreshTable() {
    if (!state.isDataLoaded) return;
    Table.render(state.headers, state.rows, state.colTypes, Table.getCurrentPage(), $('#tableContainer'), $('#pagination'));
    bindTableEvents();
  }

  function bindTableEvents() {
    $$('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page);
        if (page && !btn.disabled) {
          Table.render(state.headers, state.rows, state.colTypes, page, $('#tableContainer'), $('#pagination'));
          bindTableEvents();
        }
      });
    });
    $$('.data-table th[data-col]').forEach(th => {
      th.addEventListener('click', () => {
        const ci = parseInt(th.dataset.col);
        const colName = state.headers[ci];
        const order = th.classList.contains('sorted-asc') ? 'desc' : 'asc';
        pushHistory(`Sort by ${colName} (${order})`, '🔀');
        state.rows = Operations.sortByColumn(state.headers, state.rows, colName, order);
        Table.render(state.headers, state.rows, state.colTypes, 1, $('#tableContainer'), $('#pagination'));
        bindTableEvents();
        toast(`Sorted by ${colName} (${order})`, 'success');
      });
    });
  }

  // ===== HELPERS =====
  function populateSelect(sel, headers, addAll) {
    sel.innerHTML = '';
    if (addAll) { const o = document.createElement('option'); o.value = '__all__'; o.textContent = 'All Columns'; sel.appendChild(o); }
    headers.forEach(h => { const o = document.createElement('option'); o.value = h; o.textContent = h; sel.appendChild(o); });
  }

  function showResult(id, success, msg) {
    const el = $(`#${id}`);
    if (!el) return;
    el.innerHTML = `<div class="result-banner ${success ? 'success' : 'error'}"><span class="result-icon">${success ? '✅' : '❌'}</span><span>${msg}</span></div>`;
    setTimeout(() => { if (el.querySelector('.result-banner')) el.innerHTML = ''; }, 8000);
  }

  function escHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

  // ===== CLEANING =====
  function populateCleanSelects() { populateSelect($('#missingCol'), state.headers, true); }

  $('#btnRemoveDuplicates').addEventListener('click', () => {
    pushHistory('Remove duplicates', '🗑️');
    const r = Operations.removeDuplicates(state.rows); state.rows = r.rows;
    state.colTypes = Upload.detectTypes(state.headers, state.rows); updateStatusBar();
    showResult('cleanResult', r.removed > 0, `Removed ${r.removed} duplicate row(s).`);
    toast(`Removed ${r.removed} duplicates`, r.removed > 0 ? 'success' : 'info');
  });

  $('#missingStrategy').addEventListener('change', () => {
    $('#customValueGroup').classList.toggle('hidden', $('#missingStrategy').value !== 'custom');
  });

  $('#btnHandleMissing').addEventListener('click', () => {
    const s = $('#missingStrategy').value, col = $('#missingCol').value, cv = $('#customValue').value;
    pushHistory(`Handle missing: ${s}`, '✨');
    const r = Operations.handleMissing(state.headers, state.rows, s, col, cv); state.rows = r.rows;
    state.colTypes = Upload.detectTypes(state.headers, state.rows); updateStatusBar();
    showResult('cleanResult', true, `Affected ${r.affected} cell(s) / row(s).`);
    toast(`Missing values handled (${r.affected} affected)`, 'success');
  });

  $('#btnTrimWhitespace').addEventListener('click', () => {
    pushHistory('Trim whitespace', '✂️');
    const r = Operations.trimWhitespace(state.rows); state.rows = r.rows;
    showResult('cleanResult', true, `Trimmed ${r.affected} cell(s).`);
    toast(`Trimmed ${r.affected} cells`, 'success');
  });

  $('#btnRemoveEmptyRows').addEventListener('click', () => {
    pushHistory('Remove empty rows', '🗑️');
    const r = Operations.removeEmptyRows(state.rows); state.rows = r.rows;
    state.colTypes = Upload.detectTypes(state.headers, state.rows); updateStatusBar();
    showResult('cleanResult', true, `Removed ${r.removed} empty row(s).`);
    toast(`Removed ${r.removed} empty rows`, 'success');
  });

  $('#btnRemoveEmptyCols').addEventListener('click', () => {
    pushHistory('Remove empty columns', '🗑️');
    const r = Operations.removeEmptyColumns(state.headers, state.rows);
    state.headers = r.headers; state.rows = r.rows;
    state.colTypes = Upload.detectTypes(state.headers, state.rows); updateStatusBar();
    showResult('cleanResult', true, `Removed ${r.removed} empty column(s).`);
    toast(`Removed ${r.removed} empty columns`, 'success');
  });

  // ===== SORTING =====
  function populateSortSelects() { populateSelect($('#sortCol'), state.headers, false); }
  $('#btnSort').addEventListener('click', () => {
    const col = $('#sortCol').value, order = $('#sortOrder').value;
    pushHistory(`Sort by ${col} (${order})`, '🔀');
    state.rows = Operations.sortByColumn(state.headers, state.rows, col, order);
    showResult('sortResult', true, `Sorted by "${col}" (${order === 'asc' ? 'ascending' : 'descending'}).`);
    toast(`Sorted by ${col}`, 'success');
  });

  // ===== FILTERING =====
  function populateFilterSelects() { populateSelect($('#filterCol'), state.headers, false); }
  $('#filterCondition').addEventListener('change', () => {
    const c = $('#filterCondition').value;
    $('#filterValueGroup').classList.toggle('hidden', ['empty', 'not_empty'].includes(c));
    $('#filterValueGroup2').classList.toggle('hidden', c !== 'between');
  });
  $('#btnFilter').addEventListener('click', () => {
    const col = $('#filterCol').value, cond = $('#filterCondition').value;
    const v1 = $('#filterValue').value, v2 = $('#filterValue2').value;
    pushHistory(`Filter: ${col} ${cond} ${v1}`, '🔍');
    const before = state.rows.length;
    state.rows = Operations.filterRows(state.headers, state.rows, col, cond, v1, v2);
    state.colTypes = Upload.detectTypes(state.headers, state.rows); updateStatusBar();
    const removed = before - state.rows.length;
    showResult('filterResult', true, `Filtered: ${state.rows.length} rows remain (${removed} removed).`);
    toast(`Filter applied: ${removed} rows removed`, 'success');
  });
  $('#btnClearFilter').addEventListener('click', () => toast('Use Undo or Reset to restore filtered rows', 'info'));

  // ===== COLUMN MANAGEMENT =====
  function populateColumnSelects() {
    populateSelect($('#renameCol'), state.headers, false);
    populateSelect($('#convertCol'), state.headers, false);
    populateSelect($('#computedColA'), state.headers, false);
    populateSelect($('#computedColB'), state.headers, false);
    const list = $('#deleteColList'); list.innerHTML = '';
    state.headers.forEach(h => {
      const d = document.createElement('div'); d.className = 'checkbox-item';
      d.innerHTML = `<input type="checkbox" id="del_${h}" value="${escHtml(h)}"><label for="del_${h}">${escHtml(h)}</label>`;
      list.appendChild(d);
    });
  }

  $('#btnRenameCol').addEventListener('click', () => {
    const old = $('#renameCol').value, newN = $('#renameTo').value.trim();
    if (!newN) { toast('Enter a new column name', 'error'); return; }
    pushHistory(`Rename "${old}" → "${newN}"`, '✏️');
    state.headers = Operations.renameColumn(state.headers, old, newN);
    state.colTypes = Upload.detectTypes(state.headers, state.rows); populateColumnSelects();
    showResult('colResult', true, `Renamed "${old}" to "${newN}".`); toast('Column renamed', 'success');
  });

  $('#btnDeleteCols').addEventListener('click', () => {
    const checked = [...$$('#deleteColList input:checked')].map(c => c.value);
    if (!checked.length) { toast('Select columns to delete', 'error'); return; }
    if (checked.length === state.headers.length) { toast('Cannot delete all columns', 'error'); return; }
    pushHistory(`Delete ${checked.length} column(s)`, '🗑️');
    const r = Operations.deleteColumns(state.headers, state.rows, checked);
    state.headers = r.headers; state.rows = r.rows;
    state.colTypes = Upload.detectTypes(state.headers, state.rows); updateStatusBar(); populateColumnSelects();
    showResult('colResult', true, `Deleted ${checked.length} column(s).`); toast(`${checked.length} column(s) deleted`, 'success');
  });

  $('#btnConvertType').addEventListener('click', () => {
    const col = $('#convertCol').value, to = $('#convertTo').value;
    pushHistory(`Convert "${col}" to ${to}`, '🔧');
    const r = Operations.convertColumnType(state.headers, state.rows, col, to); state.rows = r.rows;
    state.colTypes = Upload.detectTypes(state.headers, state.rows);
    showResult('colResult', true, `Converted ${r.converted} value(s) in "${col}" to ${to}.`); toast(`Converted ${r.converted} values`, 'success');
  });

  $('#btnAddComputed').addEventListener('click', () => {
    const name = $('#computedName').value.trim();
    if (!name) { toast('Enter a column name', 'error'); return; }
    const op = $('#computedOp').value, a = $('#computedColA').value, b = $('#computedColB').value;
    pushHistory(`Add computed column "${name}"`, '➕');
    const r = Operations.addComputedColumn(state.headers, state.rows, name, op, a, b);
    if (r.error) { toast(r.error, 'error'); return; }
    state.headers = r.headers; state.rows = r.rows;
    state.colTypes = Upload.detectTypes(state.headers, state.rows); updateStatusBar(); populateColumnSelects();
    showResult('colResult', true, `Added computed column "${name}".`); toast(`Column "${name}" added`, 'success');
  });

  // ===== FIND & REPLACE (FIXED) =====
  function populateFrSelects() { populateSelect($('#frCol'), state.headers, true); }

  // Live preview on typing
  $('#frFind').addEventListener('input', updateFrPreview);
  $('#frCol').addEventListener('change', updateFrPreview);
  $('#frCaseSensitive').addEventListener('change', updateFrPreview);

  function updateFrPreview() {
    const find = $('#frFind').value;
    const preview = $('#frMatchPreview');
    if (!find || !state.isDataLoaded) { preview.innerHTML = ''; return; }
    const col = $('#frCol').value;
    const cs = $('#frCaseSensitive').checked;
    const result = Operations.countMatches(state.headers, state.rows, col, find, cs);
    if (result.matches > 0) {
      preview.innerHTML = `<div class="match-preview has-matches">🔍 Found <strong>${result.matches}</strong> match(es) in <strong>${result.cellsMatched}</strong> cell(s)</div>`;
    } else {
      preview.innerHTML = `<div class="match-preview no-matches">⚠️ No matches found</div>`;
    }
  }

  $('#btnFindPreview').addEventListener('click', () => {
    const find = $('#frFind').value;
    if (!find) { toast('Enter text to find', 'error'); return; }
    updateFrPreview();
  });

  $('#btnFindReplace').addEventListener('click', () => {
    const col = $('#frCol').value, find = $('#frFind').value, replace = $('#frReplace').value;
    const cs = $('#frCaseSensitive').checked;
    if (!find) { toast('Enter text to find', 'error'); return; }
    pushHistory(`Replace "${find}" → "${replace}"`, '🔄');
    const r = Operations.findAndReplace(state.headers, state.rows, col, find, replace, cs);
    state.rows = r.rows;
    state.colTypes = Upload.detectTypes(state.headers, state.rows);
    showResult('frResult', true, `Made ${r.replacements} replacement(s).`);
    toast(`${r.replacements} replacements made`, 'success');
    updateFrPreview();
  });

  // ===== FORMULAS =====
  function renderFormulaCatalog() {
    const catalog = $('#formulaCatalog');
    const catMeta = Formulas.getCategoryMeta();
    let html = '';

    Object.entries(catMeta).forEach(([catKey, meta]) => {
      const formulas = Formulas.getByCategory(catKey);
      html += `<div class="formula-cat-header" data-cat="${catKey}">
        <span class="cat-arrow">▶</span>
        <span>${meta.icon} ${meta.name}</span>
        <span class="cat-count">${formulas.length}</span>
      </div>`;
      html += `<div class="formula-cat-list" data-cat="${catKey}">`;
      formulas.forEach(f => {
        html += `<div class="formula-item ${state.selectedFormula === f.key ? 'active' : ''}" data-key="${f.key}">
          ${f.name} <span class="f-type ${f.type}">${f.type === 'aggregate' ? 'AGG' : 'COL'}</span>
        </div>`;
      });
      html += '</div>';
    });

    catalog.innerHTML = html;

    // Bind category toggle
    catalog.querySelectorAll('.formula-cat-header').forEach(header => {
      header.addEventListener('click', () => {
        const cat = header.dataset.cat;
        header.classList.toggle('open');
        const list = catalog.querySelector(`.formula-cat-list[data-cat="${cat}"]`);
        if (list) list.classList.toggle('open');
      });
    });

    // Bind formula selection
    catalog.querySelectorAll('.formula-item').forEach(item => {
      item.addEventListener('click', () => {
        catalog.querySelectorAll('.formula-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        state.selectedFormula = item.dataset.key;
        renderFormulaEditor(item.dataset.key);
      });
    });

    // Auto-open first category
    const firstHeader = catalog.querySelector('.formula-cat-header');
    if (firstHeader) { firstHeader.classList.add('open'); const list = catalog.querySelector('.formula-cat-list'); if (list) list.classList.add('open'); }

    // If formula was selected, show it
    if (state.selectedFormula) renderFormulaEditor(state.selectedFormula);
  }

  function renderFormulaEditor(key) {
    const f = Formulas.getByKey(key);
    if (!f) return;

    const editor = $('#formulaEditor');
    let html = `
      <div class="formula-name">${f.name}</div>
      <div class="formula-syntax">${escHtml(f.syntax)}</div>
      <div class="formula-desc">${escHtml(f.desc)}</div>
    `;

    // Parameter form
    if (f.params.length > 0) {
      f.params.forEach(p => {
        html += `<div class="form-group"><label class="form-label">${escHtml(p.label)}</label>`;
        if (p.type === 'column') {
          html += `<select class="form-select" id="fp_${p.key}">`;
          state.headers.forEach(h => { html += `<option value="${escHtml(h)}">${escHtml(h)}</option>`; });
          html += '</select>';
        } else if (p.type === 'select') {
          html += `<select class="form-select" id="fp_${p.key}">`;
          p.options.forEach(o => { html += `<option value="${escHtml(o)}">${escHtml(o)}</option>`; });
          html += '</select>';
        } else if (p.type === 'number') {
          html += `<input class="form-input" id="fp_${p.key}" type="number" value="${p.default || ''}" step="any">`;
        } else {
          html += `<input class="form-input" id="fp_${p.key}" value="${p.default || ''}" placeholder="Enter value…">`;
        }
        html += '</div>';
      });
    }

    html += `<button class="btn btn-primary" id="btnExecFormula">⚡ Execute ${f.name}</button>`;
    html += `<div id="formulaResult"></div>`;

    editor.innerHTML = html;

    // Bind execute
    $('#btnExecFormula').addEventListener('click', () => executeFormula(key));
  }

  function executeFormula(key) {
    const f = Formulas.getByKey(key);
    if (!f) return;

    // Gather params
    const params = {};
    f.params.forEach(p => {
      const el = $(`#fp_${p.key}`);
      params[p.key] = el ? el.value : '';
    });

    const result = Formulas.execute(key, state.headers, state.rows, params);

    if (result.error) {
      toast(result.error, 'error');
      return;
    }

    const resultEl = $('#formulaResult');

    if (result.type === 'aggregate') {
      resultEl.innerHTML = `
        <div class="formula-result-card">
          <div class="fr-label">${f.name} Result</div>
          <div class="fr-value">${result.value !== null ? result.value : 'N/A'}</div>
          ${result.extra ? `<div class="fr-extra">${escHtml(result.extra)}</div>` : ''}
        </div>
      `;
      toast(`${f.name} = ${result.value}`, 'success');
    } else if (result.type === 'transform') {
      // Add as new column
      pushHistory(`Formula: ${result.columnName || f.name}`, '🧮');
      state.headers = [...state.headers, result.columnName || f.name];
      state.rows = state.rows.map((r, i) => [...r, result.column[i]]);
      state.colTypes = Upload.detectTypes(state.headers, state.rows);
      updateStatusBar();

      resultEl.innerHTML = `
        <div class="result-banner success">
          <span class="result-icon">✅</span>
          <span>Column "<strong>${result.columnName || f.name}</strong>" added with ${state.rows.length} values</span>
        </div>
      `;
      toast(`Column "${result.columnName || f.name}" added`, 'success');
    }
  }

  // ===== STATISTICS =====
  function refreshStats() {
    if (!state.isDataLoaded) return;
    const ov = Stats.overview(state.headers, state.rows, state.colTypes);
    Stats.renderOverview(ov, $('#statsOverview'));
    const cs = Stats.columnStats(state.headers, state.rows, state.colTypes);
    Stats.renderTable(cs, $('#statsTableHead'), $('#statsTableBody'));
  }

  // ===== CHARTS =====
  function populateChartSelects() {
    populateSelect($('#chartX'), state.headers, false);
    populateSelect($('#chartY'), state.headers, false);
  }

  $('#btnRenderChart').addEventListener('click', () => {
    const type = $('#chartType').value, x = $('#chartX').value, y = $('#chartY').value;
    const limit = parseInt($('#chartLimit').value) || 50;
    const prepared = Charts.prepareData(state.headers, state.rows, x, y, type, limit);
    if (!prepared || (!prepared.data.length && !prepared.labels)) { toast('No valid data for this chart', 'error'); return; }
    Charts.render(type, type === 'scatter' ? null : prepared.labels, prepared.data, x, y, $('#mainChart'));
    toast('Chart generated', 'success');
  });

  // ===== GROUP BY / PIVOT =====
  function populateGroupBySelects() {
    populateSelect($('#groupByCol'), state.headers, false);
    populateSelect($('#groupByValCol'), state.headers, false);
    const col2 = $('#groupByCol2'); col2.innerHTML = '<option value="">— None —</option>';
    state.headers.forEach(h => { const o = document.createElement('option'); o.value = h; o.textContent = h; col2.appendChild(o); });
  }

  function doGroupBy(withChart) {
    const gc = $('#groupByCol').value, vc = $('#groupByValCol').value, agg = $('#groupByAgg').value;
    const gc2 = $('#groupByCol2').value;

    let result;
    if (gc2) {
      result = Advanced.groupByMulti(state.headers, state.rows, [gc, gc2], vc, agg);
    } else {
      result = Advanced.groupBy(state.headers, state.rows, gc, vc, agg);
    }

    // Render table
    let html = '<div class="table-container"><table class="groupby-result-table"><thead><tr>';
    result.headers.forEach(h => { html += `<th>${escHtml(h)}</th>`; });
    html += '</tr></thead><tbody>';
    result.rows.forEach(r => {
      html += '<tr>';
      r.forEach(v => { html += `<td>${v !== null ? escHtml(String(v)) : '—'}</td>`; });
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    if (withChart && !gc2) {
      html += '<div class="chart-container mt-16"><canvas id="groupByChart"></canvas></div>';
    }

    $('#groupByResult').innerHTML = html;

    if (withChart && !gc2) {
      const labels = result.rows.map(r => String(r[0]));
      const data = result.rows.map(r => r[1]);
      Charts.render('bar', labels, data, gc, `${agg.toUpperCase()}(${vc})`, $('#groupByChart'));
    }

    toast(`Grouped: ${result.rows.length} groups`, 'success');
  }

  $('#btnGroupBy').addEventListener('click', () => doGroupBy(false));
  $('#btnGroupByChart').addEventListener('click', () => doGroupBy(true));

  // ===== DATA PROFILING =====
  function refreshProfiling() {
    if (!state.isDataLoaded) return;
    const profiles = Advanced.profile(state.headers, state.rows, state.colTypes);

    let html = '<table class="stats-table"><thead><tr>';
    html += '<th>Column</th><th>Type</th><th>Count</th><th>Nulls</th><th>Null %</th><th>Unique</th><th>Top Value</th><th>Quality</th>';
    html += '</tr></thead><tbody>';

    profiles.forEach(p => {
      const qClass = p.quality >= 90 ? 'high' : p.quality >= 70 ? 'medium' : 'low';
      html += `<tr>
        <td style="font-weight:600;color:var(--text-accent)">${escHtml(p.column)}</td>
        <td><span class="type-badge ${p.type}">${p.type}</span></td>
        <td>${p.count}</td>
        <td>${p.nulls}</td>
        <td>${p.nullPct}%</td>
        <td>${p.unique}</td>
        <td title="${escHtml(p.topValue)}">${escHtml(String(p.topValue).substring(0, 20))} <span style="color:var(--text-muted);font-size:0.7rem;">(${p.topFreq})</span></td>
        <td><div style="display:flex;align-items:center;gap:8px;"><span style="font-size:0.8rem;">${p.quality}%</span><div class="quality-bar" style="width:60px"><div class="quality-bar-fill ${qClass}" style="width:${p.quality}%"></div></div></div></td>
      </tr>`;
    });
    html += '</tbody></table>';
    $('#profilingTable').innerHTML = html;

    populateSelect($('#profileDistCol'), state.headers, false);
  }

  $('#btnProfileDist').addEventListener('click', () => {
    const col = $('#profileDistCol').value;
    const ci = state.headers.indexOf(col);
    if (ci === -1) return;
    const dist = Advanced.valueDistribution(state.rows, ci, 20);
    const maxCount = Math.max(...dist.map(d => d.count));

    let html = '';
    dist.forEach(d => {
      const pct = maxCount ? (d.count / maxCount * 100) : 0;
      html += `<div class="dist-row">
        <span class="dist-label" title="${escHtml(d.value)}">${escHtml(d.value)}</span>
        <div class="dist-bar-wrap"><div class="dist-bar-fill" style="width:${pct}%"></div></div>
        <span class="dist-count">${d.count}</span>
        <span class="dist-pct">${d.pct}%</span>
      </div>`;
    });

    $('#profileDistResult').innerHTML = html;
  });

  // ===== OUTLIER DETECTION =====
  function populateOutlierSelects() {
    const numCols = state.headers.filter((h, i) => state.colTypes[i] && state.colTypes[i].type === 'number');
    populateSelect($('#outlierCol'), numCols, false);
  }

  $('#outlierMethod').addEventListener('change', () => {
    const m = $('#outlierMethod').value;
    $('#outlierThreshold').value = m === 'iqr' ? '1.5' : '3';
  });

  $('#btnDetectOutliers').addEventListener('click', () => {
    const col = $('#outlierCol').value, method = $('#outlierMethod').value;
    const threshold = parseFloat($('#outlierThreshold').value);
    const ci = state.headers.indexOf(col);
    if (ci === -1) { toast('Select a numeric column', 'error'); return; }

    const r = Advanced.detectOutliers(state.rows, ci, method, threshold);
    let html = `<div class="stats-grid mb-16">
      <div class="stat-card"><div class="stat-label">Outliers Found</div><div class="stat-value">${r.outlierCount}</div></div>
      <div class="stat-card"><div class="stat-label">Lower Bound</div><div class="stat-value">${r.lowerBound ?? '—'}</div></div>
      <div class="stat-card"><div class="stat-label">Upper Bound</div><div class="stat-value">${r.upperBound ?? '—'}</div></div>
    </div>`;
    if (r.outlierValues.length) {
      html += `<p style="font-size:0.82rem;color:var(--text-muted)">Outlier values (first 50): ${r.outlierValues.join(', ')}</p>`;
    }
    $('#outlierDetails').innerHTML = html;
    showResult('outlierResult', true, `Found ${r.outlierCount} outlier(s) using ${method.toUpperCase()} method.`);
  });

  $('#btnFlagOutliers').addEventListener('click', () => {
    const col = $('#outlierCol').value, method = $('#outlierMethod').value;
    const threshold = parseFloat($('#outlierThreshold').value);
    pushHistory(`Flag outliers: ${col}`, '🏷️');
    const r = Advanced.flagOutliers(state.headers, state.rows, col, method, threshold);
    state.headers = r.headers; state.rows = r.rows;
    state.colTypes = Upload.detectTypes(state.headers, state.rows); updateStatusBar();
    toast(`Outlier column added. ${r.outlierCount} flagged.`, 'success');
  });

  $('#btnRemoveOutliers').addEventListener('click', () => {
    const col = $('#outlierCol').value, method = $('#outlierMethod').value;
    const threshold = parseFloat($('#outlierThreshold').value);
    const ci = state.headers.indexOf(col);
    pushHistory(`Remove outliers: ${col}`, '🗑️');
    const r = Advanced.removeOutliers(state.rows, ci, method, threshold);
    state.rows = r.rows;
    state.colTypes = Upload.detectTypes(state.headers, state.rows); updateStatusBar();
    toast(`Removed ${r.removed} outlier row(s)`, 'success');
    showResult('outlierResult', true, `Removed ${r.removed} outlier row(s).`);
  });

  // ===== CORRELATION MATRIX =====
  $('#btnCorrelation').addEventListener('click', () => {
    const r = Advanced.correlationMatrix(state.headers, state.rows, state.colTypes);
    if (!r.labels.length) { toast('No numeric columns for correlation', 'error'); return; }

    function corrClass(val, i, j) {
      if (i === j) return 'corr-cell-diag';
      const a = Math.abs(val);
      if (val > 0) return a > 0.7 ? 'corr-cell-pos-strong' : a > 0.4 ? 'corr-cell-pos-moderate' : a > 0.1 ? 'corr-cell-pos-weak' : 'corr-cell-zero';
      return a > 0.7 ? 'corr-cell-neg-strong' : a > 0.4 ? 'corr-cell-neg-moderate' : a > 0.1 ? 'corr-cell-neg-weak' : 'corr-cell-zero';
    }

    let html = '<table class="corr-table"><thead><tr><th></th>';
    r.labels.forEach(l => { html += `<th title="${escHtml(l)}">${escHtml(l)}</th>`; });
    html += '</tr></thead><tbody>';

    r.matrix.forEach((row, i) => {
      html += `<tr><th>${escHtml(r.labels[i])}</th>`;
      row.forEach((val, j) => {
        html += `<td class="${corrClass(val, i, j)}">${val}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';

    $('#correlationResult').innerHTML = html;
    toast('Correlation matrix generated', 'success');
  });

  // ===== CROSS TABULATION =====
  function populateCrossTabSelects() {
    populateSelect($('#crossTabRow'), state.headers, false);
    populateSelect($('#crossTabCol'), state.headers, false);
  }

  $('#btnCrossTab').addEventListener('click', () => {
    const r1 = $('#crossTabRow').value, r2 = $('#crossTabCol').value;
    const r = Advanced.crossTab(state.headers, state.rows, r1, r2);
    if (!r) { toast('Select valid columns', 'error'); return; }

    let html = '<table class="groupby-result-table"><thead><tr>';
    html += `<th>${escHtml(r1)} \\ ${escHtml(r2)}</th>`;
    r.colLabels.forEach(c => { html += `<th>${escHtml(c)}</th>`; });
    html += '<th>Total</th></tr></thead><tbody>';

    r.rowLabels.forEach((rl, ri) => {
      html += `<tr><td style="font-weight:600">${escHtml(rl)}</td>`;
      r.matrix[ri].forEach(v => { html += `<td>${v}</td>`; });
      html += `<td style="font-weight:600;color:var(--accent-cyan)">${r.rowTotals[ri]}</td></tr>`;
    });

    // Column totals
    html += '<tr><td style="font-weight:600">Total</td>';
    r.colTotals.forEach(t => { html += `<td style="font-weight:600;color:var(--accent-cyan)">${t}</td>`; });
    html += `<td style="font-weight:700;color:var(--accent-purple)">${r.colTotals.reduce((a, b) => a + b, 0)}</td></tr>`;
    html += '</tbody></table>';

    $('#crossTabResult').innerHTML = html;
    toast('Cross tabulation generated', 'success');
  });

  // ===== EXPORT =====
  function getCleanFileName() { return state.fileName.replace(/\.[^/.]+$/, '') || 'data'; }

  $('#exportCsv').addEventListener('click', () => { Export.downloadCsv(state.headers, state.rows, getCleanFileName()); toast('CSV downloaded', 'success'); });
  $('#exportXlsx').addEventListener('click', () => { Export.downloadXlsx(state.headers, state.rows, getCleanFileName()); toast('Excel file downloaded', 'success'); });
  $('#exportJson').addEventListener('click', () => { Export.downloadJson(state.headers, state.rows, getCleanFileName()); toast('JSON downloaded', 'success'); });
  $('#exportReport').addEventListener('click', () => {
    const ov = Stats.overview(state.headers, state.rows, state.colTypes);
    const cs = Stats.columnStats(state.headers, state.rows, state.colTypes);
    Export.downloadReport(Stats.generateReport(ov, cs, state.headers), getCleanFileName());
    toast('Report downloaded', 'success');
  });

  // ===== HISTORY =====
  function renderHistory() {
    const list = $('#historyList');
    if (!state.history.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">🕐</div><div class="empty-title">No operations yet</div><div class="empty-text">Operations you perform will appear here</div></div>';
      return;
    }
    list.innerHTML = state.history.map(h => `<div class="history-item"><span class="h-icon">${h.icon}</span><span class="h-text">${escHtml(h.label)}</span><span class="h-time">${h.time}</span></div>`).reverse().join('');
  }

  $('#btnUndoLast').addEventListener('click', undoLast);
  $('#btnResetAll').addEventListener('click', resetAll);

  // ===== INIT =====
  setStatus('Ready — Upload a file to begin', false);
})();
