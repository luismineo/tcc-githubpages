/* ============================================================
   Fronteira de Pareto — PSNR x VRAM
   Fonte de dados: ./data/pareto.csv (resultados reais)
   ============================================================ */

const CSV_URL = './data/pareto.csv';

const SCENES = {
  chair: { label: 'Chair', color: '#6c8fff' },
  lego:  { label: 'Lego',  color: '#ff6c8f' },
};

const CLR_FRONT     = '#4fffb0';
const CLR_DOMINATED = '#6c8fff';

/* ---------- CSV ---------- */

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',');
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    const row = {};
    header.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
    return row;
  });
}

const num = v => (v === '' || v === undefined ? null : Number(v));

async function loadData() {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error('Falha ao carregar ' + CSV_URL + ': ' + res.status);
  const rows = parseCSV(await res.text());

  // Configurações que aparecem na fronteira das duas cenas simultaneamente.
  const intersection = new Set(
    rows.filter(r => r.front === 'intersecao').map(r => `T${r.T}_F${r.F}_L${r.L}`)
  );

  const runs = rows
    .filter(r => r.front === '3d' && r.psnr !== '')
    .map(r => ({
      scene:   r.scene,
      tag:     r.run_tag,
      config:  `T${r.T}_F${r.F}_L${r.L}`,
      T:       num(r.T),
      F:       num(r.F),
      L:       num(r.L),
      scale:   num(r.per_level_scale),
      psnr:    num(r.psnr),
      psnrStd: num(r.psnr_std),
      ssim:    num(r.ssim),
      lpips:   num(r.lpips),
      vram:    num(r.vram_peak_mb),
      time:    num(r.t_train_s),
      onFront: r.on_2d_front === 'True',
    }))
    .map(run => ({ ...run, inIntersection: intersection.has(run.config) }));

  return { runs, intersection };
}

/* ---------- Escalas e rótulos ---------- */

function makeSizeScale(runs, min = 9, max = 26) {
  const times = runs.map(r => r.time);
  const lo = Math.min(...times);
  const hi = Math.max(...times);
  return t => (hi === lo ? (min + max) / 2 : min + ((t - lo) / (hi - lo)) * (max - min));
}

function tooltip(run) {
  return [
    `<b>${run.tag}</b>`,
    `Cena: ${SCENES[run.scene] ? SCENES[run.scene].label : run.scene}`,
    '──────────────────',
    `PSNR: ${run.psnr.toFixed(2)} ± ${run.psnrStd.toFixed(2)} dB`,
    `SSIM: ${run.ssim.toFixed(4)}`,
    `LPIPS: ${run.lpips.toFixed(4)}`,
    `VRAM (pico): ${run.vram.toFixed(1)} MB`,
    `Tempo de treino: ${run.time.toFixed(1)} s`,
    '──────────────────',
    `log2_hashmap_size (T): ${run.T}`,
    `n_features_per_level (F): ${run.F}`,
    `num_levels (L): ${run.L}`,
    `per_level_scale: ${run.scale.toFixed(4)}`,
    run.onFront ? '✔ Fronteira de Pareto (PSNR × VRAM)' : '· Dominado em PSNR × VRAM',
    run.inIntersection ? '∩ Configuração comum às duas cenas' : '',
  ].filter(Boolean).join('<br>');
}

/* ---------- Traces ---------- */

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function scatterTrace(runs, opts) {
  return {
    x: runs.map(r => r.vram),
    y: runs.map(r => r.psnr),
    mode: 'markers',
    type: 'scatter',
    name: opts.name,
    text: runs.map(tooltip),
    hoverinfo: 'text',
    marker: {
      size: runs.map(r => opts.sizeOf(r.time)),
      sizemode: 'diameter',
      color: hexToRgba(opts.color, opts.fillAlpha),
      line: { color: opts.color, width: opts.lineWidth },
    },
  };
}

function frontLine(runs, color) {
  const sorted = [...runs].sort((a, b) => a.vram - b.vram);
  return {
    x: sorted.map(r => r.vram),
    y: sorted.map(r => r.psnr),
    mode: 'lines',
    type: 'scatter',
    line: { color: hexToRgba(color, 0.45), width: 2, dash: 'dot' },
    hoverinfo: 'skip',
    showlegend: false,
  };
}

