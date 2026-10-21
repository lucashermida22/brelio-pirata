# Brelio · Pachangas

Generador de equipos aleatorios para pachangas, en clave de parodia de software de gestión.

Abre `index.html` en el navegador: es una sola página autocontenida (fotos, canciones y código incrustados). Three.js se carga desde CDN.

## Qué hace
- Lista de jugadores con foto asignable (toca el avatar).
- Reparto en N equipos o por tamaño, con nombres de equipo aleatorios.
- Botón LOL: asigna TOP / JUNGLA / MID / ADC / SUPPORT.
- Animaciones de revelado: Kawaii, Estudio de cine (Tierra 3D y clásico), GG EZ 3D, Bruh, Reggaetón, JoJo, Mati JoJo, Singularidad 3D, Feria (coches de choque) y Tinder.
- Botón «Ganador» que repite la animación solo con el equipo ganador.

## Estructura
- `index.html` — la página final, lista para usar.
- `src/` — CSS y JS de cada animación.
- `assets/` — fotos y recortes de audio.
- `build/` — scripts que generaron `index.html` a partir de la página original.
