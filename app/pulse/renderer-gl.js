// Pintor WebGL de la onda: un único triángulo a pantalla completa y un fragment shader que
// mezcla hasta 6 ondas (3 vivas + las que se están despidiendo). Cada onda trae su propia fila
// de paleta en una textura 256×8. El lienzo va DETRÁS del contenido, así que aquí solo se decide el color
// del fondo; el texto queda siempre encima y el shader cuida de que el fondo nunca baje de una
// luminancia mínima (legibilidad).
import { SLOTS, PAL_ROWS } from './wave.js';

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uRes;       // tamaño del lienzo (px de lienzo)
uniform float uPx;       // px de lienzo por px CSS
uniform float uTime;     // s (mueve el campo de color)
uniform float uFlow;     // 1 normal, 0 movimiento reducido (campo quieto)
uniform float uYMin;     // luminancia mínima del fondo resultante (sobre blanco)
uniform float uMaxA;     // tope de opacidad (para colores muy claros, que casi no oscurecen)
uniform vec4 uA[${SLOTS}];   // xy origen (px CSS de la ventana), z radio del frente, w ancho del borde
uniform vec4 uB[${SLOTS}];   // x relleno, y cresta, z radio del hueco central, w giro (rad)
uniform vec4 uC[${SLOTS}];   // x semilla, y fila de paleta (v), z alcance, w expansión del campo
uniform sampler2D uPal;

// --- ruido simplex 2D (Ashima Arts / Stefan Gustavson, licencia MIT) ---
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

const mat2 ROT = mat2(0.8, -0.6, 0.6, 0.8);

