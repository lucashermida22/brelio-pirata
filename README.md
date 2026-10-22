# Brelio · Pachangas

Generador de equipos aleatorios para pachangas, en clave de parodia de software de gestión.

Abre `index.html` en el navegador: es una sola página autocontenida (fotos, canciones y código incrustados). Three.js se carga desde CDN.

## Qué hace
- Lista de jugadores con foto asignable (toca el avatar).
- Reparto en N equipos o por tamaño, con nombres de equipo aleatorios.
- Botón LOL: asigna TOP / JUNGLA / MID / ADC / SUPPORT.
- Animaciones de revelado: Kawaii, Estudio de cine (Tierra 3D y clásico), GG EZ 3D, Bruh, Reggaetón, JoJo, Mati JoJo, Singularidad 3D, Feria (coches de choque), Tinder y Fast & Furious (escribe «mati» durante la animación 😉).
- Botón «Ganador» que repite la animación solo con el equipo ganador.

## Estructura
- `index.html` — la página final, lista para usar.
- `src/` — CSS y JS de cada animación.
- `assets/` — fotos y recortes de audio.
- `build/` — scripts que generaron `index.html` a partir de la página original.

## Fotos
- `assets/p1.jpg` … `p8.jpg` — recortes cuadrados que usa la página (foto1 … foto8).
- `assets/originales/` — las fotos originales completas y la ilustración de Mati.
- `assets/burst_fixed.jpg` — la foto principal ya girada.

## Contribuir
Cualquiera del grupo puede meter animaciones: mira [`CONTRIBUTING.md`](CONTRIBUTING.md).
Hacia dónde vamos (Cloudflare Workers + R2 para recursos + D1 para datos compartidos): [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).
