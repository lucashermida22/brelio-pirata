
rep=[
('<article class="team" style="animation-delay:${i*60}ms">','<article class="team${tm.winner ? \' won\' : \'\'}" style="animation-delay:${i*60}ms">'),
('<div class="left"><span class="sesion">Sesión</span>${tm.members.length} paciente${tm.members.length===1?\'\':\'s\'}</div>',
 '<div class="left"><span class="sesion">Sesión</span>${tm.members.length} paciente${tm.members.length===1?\'\':\'s\'}${tm.winner ? \'<span class="won-badge">🏆 Ganador</span>\' : (teams.length > 1 ? `<button class="btn-sm win-btn" type="button" data-win="${i}">🏆 Ganador</button>` : \'\')}</div>'),
("lastTeams.map((t,i) => `${t.name} (${t.svc}):\\n`", "lastTeams.map((t,i) => `${t.winner ? '🏆 ' : ''}${t.name} (${t.svc}):\\n`"),
]
for a,b in rep:
    assert s.count(a)==1, a[:70]
    s=s.replace(a,b)
