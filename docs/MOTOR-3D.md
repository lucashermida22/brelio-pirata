# Motor 3D (three.js r185 + postprocessing + N8AO)

Todas las escenas 3D usan el motor común de `app/versus/gl.js`. Ninguna crea su propio
`WebGLRenderer` ni su `EffectComposer` (salvo un lienzo de superposición transparente muy justificado).

```js
const g = await ctx.three({
  clear: 0x05010d, fov: 45, near: .1, far: 600,
  tone: 'neutral',            // 'neutral' (por defecto, respeta colores de marca) | 'aces_filmic' | 'agx'
  env: true, envIntensity: .6, // reflejos PBR con RoomEnvironment (o g.scene.environment = tu PMREM)
  bloom: { intensity: 1, threshold: .6, radius: .7, smoothing: .25 },   // o el array antiguo [fuerza, radio, umbral]
  ao: { radius: 2, intensity: 2.2, falloff: 1 },   // oclusión ambiental N8AO (false = sin AO)
  godrays: true,              // g.post.godrays.lightSource = tuMallaDeSol (transparente, sin depthWrite)
  dof: { focusDistance, focalLength, bokehScale },
  vignette: { offset: .32, darkness: .5 }, ca: .0006, grain: .05, shadows: true, clipping: false,
});
const { T, scene, cam, renderer, post, tex, sun, q } = g;   // q.hi / q.mob / q.shadow
sun(dirLight, { size: 40, res: q.shadow, radius: 3, bias: -.0004, normalBias: .02, far: 400 }); // sombra suave PCF
g.start((t, dt) => { … });                                   // bucle; el cierre lo limpia todo (vs.fxStop)
```

`T` trae además: `T.PP` (todo `postprocessing`), `T.N8AOPostPass`, `T.RoomEnvironment`,
`T.RoundedBoxGeometry`, `T.mergeGeometries`, `T.mergeVertices`, `T.Sky`, `T.SimplexNoise`.
Para algo más de `three/examples/jsm`, impórtalo en la escena con `import(...)`.

## Reglas de color e iluminación (importante al portar código r128)

- Pipeline **lineal y HDR**; el tono y el sRGB se aplican al final. No uses `outputEncoding`, `sRGBEncoding` ni `texture.encoding`:
  `tex(canvas)` ya marca `SRGBColorSpace`. Para una `T.Texture(img)` pon `t.colorSpace = T.SRGBColorSpace`.
- **Luces físicas**: respecto a r128, multiplica por ~π la intensidad de las luces direccionales, hemisféricas y ambientales.
  Las `PointLight` y `SpotLight` caen con 1/d² (`decay` 2): usa intensidades de decenas o cientos, y `distance` como corte.
- **ShaderMaterial** propio: los colores escritos a mano son sRGB → conviértelos con `GLSL_SRGB` (`s2l(c)`, exportado de `@kit`).
- **Emisión/HDR**: para que algo brille con el bloom, usa colores > 1 (`new T.Color(0xffeecc).multiplyScalar(4)` en
  `MeshBasicMaterial`, o `emissive` + `emissiveIntensity` en materiales estándar). El umbral del bloom recorta lo demás.
- Los sprites con caras/nombres son UI: el tono `neutral` casi no los altera; evita bloom fuerte sobre ellos.
- Materiales: `MeshStandardMaterial`/`MeshPhysicalMaterial` (clearcoat para pintura de coche) aprovechan el entorno.
  Las sombras necesitan `castShadow`/`receiveShadow` en cada malla y una luz con `sun(...)`.

## Rendimiento

- `q.mob`: menos instancias, AO a media resolución, sombras de 1024, sin MSAA (pasa a SMAA).
- Comparte geometrías y materiales; usa `InstancedMesh` para vegetación, partículas y repeticiones.

## Ciclo de vida y arranque (motor persistente)

- Hay **un solo `WebGLRenderer`** (y su canvas, el entorno PMREM y la caché de programas de three) durante toda la sesión.
  `glInit` devuelve escena, cámara y composer nuevos; al cerrar (`vs.fxStop`) se liberan geometrías, texturas y sombras
  de la escena y se restablece el renderer (tono, sombras, clipping, tamaño…). Los **materiales no se liberan** a propósito:
  `material.dispose()` destruye su programa y la siguiente animación tendría que recompilarlo. Si el contexto se pierde, o la
  caché pasa de 400 programas, el renderer se recrea solo.
- `g.start(fn)` **compila antes de pintar**: `renderer.compileAsync` (KHR_parallel_shader_compile) sobre la escena y los
  materiales de los pases de postproceso; también con las luces ocultas visibles. Solo entonces arranca el bucle y `et`
  cuenta desde la llamada a `g.start` (sincronizado con la música; el primer fotograma llega con et ≈ tiempo de compilación). Para algo que añadas luego (huevos, explosiones): `await g.precompile(obj)` antes de
  `scene.add(obj)`. Construye la escena (luces, sombras, materiales) **antes** de `g.start`.
- `renderer.debug.checkShaderErrors` solo está activo en desarrollo (en producción evita un `getProgramInfoLog` síncrono por programa).
- Resolución adaptativa: si la media de ~1 s pasa de 22 ms baja el pixel ratio (mín. 1 en escritorio, .75 en móvil) y luego el AO
  a media resolución; sube de nuevo si va por debajo de 12 ms. `window.__noAdapt = true` la desactiva.
- Depuración: `window.__brelioGL.renderer.info` (memoria y programas).

## Probar

```sh
npm run build && npx vite preview --port 4177 &
NODE_PATH=$(npm root -g) node scripts/shot.cjs <id> /tmp/salida 2500 6      # capturas cada 2,5 s
FF_SPEED=4 NODE_PATH=$(npm root -g) node scripts/shot.cjs furious /tmp/ff 2500 8 '' 960 540 nuclear
```
Chromium headless usa WebGL por software: va lento, pero sirve para ver el encuadre y errores.
