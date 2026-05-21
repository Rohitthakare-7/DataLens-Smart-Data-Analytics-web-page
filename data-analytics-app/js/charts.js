/**
 * charts.js — Chart.js visualization
 */

const Charts = (() => {
  let chartInstance = null;

  // Premium color palette
  const COLORS = [
    'rgba(0, 212, 255, 0.8)',
    'rgba(124, 58, 237, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(236, 72, 153, 0.8)',
    'rgba(59, 130, 246, 0.8)',
    'rgba(239, 68, 68, 0.8)',
    'rgba(34, 211, 238, 0.8)',
    'rgba(168, 85, 247, 0.8)',
    'rgba(251, 191, 36, 0.8)',
    'rgba(52, 211, 153, 0.8)',
    'rgba(244, 114, 182, 0.8)',
  ];

  const BORDER_COLORS = COLORS.map(c => c.replace('0.8', '1'));

  /**
   * Render a chart.
   * @param {string} type — 'bar'|'line'|'pie'|'doughnut'|'scatter'|'polarArea'
   * @param {string[]} labels
   * @param {number[]} data
   * @param {string} xLabel
   * @param {string} yLabel
   * @param {HTMLCanvasElement} canvas
   */
  function render(type, labels, data, xLabel, yLabel, canvas) {
    // Destroy previous
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    const ctx = canvas.getContext('2d');

    // Chart.js defaults for dark theme
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = 'rgba(148, 163, 184, 0.1)';
    Chart.defaults.font.family = "'Inter', sans-serif";

    const datasets = [];
    const isPie = ['pie', 'doughnut', 'polarArea'].includes(type);

    if (type === 'scatter') {
      // data should be array of {x, y}
      datasets.push({
        label: `${xLabel} vs ${yLabel}`,
        data: data,
        backgroundColor: COLORS[0],
        borderColor: BORDER_COLORS[0],
        pointRadius: 4,
        pointHoverRadius: 6,
      });
    } else if (isPie) {
      datasets.push({
        data: data,
        backgroundColor: COLORS.slice(0, data.length),
        borderColor: 'rgba(6, 10, 20, 0.8)',
        borderWidth: 2,
        hoverOffset: 8,
      });
    } else {
      // bar / line
      datasets.push({
        label: yLabel,
        data: data,
        backgroundColor: type === 'line'
          ? 'rgba(0, 212, 255, 0.1)'
          : COLORS.slice(0, data.length),
        borderColor: type === 'line'
          ? BORDER_COLORS[0]
          : BORDER_COLORS.slice(0, data.length),
        borderWidth: type === 'line' ? 2 : 1,
        fill: type === 'line',
        tension: 0.4,
        pointBackgroundColor: BORDER_COLORS[0],
        pointBorderColor: BORDER_COLORS[0],
        pointRadius: 3,
        pointHoverRadius: 5,
        borderRadius: type === 'bar' ? 4 : 0,
      });
    }

    const config = {
      type,
      data: {
        labels: type === 'scatter' ? undefined : labels,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 800,
          easing: 'easeOutQuart'
        },
        plugins: {
          legend: {
            display: isPie,
            position: 'right',
            labels: {
              padding: 16,
              usePointStyle: true,
              pointStyleWidth: 10,
              font: { size: 12 }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            titleFont: { size: 13, weight: 600 },
            bodyFont: { size: 12 },
            padding: 12,
            cornerRadius: 8,
            borderColor: 'rgba(148, 163, 184, 0.2)',
            borderWidth: 1
          }
        }
      }
    };

    if (!isPie && type !== 'scatter') {
      config.options.scales = {
        x: {
          title: { display: true, text: xLabel, font: { size: 12, weight: 500 } },
          grid: { color: 'rgba(148, 163, 184, 0.05)' },
          ticks: { maxRotation: 45, maxTicksLimit: 30 }
        },
        y: {
          title: { display: true, text: yLabel, font: { size: 12, weight: 500 } },
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
          beginAtZero: true
        }
      };
    }

    if (type === 'scatter') {
      config.options.scales = {
        x: {
          title: { display: true, text: xLabel, font: { size: 12, weight: 500 } },
          grid: { color: 'rgba(148, 163, 184, 0.05)' }
        },
        y: {
          title: { display: true, text: yLabel, font: { size: 12, weight: 500 } },
          grid: { color: 'rgba(148, 163, 184, 0.08)' }
        }
      };
    }

    chartInstance = new Chart(ctx, config);
  }

  /**
   * Prepare chart data from rows.
   */
  function prepareData(headers, rows, xCol, yCol, type, limit) {
    const xi = headers.indexOf(xCol);
    const yi = headers.indexOf(yCol);

    if (xi === -1 || yi === -1) return null;

    // Limit rows
    const limitedRows = rows.slice(0, limit);

    if (type === 'scatter') {
      const points = [];
      limitedRows.forEach(r => {
        const x = Number(r[xi]);
        const y = Number(r[yi]);
        if (!isNaN(x) && !isNaN(y)) {
          points.push({ x, y });
        }
      });
      return { data: points, labels: null };
    }

    // For pie/doughnut with text x-axis → aggregate by category
    if (['pie', 'doughnut', 'polarArea'].includes(type)) {
      const agg = {};
      limitedRows.forEach(r => {
        const label = r[xi] != null ? String(r[xi]) : 'null';
        const val = Number(r[yi]);
        if (!isNaN(val)) {
          agg[label] = (agg[label] || 0) + val;
        }
      });

      const entries = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 20);
      return {
        labels: entries.map(e => e[0]),
        data: entries.map(e => Math.round(e[1] * 100) / 100)
      };
    }

    // Bar / Line
    const labels = [];
    const data = [];

    limitedRows.forEach(r => {
      const lbl = r[xi] != null ? String(r[xi]) : '';
      const val = Number(r[yi]);
      if (!isNaN(val)) {
        labels.push(lbl);
        data.push(val);
      }
    });

    return { labels, data };
  }

  function destroy() {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
  }

  return { render, prepareData, destroy };
})();
