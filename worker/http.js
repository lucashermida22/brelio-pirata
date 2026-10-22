// Utilidades HTTP comunes: respuestas JSON y errores uniformes.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

export const errorJson = (status, message, headers = {}) => json({ error: message }, status, headers);

// Lee el cuerpo JSON; 400 si no es un objeto válido
export async function readJson(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, 'El cuerpo debe ser JSON válido');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'El cuerpo debe ser un objeto JSON');
  return body;
}
