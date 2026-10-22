// Worker de la paleta: descarga las fotos, las reduce en un OffscreenCanvas, saca sus colores
// (OKLab + k-means++) y monta la paleta y su degradado. Todo fuera del hilo principal.
// Entra: { id, size, photos: [{ key, url, swatches|null }] }
// Sale:  { id, swatches: { clave: [...]|null }, colors: [...]|null, gradient: Uint8Array|null }
import { analyzePixels, buildPalette, bakeGradient } from './quantize.js';

async function bitmapOf(blob, size) {
  // con tamaño de salida el navegador reduce bien (y decodifica menos); si no lo admite, entera
  try { return await createImageBitmap(blob, { resizeWidth: size, resizeHeight: size, resizeQuality: 'high' }); }
  catch (e) { return createImageBitmap(blob); }
}

async function analyze(url, size) {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const bmp = await bitmapOf(await res.blob(), size);
  const c = new OffscreenCanvas(size, size);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, 0, 0, size, size);
  if (bmp.close) bmp.close();
  return analyzePixels(g.getImageData(0, 0, size, size).data, size, size);
}

self.onmessage = async (e) => {
  const { id, size, photos } = e.data;
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
    self.postMessage({ id, unsupported: true });
    return;
  }
  const swatches = {};
  // de dos en dos: el navegador decodifica en paralelo sin pelearse por la red
  for (let i = 0; i < photos.length; i += 2) {
    await Promise.all(photos.slice(i, i + 2).map(async (p) => {
      if (p.swatches) { swatches[p.key] = p.swatches; return; }
      try { swatches[p.key] = await analyze(p.url, size); } catch (err) { swatches[p.key] = null; }
    }));
  }
  const lists = photos.map((p) => swatches[p.key]).filter((l) => l && l.length);
  let colors = lists.length ? buildPalette(lists) : null;
  if (colors && !colors.length) colors = null;
  const gradient = colors ? bakeGradient(colors, 256) : null;
  self.postMessage({ id, swatches, colors, gradient }, gradient ? [gradient.buffer] : []);
};
