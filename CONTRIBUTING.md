# Cómo contribuir a Brelio

¡Gracias por querer aportar! Hay dos formas:

## 1. Proponer una idea (no hace falta programar)

Abre un issue con la plantilla **«Idea de animación»** y cuenta:
- la canción (y desde qué segundo),
- la referencia (vídeo, meme, anime…),
- qué pasa cuando aparecen los equipos y qué pasa en la repetición del ganador,
- si tiene easter egg.

## 2. Programar una animación

> Mientras se completa la migración descrita en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md),
> las animaciones viven en `src/` y se integran con los scripts de `build/`.
> Cuando exista `animations/`, cada animación será una carpeta independiente.

Flujo:
1. Crea una rama: `anim/<nombre>`.
2. Trabaja solo en los ficheros de tu animación (y su CSS/assets).
3. Abre un PR con la plantilla: describe la animación y adjunta capturas o un GIF.
4. Cuando el despliegue con Cloudflare esté activo, el PR tendrá su propia URL de preview para probarla.

### Reglas
- Cada animación debe funcionar en modo normal **y** en modo ganador.
- Nada de fotos de personas reales sin su permiso.
- Canciones: recortes cortos, e indica la fuente en el PR.
- Mantén alineación y consistencia de formas con el resto de la UI.
