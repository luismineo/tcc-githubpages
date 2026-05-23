async function loadData() {
  const res = await fetch('./data/results.json');
  return res.json();
}

function sizeFromTime(seconds, min = 10, max = 40) {
  const allTimes = window._allTimes || [];
  const lo = Math.min(...allTimes);
  const hi = Math.max(...allTimes);
  if (hi === lo) return (min + max) / 2;
  return min + ((seconds - lo) / (hi - lo)) * (max - min);
}

function buildTooltip(exp) {
  return [
    `<b>${exp.id}</b>`,
    `PSNR: ${exp.psnr.toFixed(2)} dB`,
    `VRAM: ${exp.vram_mb} MB`,
    `Tempo de treino: ${exp.training_time_s}s`,
    `──────────────────`,
    `log2_hashmap_size: ${exp.params.log2_hashmap_size}`,
    `n_features_per_level: ${exp.params.n_features_per_level}`,
    `n_rays_per_batch: ${exp.params.n_rays_per_batch}`,
  ].join('<br>');
}

function buildParetoLine(paretoPoints) {
  const sorted = [...paretoPoints].sort((a, b) => a.vram_mb - b.vram_mb);
  return {
    x: sorted.map(p => p.vram_mb),
    y: sorted.map(p => p.psnr),
    mode: 'lines',
    name: 'Fronteira de Pareto',
    line: { color: 'rgba(79,255,176,0.4)', width: 2, dash: 'dot' },
    hoverinfo: 'skip',
    showlegend: false,
  };
}

async function initParetoChart() {
  const data = await loadData();
  const all = data.all_experiments;
  const pareto = data.pareto_front;

  window._allTimes = all.map(e => e.training_time_s);

  const dominated = all.filter(e => !e.on_pareto_front);
  const fronts    = all.filter(e => e.on_pareto_front);

  const trDominated = {
    x: dominated.map(e => e.vram_mb),
    y: dominated.map(e => e.psnr),
    mode: 'markers',
    name: 'Experimentos dominados',
    text: dominated.map(buildTooltip),
    hoverinfo: 'text',
    marker: {
      size: dominated.map(e => sizeFromTime(e.training_time_s)),
      color: 'rgba(108,143,255,0.35)',
      line: { color: 'rgba(108,143,255,0.7)', width: 1.5 },
      sizemode: 'diameter',
    },
  };

  const trPareto = {
    x: fronts.map(e => e.vram_mb),
    y: fronts.map(e => e.psnr),
    mode: 'markers',
    name: 'Fronteira de Pareto',
    text: fronts.map(buildTooltip),
    hoverinfo: 'text',
    marker: {
      size: fronts.map(e => sizeFromTime(e.training_time_s)),
      color: 'rgba(79,255,176,0.25)',
      line: { color: '#4fffb0', width: 2 },
      sizemode: 'diameter',
    },
  };

  const trLine = buildParetoLine(pareto);

  const layout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor:  'transparent',
    font: { family: "'Inter', sans-serif", color: '#7b82a0', size: 12 },
    xaxis: {
      title: { text: 'Uso de VRAM (MB)', standoff: 12 },
      gridcolor: 'rgba(42,45,62,0.8)',
      zerolinecolor: 'rgba(42,45,62,0.8)',
      color: '#7b82a0',
    },
    yaxis: {
      title: { text: 'PSNR (dB)', standoff: 12 },
      gridcolor: 'rgba(42,45,62,0.8)',
      zerolinecolor: 'rgba(42,45,62,0.8)',
      color: '#7b82a0',
    },
    legend: {
      bgcolor: 'rgba(26,29,39,0.8)',
      bordercolor: 'rgba(42,45,62,0.8)',
      borderwidth: 1,
      font: { color: '#e2e6f3' },
    },
    margin: { t: 20, r: 20, b: 60, l: 60 },
    hoverlabel: {
      bgcolor: '#1a1d27',
      bordercolor: '#2a2d3e',
      font: { family: "'Inter', sans-serif", size: 13, color: '#e2e6f3' },
    },
    hovermode: 'closest',
  };

  const config = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'],
    toImageButtonOptions: { format: 'png', filename: 'pareto_front', scale: 2 },
  };

  Plotly.newPlot('pareto-chart', [trLine, trDominated, trPareto], layout, config);
}

document.addEventListener('DOMContentLoaded', initParetoChart);
