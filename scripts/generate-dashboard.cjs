const fs = require('fs');
const path = require('path');

const heatmap = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'experiment-results', 'dr-counterfactual', 'heatmap.json'), 'utf8'));
const p003 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'experiment-results', 'wwii-counterfactual', 'p003-calibrated-summary.json'), 'utf8'));

const gdpData = p003.metrics.filter(m => m.name === 'gdp' && m.path.includes('nations')).map(m => ({
  name: m.path.split('.')[1],
  meanB: (m.mean / 1e9).toFixed(1),
  d: m.cohensD.toFixed(2),
  sig: m.significant
}));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Somnium Engine — Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 2rem; }
  .container { max-width: 1200px; margin: 0 auto; }
  header { border-bottom: 1px solid #30363d; padding-bottom: 1.5rem; margin-bottom: 2rem; }
  h1 { font-size: 2rem; color: #58a6ff; }
  .subtitle { color: #8b949e; font-style: italic; margin-top: 0.3rem; }
  .tagline { color: #58a6ff; font-size: 0.9rem; margin-top: 0.5rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1.25rem; }
  .card h2 { font-size: 1rem; color: #58a6ff; margin-bottom: 0.75rem; border-bottom: 1px solid #21262d; padding-bottom: 0.5rem; }
  .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; margin-left: 0.5rem; }
  .badge-done { background: #1b4522; color: #3fb950; }
  .badge-wip { background: #452b1b; color: #d29922; }
  .badge-next { background: #1b2b45; color: #58a6ff; }
  .badge-sig { background: #1b4522; color: #3fb950; }
  .badge-ns { background: #452b1b; color: #d29922; }
  .bar-group { margin: 0.5rem 0; }
  .bar-label { display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.2rem; }
  .bar { height: 16px; background: #21262d; border-radius: 8px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 8px; transition: width 0.5s; }
  .bar-fill-primary { background: #58a6ff; }
  .bar-fill-secondary { background: #d29922; }
  .stat-row { display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #21262d; font-size: 0.85rem; }
  .stat-row:last-child { border-bottom: none; }
  .stat-label { color: #8b949e; }
  .stat-value { font-weight: 600; }
  .sector-list { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
  .sector-tag { padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.8rem; border: 1px solid #30363d; background: #0d1117; }
  .sector-tag.done { border-color: #3fb950; color: #3fb950; }
  .footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid #30363d; text-align: center; color: #484f58; font-size: 0.85rem; }
  @media (max-width: 768px) { body { padding: 1rem; } .grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>⚙ Somnium Engine</h1>
    <div class="subtitle">Kronos Engine — Deterministic Multi-Scale Counterfactual Simulator</div>
    <div class="tagline">"One engine, infinite timelines"</div>
  </header>

  <div class="grid">
    <div class="card">
      <h2>Phase Progress</h2>
      <div class="stat-row"><span class="stat-label">Phase 0 — Foundation</span><span class="stat-value"><span class="badge badge-done">Done</span></span></div>
      <div class="stat-row"><span class="stat-label">Phase 1 — Calibration</span><span class="stat-value"><span class="badge badge-done">Done</span></span></div>
      <div class="stat-row"><span class="stat-label">Phase 2 — Scale &amp; Publication</span><span class="stat-value"><span class="badge badge-wip">Paper (v4)</span></span></div>
      <div class="stat-row"><span class="stat-label">Phase 3 — Product</span><span class="stat-value"><span class="badge badge-next">Deferred</span></span></div>
      <div class="stat-row"><span class="stat-label">Tests</span><span class="stat-value">197+ passing</span></div>
    </div>

    <div class="card">
      <h2>Sectors (6 + 1 sentinel)</h2>
      <div class="sector-list">
        <span class="sector-tag done">Geopolitics</span>
        <span class="sector-tag done">Climate</span>
        <span class="sector-tag done">Economy</span>
        <span class="sector-tag done">Technology</span>
        <span class="sector-tag done">Energy</span>
        <span class="sector-tag done">Demographics</span>
        <span class="sector-tag done">Deers Rock (sentinel)</span>
      </div>
      <div style="margin-top: 1rem;">
        <div class="stat-row"><span class="stat-label">Historical Eras</span><span class="stat-value">6 (14 Rewind Points)</span></div>
        <div class="stat-row"><span class="stat-label">Agents</span><span class="stat-value">5 OMO agents</span></div>
        <div class="stat-row"><span class="stat-label">GitHub</span><span class="stat-value">rikirinjani/Kronos-Engine</span></div>
      </div>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <h2>30-Hospital Sentinel Heatmap</h2>
      <div style="font-size:0.8rem;color:#8b949e;margin-bottom:0.75rem;">5 regions, 4 sentinel metrics, 10 ticks</div>
      ${heatmap.map(r => `
      <div class="bar-group">
        <div class="bar-label"><span>${r.region} <span style="color:#8b949e;font-size:0.75rem;">(${r.hospitals} hospitals)</span></span><span>${(r.parentOccupancy*100).toFixed(1)}%</span></div>
        <div class="bar"><div class="bar-fill bar-fill-primary" style="width:${r.parentOccupancy*100}%"></div></div>
      </div>`).join('')}
      <div style="margin-top:0.75rem;font-size:0.8rem;color:#8b949e;">Baseline occupancy (parent timeline). Kalimantan highest, Sulawesi lowest.</div>
    </div>

    <div class="card">
      <h2>P-003 — WWII Counterfactual</h2>
      <div style="font-size:0.8rem;color:#8b949e;margin-bottom:0.75rem;">30 seeds, 1,421 metrics, 36 significant</div>
      ${gdpData.map(g => `
      <div class="stat-row">
        <span class="stat-label">${g.name}</span>
        <span class="stat-value">${g.meanB}B GDP <span class="badge ${g.sig ? 'badge-sig' : 'badge-ns'}">d=${g.d}${g.sig ? ' ✅' : ''}</span></span>
      </div>`).join('')}
      <div style="margin-top:0.75rem;font-size:0.8rem;color:#8b949e;">GDP difference (no-war − baseline). All 9 nations significant, d > 1.0.</div>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <h2>P-004 — DR Sentinel Counterfactual</h2>
      <div style="font-size:0.8rem;color:#8b949e;margin-bottom:0.75rem;">30 seeds, 20 ticks, 156 metrics, 14 significant</div>
      <div class="stat-row"><span class="stat-label">Occupancy Rate</span><span class="stat-value">d=0.70 <span class="badge badge-sig">Sig</span></span></div>
      <div class="stat-row"><span class="stat-label">Disease Prevalence</span><span class="stat-value">d=0.91 <span class="badge badge-sig">Sig</span></span></div>
      <div class="stat-row"><span class="stat-label">CSSD Cycles</span><span class="stat-value">d=-2.71 <span class="badge badge-sig">Sig</span></span></div>
      <div class="stat-row"><span class="stat-label">Dialysis Sessions</span><span class="stat-value">d=1.11 <span class="badge badge-sig">Sig</span></span></div>
      <div class="stat-row"><span class="stat-label">Outcome Records</span><span class="stat-value">d=0.58 <span class="badge badge-sig">Sig</span></span></div>
    </div>

    <div class="card">
      <h2>Architecture</h2>
      <pre style="font-size:0.75rem;line-height:1.5;color:#8b949e;background:#0d1117;padding:0.75rem;border-radius:6px;border:1px solid #21262d;">
Kronos Engine (macro, 1 tick = 1 day)
  ↓ MacroConditionPacket
Adapter Layer (translation)
  ↓ admissionMultiplier, diagnosis weights
Deers Rock (micro, 1 tick = 1 min) [×30 sentinels]
  ↑ HospitalSentinelOutput
Adapter Layer (aggregation)
  ↑ occupancy, mortality, disease prevalence
Kronos Engine</pre>
      <div style="margin-top:0.75rem;font-size:0.8rem;color:#58a6ff;"><i>"The world does not reach into the hospital. It knocks on the adapter's door and waits for the signal."</i></div>
    </div>
  </div>

  <div class="footer">
    Somnium Engine / Kronos Engine &mdash; v0.1.0 &mdash; <a href="https://github.com/rikirinjani/Kronos-Engine" style="color:#58a6ff;">github.com/rikirinjani/Kronos-Engine</a>
  </div>
</div>
</body>
</html>`;

const outPath = path.join(__dirname, '..', 'dashboard.html');
fs.writeFileSync(outPath, html);
console.log('Dashboard written to ' + outPath);