// ruido de gradiente entrelazado (Jimenez): tramado barato y sin patrón visible
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uPx;   // px CSS, origen arriba a la izquierda

  // ¿Llega aquí algún frente? Si no, transparente y fuera (al principio casi todo el lienzo sale por aquí)
  bool any = false;
  for (int i = 0; i < ${SLOTS}; i++) {
    if (uB[i].x + uB[i].y > 0.001 && length(p - uA[i].xy) < uA[i].z + uA[i].w * 1.1) any = true;
  }
  if (!any) { gl_FragColor = vec4(0.0); return; }

  // Remolino: cada onda gira y abre un poco el campo alrededor de su clic (más cerca, más). Se
  // componen todas, y como cada una empieza en 0 y se apaga con su relleno, nada salta.
  vec2 s = p;
  for (int i = 0; i < ${SLOTS}; i++) {
    float k = uB[i].x;
    if (k < 0.001) continue;
    vec2 v = s - uA[i].xy;
    float d = length(v);
    float th = uB[i].w * k * exp(-d / 680.0);
    float cs = cos(th), sn = sin(th);
    s = uA[i].xy + mat2(cs, sn, -sn, cs) * v * (1.0 - uC[i].w * k * exp(-d / 900.0));
  }

  // Campo de color común a todas las ondas (así, si se solapan, coinciden): ruido simplex con el
  // dominio deformado, manchas grandes y lentas; w también modula la densidad (nubes más o menos llenas)
  float t = uTime * uFlow;
  vec2 q = s / 820.0;
  vec2 w = vec2(snoise(q * 0.9 + vec2(1.7, 9.2 + 0.1 * t)), snoise(q * 0.9 + vec2(8.3 - 0.08 * t, 2.8)));
  vec2 qq = q + w * 0.48 + vec2(0.05 * t, -0.04 * t);
  float n1 = snoise(qq);
  float n = 0.74 * n1 + 0.26 * snoise(ROT * qq * 2.03 + 4.1);

  vec3 accC = vec3(0.0);
  float accW = 0.0, keep = 1.0, glint = 0.0;
  for (int i = 0; i < ${SLOTS}; i++) {
    vec4 A = uA[i]; vec4 B = uB[i]; vec4 C = uC[i];
    if (B.x + B.y < 0.001) continue;
    vec2 v = p - A.xy;
    float d = length(v);
    float R = A.z, F = A.w;
    float de = d + F * (0.16 * n1 + 0.12 * w.y);    // frente orgánico (lo deforma, suave, el propio campo)
    float x = (de - R) / F;                          // en anchos de borde: < 0 detrás del frente
    if (x > 0.62) continue;
    float front = 1.0 - smoothstep(-0.52, 0.52, x);                  // borde muy suave
    float body = mix(0.8, 1.0, exp(min(x, 0.0) * 1.3));            // junto al frente hay más energía
    float hol = smoothstep(B.z - F * 1.3, B.z + F * 0.9, de);        // el centro se vacía cuando la onda se va
    float I = min(1.0, B.x * front * body * hol * (0.84 + 0.26 * w.x));   // nubes más o menos llenas
    // cresta: banda algo más intensa justo en el frente, con el color corrido (una refracción)…
    float xc = (x + 0.08) / 0.16;
    float crest = B.y * exp(-xc * xc) * hol;
    // …y un brillo fino justo detrás: una línea más clara, como el canto de una lente
    float xg = (x + 0.3) / 0.075;
    glint = max(glint, B.y * exp(-xg * xg) * hol);
    // coordenada de paleta: el campo + un giro lento alrededor del clic + bandas que salen con el frente
    float ang = atan(v.y, v.x);
    float u = C.x + n * 0.27 + 0.05 * sin(ang + B.w * 1.4 + 2.0 * n) + (R - d) / 3200.0 + B.w * 0.05;
    vec3 col = texture2D(uPal, vec2(u, C.y)).rgb;
    vec3 colC = texture2D(uPal, vec2(u + 0.11, C.y)).rgb;
    float Ii = clamp(I + crest * 0.45, 0.0, 1.0);
    vec3 ci = mix(col, colC, crest / (I + crest + 0.001));
    // la que más pesa en este punto pone el color (cuadrado: transiciones suaves, sin barro)
    float wgt = Ii * Ii + 1e-6;
    accC += ci * wgt; accW += wgt;
    keep *= 1.0 - Ii;   // unión suave: varias ondas se suman sin pasar nunca de 1
  }
  float I = 1.0 - keep;
  if (I < 0.0015) { gl_FragColor = vec4(0.0); return; }
  vec3 col = accC / accW;

  // Legibilidad: a intensidad 1 el fondo resultante (sobre blanco) queda justo en uYMin de luminancia.
  // Y(a) ≈ Σ w·(1 − a·e)² con e = 1 − color → la opacidad tope sale de una cuadrática.
  vec3 e = 1.0 - col;
  vec3 W = vec3(0.2126, 0.7152, 0.0722);
  float s1 = dot(W, e), s2 = dot(W, e * e);
  float disc = s1 * s1 - s2 * (1.0 - uYMin);
  float cap = (disc >= 0.0 && s2 > 1e-5) ? (s1 - sqrt(disc)) / s2 : 1.0;
  float A = clamp(min(cap, uMaxA) * I * (1.0 - 0.36 * glint), 0.0, 1.0);

  // Tramado (dos ruidos distintos para color y alfa): sin bandas en degradados tan suaves
  float on = step(0.002, A);
  float r1 = ign(gl_FragCoord.xy) - 0.5;
  float r2 = ign(gl_FragCoord.xy + vec2(47.0, 13.0)) - 0.5;
  float Ad = clamp(A + r2 / 255.0 * on, 0.0, 1.0);
  vec3 pm = clamp(col * Ad + r1 / 255.0 * on, 0.0, Ad);
  gl_FragColor = vec4(pm, Ad);
}
`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error('Shader de la onda: ' + log);
  }
  return s;
}

// Crea el pintor sobre `canvas`. Devuelve null si no hay WebGL (o si solo hay WebGL por
// software y no se ha pedido expresamente: entonces va mejor el respaldo 2D).
export function createGLRenderer(canvas, { allowSoftware = false } = {}) {
  const attrs = {
    alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false,
    preserveDrawingBuffer: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: !allowSoftware,
  };
  let gl = null;
  try { gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs); } catch (e) { gl = null; }
  if (!gl) return null;

  let prog, buf, tex, loc;
  try {
    const vs = compile(gl, gl.VERTEX_SHADER, VERT), fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.linkProgram(prog);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error('Shader de la onda: ' + gl.getProgramInfoLog(prog));
  } catch (e) {
    console.warn(e.message || e);
    try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch (err) { /* nada */ }
    return null;
  }
  gl.useProgram(prog);
  // un triángulo que cubre toda la pantalla
  buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  // paletas: una fila de 256 texeles por hueco (se repite en horizontal: el degradado es cíclico)
  tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, PAL_ROWS, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(256 * PAL_ROWS * 4).fill(255));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  loc = {};
  ['uRes', 'uPx', 'uTime', 'uFlow', 'uYMin', 'uMaxA', 'uA', 'uB', 'uC', 'uPal'].forEach((k) => { loc[k] = gl.getUniformLocation(prog, k); });
  gl.uniform1i(loc.uPal, 0);
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);

  const A = new Float32Array(SLOTS * 4), B = new Float32Array(SLOTS * 4), C = new Float32Array(SLOTS * 4);
  let W = 0, H = 0, px = 1, clean = true;

  return {
    kind: 'webgl',
    lost: () => gl.isContextLost(),
    resize(cssW, cssH, scale) {
      const w = Math.max(1, Math.round(cssW * scale)), h = Math.max(1, Math.round(cssH * scale));
      if (w !== canvas.width || h !== canvas.height) { canvas.width = w; canvas.height = h; clean = true; }
      W = w; H = h; px = w / cssW;
    },
    // dormido: el lienzo a 1×1 libera su memoria (el contexto y el shader se quedan)
    sleep() { if (canvas.width !== 1 || canvas.height !== 1) { canvas.width = canvas.height = 1; W = H = 1; clean = true; } },
    setPalette(slot, bytes) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, slot, 256, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    },
    // waves: [{ slot, x, y, r, f, fill, rim, hollow, twist, seed, reach, zoom }]
    draw(waves, { time, flow, yMin, maxA }) {
      A.fill(0); B.fill(0); C.fill(0);
      for (const w of waves) {
        const o = w.slot * 4;
        A[o] = w.x; A[o + 1] = w.y; A[o + 2] = w.r; A[o + 3] = w.f;
        B[o] = w.fill; B[o + 1] = w.rim; B[o + 2] = w.hollow; B[o + 3] = w.twist;
        C[o] = w.seed; C[o + 1] = (w.slot + 0.5) / PAL_ROWS; C[o + 2] = w.reach; C[o + 3] = w.zoom || 0;
      }
      gl.viewport(0, 0, W, H);
      gl.uniform2f(loc.uRes, W, H);
      gl.uniform1f(loc.uPx, px);
      gl.uniform1f(loc.uTime, time);
      gl.uniform1f(loc.uFlow, flow);
      gl.uniform1f(loc.uYMin, yMin);
      gl.uniform1f(loc.uMaxA, maxA);
      gl.uniform4fv(loc.uA, A); gl.uniform4fv(loc.uB, B); gl.uniform4fv(loc.uC, C);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      clean = false;
    },
    clear() {
      if (clean) return;
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      clean = true;
    },
    // fuerza al driver a compilar de verdad (algunos lo dejan para el primer dibujo)
    warm() { gl.viewport(0, 0, 1, 1); gl.uniform4fv(loc.uB, B.fill(0)); gl.drawArrays(gl.TRIANGLES, 0, 3); clean = false; },
    destroy() {
      try { gl.deleteTexture(tex); gl.deleteBuffer(buf); gl.deleteProgram(prog); } catch (e) { /* contexto perdido */ }
      try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch (e) { /* nada */ }
    },
  };
}