function buildTraces(runs, mode, sizeOf) {
  if (mode === 'ambas') {
    return Object.keys(SCENES).flatMap(scene => {
      const meta = SCENES[scene];
      const sceneRuns = runs.filter(r => r.scene === scene);
      const front = sceneRuns.filter(r => r.onFront);
      return [
        frontLine(front, meta.color),
        scatterTrace(sceneRuns.filter(r => !r.onFront), {
          name: `${meta.label} — dominados`, color: meta.color,
          fillAlpha: 0.12, lineWidth: 1, sizeOf,
        }),
        scatterTrace(front, {
          name: `${meta.label} — fronteira`, color: meta.color,
          fillAlpha: 0.55, lineWidth: 2, sizeOf,
        }),
      ];
    });
  }

  const sceneRuns = runs.filter(r => r.scene === mode);
  const front = sceneRuns.filter(r => r.onFront);
  return [
    frontLine(front, CLR_FRONT),
    scatterTrace(sceneRuns.filter(r => !r.onFront), {
      name: 'Dominados', color: CLR_DOMINATED, fillAlpha: 0.2, lineWidth: 1.5, sizeOf,
    }),
    scatterTrace(front, {
      name: 'Fronteira de Pareto', color: CLR_FRONT, fillAlpha: 0.25, lineWidth: 2, sizeOf,
    }),
  ];
}

/* ---------- Legenda HTML ---------- */

function renderLegend(mode) {
  const box = document.getElementById('chart-legend');
  if (!box) return;

  const items = mode === 'ambas'
    ? Object.keys(SCENES).map(s => ({ color: SCENES[s].color, label: SCENES[s].label }))
    : [
        { color: CLR_FRONT, label: 'Fronteira de Pareto' },
        { color: hexToRgba(CLR_DOMINATED, 0.5), label: 'Dominados' },
      ];

  const fillHint = mode === 'ambas'
    ? `<div class="legend-item">
         <div style="display:flex; gap:4px; align-items:center;">
           <div class="legend-dot" style="background:var(--clr-muted)"></div>
           <div class="legend-dot" style="background:transparent;box-shadow:inset 0 0 0 1px var(--clr-muted)"></div>
         </div>
         <span>Preenchido = fronteira · vazado = dominado</span>
       </div>`
    : '';

  box.innerHTML = items
    .map(i => `<div class="legend-item"><div class="legend-dot" style="background:${i.color}"></div><span>${i.label}</span></div>`)
    .join('') + fillHint + `
    <div class="legend-item">
      <div style="display:flex; gap:3px; align-items:center;">
        <div style="width:8px;height:8px;border-radius:50%;background:var(--clr-muted);opacity:0.6;"></div>
        <div style="width:14px;height:14px;border-radius:50%;background:var(--clr-muted);"></div>
      </div>
      <span>Tamanho = tempo de treino</span>
    </div>`;
}

/* ---------- Estatísticas ---------- */

function renderStats(runs) {
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  if (!runs.length) return;
  set('stat-total', runs.length);
  set('stat-pareto', runs.filter(r => r.onFront).length);
  set('stat-best-psnr', Math.max(...runs.map(r => r.psnr)).toFixed(2));
  set('stat-min-vram', Math.round(Math.min(...runs.map(r => r.vram))));
}

/* ---------- Layout ---------- */

const LAYOUT = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  font: { family: "'Inter', sans-serif", color: '#7b82a0', size: 12 },
  xaxis: {
    title: { text: 'Pico de VRAM (MB)', standoff: 12 },
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
    x: 1, y: 0.02, xanchor: 'right', yanchor: 'bottom',
  },
  margin: { t: 20, r: 20, b: 60, l: 60 },
  hoverlabel: {
    bgcolor: '#1a1d27',
    bordercolor: '#2a2d3e',
    align: 'left',
    font: { family: "'Inter', sans-serif", size: 12, color: '#e2e6f3' },
  },
  hovermode: 'closest',
  showlegend: false, // a legenda é renderizada em HTML (#chart-legend)
};

const PLOT_CONFIG = {
  responsive: true,
  displayModeBar: true,
  displaylogo: false,
  modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'],
  toImageButtonOptions: { format: 'png', filename: 'fronteira_pareto_psnr_vram', scale: 2 },
};

/* ---------- Inicialização ---------- */

async function initParetoChart() {
  const target = document.getElementById('pareto-chart');
  if (!target) return;

  let runs;
  try {
    ({ runs } = await loadData());
  } catch (err) {
    target.innerHTML =
      '<p style="padding:2rem 0">Não foi possível carregar os dados de <code>' + CSV_URL + '</code>.</p>';
    console.error(err);
    return;
  }

  const sizeOf = makeSizeScale(runs);

  const draw = mode => {
    const visible = mode === 'ambas' ? runs : runs.filter(r => r.scene === mode);
    Plotly.react(target, buildTraces(runs, mode, sizeOf), LAYOUT, PLOT_CONFIG);
    renderLegend(mode);
    renderStats(visible);
  };

  const buttons = Array.from(document.querySelectorAll('.scene-btn'));
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.toggle('active', b === btn));
      draw(btn.dataset.scene);
    });
  });

  const initial = buttons.find(b => b.classList.contains('active'));
  draw(initial ? initial.dataset.scene : 'chair');
}

document.addEventListener('DOMContentLoaded', initParetoChart);
