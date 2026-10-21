
TEAM_NAMES = ['Real Suplicio FC','Atlético Lumbago','Sporting de Ibuprofeno','Deportivo Paracetamol','Inter de Urgencias','Los Tiburones de la UCI','Bayern Muchachos','Manchester Cojo','Borussia Dormund','Juventus Fatigada','Olympique de Mareos','PSG (Pierna Sin Gas)','Racing de Rodilla','Club Meniscos Rotos','Unión Deportiva Agujetas','Celta de Siesta','Los Vikingos del Esguince','Los Galácticos del Ambulatorio','Los Dragones de la Sala de Espera','Los Halcones del Gotelé','Rayo Vallecano de Espalda','Spartak de Moscú-Lugo','Ajax Gastritis','Los Cirujanos del Caos','Athletic de Bilbao Sin Gas','Dinamo de Kiev-Kebab','Los Pibes del Botiquín','Benfica Contractura','Galatasaray Saray Saray','Los Reyes del Fuera de Juego']
import json
rep=[
("  const PRICES = [", "  const TEAM_NAMES = " + json.dumps(TEAM_NAMES, ensure_ascii=False) + ";\n  const PRICES = ["),
("    const dxs = shuffle(DIAGNOSES);\n", "    const dxs = shuffle(DIAGNOSES);\n    const tnames = shuffle(TEAM_NAMES);\n"),
("      svc: services[i % services.length], bar:", "      name: tnames[i % tnames.length], svc: services[i % services.length], bar:"),
('<span class="svc">Equipo ${i+1}</span>', '<span class="svc">${esc(tm.name)}</span>'),
("lastTeams.map((t,i) => `Equipo ${i+1} (${t.svc}):\\n`", "lastTeams.map((t,i) => `${t.name} (${t.svc}):\\n`"),
(".team .members li{animation", ".vs-team-name span{text-align:center;text-wrap:balance}\n.vs-team-name{max-width:calc(var(--cols) * var(--card) + (var(--cols) - 1) * 10px);justify-content:center}\n.team .members li{animation"),
]
for a,b in rep:
    assert s.count(a)==1, a
    s=s.replace(a,b)
