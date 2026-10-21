rep=[
('<button class="btn blue block" id="go">', '''<button class="btn block lol-toggle" id="lol" type="button" aria-pressed="false"><span class="lol-dot"></span>Botón LOL<small id="lolState">Off</small></button>
                <p class="hint lol-hint" id="lolHint">Asigna TOP, JUNGLA, MID, ADC y SUPPORT al generar.</p>
                <button class="btn blue block" id="go">'''),
('<span class="nm">${esc(p.name)}${ARROW}</span>', '''<span class="nm">${esc(p.name)}${ARROW}${p.role ? `<span class="lane" style="--lc:${LANE_COLORS[p.role]}">${p.role}</span>` : ''}</span>'''),
("  function showTeams(teams){", '''  const LANES = ['TOP','JUNGLA','MID','ADC','SUPPORT'];
  const DROP = ['SUPPORT','JUNGLA','TOP','ADC'];  // orden en que se quitan si faltan jugadores
  const LANE_COLORS = {TOP:'#dc2626',JUNGLA:'#15803d',MID:'#1a5ddc',ADC:'#d97706',SUPPORT:'#9333ea',BANQUILLO:'#71717a'};
  function assignLanes(teams){
    teams.forEach(t => {
      let lanes = [...LANES];
      for (let k = 0; lanes.length > t.members.length && k < DROP.length; k++) lanes = lanes.filter(l => l !== DROP[k]);
      const roles = shuffle(lanes);
      shuffle(t.members.map((_, i) => i)).forEach((mi, k) => { t.members[mi].role = roles[k] || 'BANQUILLO'; });
      const o = r => r === 'BANQUILLO' ? 99 : LANES.indexOf(r);
      t.members.sort((a, b) => o(a.role) - o(b.role));
    });
  }

  function showTeams(teams){'''),
("  $('#copy').addEventListener('click', async () => {", '''  let lolMode = false;
  try { lolMode = localStorage.getItem('brelio-lol') === '1'; } catch(e) {}
  const paintLol = () => {
    $('#lol').setAttribute('aria-pressed', lolMode);
    $('#lolState').textContent = lolMode ? 'On' : 'Off';
  };
  paintLol();
  $('#lol').addEventListener('click', () => {
    lolMode = !lolMode; paintLol();
    try { localStorage.setItem('brelio-lol', lolMode ? '1' : '0'); } catch(e) {}
    toast(lolMode ? 'Modo LOL activado. Nadie quiere ir de support.' : 'Modo LOL desactivado');
  });
  $('#copy').addEventListener('click', async () => {'''),
("    const teams = makeTeams();\n", "    const teams = makeTeams();\n    if (lolMode) assignLanes(teams);\n"),
("t.members.map(m => `  · ${m.name} — ${m.dx}`)", "t.members.map(m => `  · ${m.role ? '[' + m.role + '] ' : ''}${m.name} — ${m.dx}`)"),
(".team .members li{animation", '''.lane{display:inline-flex;align-items:center;height:18px;margin-left:6px;padding:0 6px;border-radius:5px;font:700 10px/1 var(--f-body);letter-spacing:.04em;vertical-align:1px;color:var(--lc);background:color-mix(in srgb,var(--lc) 12%,#fff);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--lc) 25%,#fff)}
.lol-toggle{justify-content:flex-start;gap:8px;margin-top:4px}
.lol-toggle small{margin-left:auto;font-size:11px;font-weight:600;color:var(--muted);background:var(--well);padding:2px 8px;border-radius:6px}
.lol-dot{width:8px;height:8px;border-radius:999px;background:var(--grey);transition:.2s}
.lol-toggle[aria-pressed="true"]{border-color:#f9a8d4;background:#fdf2f8;color:#9d1767}
.lol-toggle[aria-pressed="true"] small{background:#fce7f3;color:#c2127a}
.lol-toggle[aria-pressed="true"] .lol-dot{background:#ff3aa8;box-shadow:0 0 0 3px #fce7f3}
.lol-hint{margin:6px 0 12px;min-height:0}
.vs-lane{font:800 calc(var(--nfs,13px) * .78)/1 var(--f-body);letter-spacing:.06em;color:#fff;background:var(--lc);padding:4px 7px;border-radius:6px;box-shadow:0 2px 0 rgba(0,0,0,.18);opacity:0;transform:scale(.4) rotate(-8deg);transition:.35s cubic-bezier(.2,.9,.25,1.4) .12s}
.vs-card.landed .vs-lane{opacity:1;transform:none}
.team .members li{animation'''),
]
for a,b in rep:
    assert s.count(a)==1, a
    s=s.replace(a,b)
