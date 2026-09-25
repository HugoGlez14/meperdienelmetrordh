import {providerData} from './gtfs-provider.mjs';
const endpoints = new Set(['network', 'live', 'plan']);

// Only an operator-configured origin may receive requests; never a client URL.
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const send = (status, payload) => response.status(status).json(payload);
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return send(405, {error: 'Método no permitido.'});
  }
  const input = new URL(request.url, 'https://metrobus.invalid');
  const endpoint = request.query?.endpoint || input.searchParams.get('endpoint');
  if (!endpoints.has(endpoint)) return send(404, {error: 'Recurso no encontrado.'});
  const target = process.env.METROBUS_API_TARGET;
  if (!target) {
    if (!process.env.METROBUS_USER || !process.env.METROBUS_PASSWORD) {
      return send(503, {code: 'LIVE_NOT_CONFIGURED', error: 'El servicio de tiempo real todavía no está conectado.'});
    }
    try {
      const data = await providerData(endpoint);
      if (Buffer.byteLength(JSON.stringify(data)) > 4_000_000) throw new Error('Response too large');
      return send(200, data);
    } catch {
      return send(503, {code: 'PROVIDER_UNAVAILABLE', error: 'No se pudo actualizar el proveedor de Metrobús.'});
    }
  }
  try {
    const base = new URL(target);
    if (base.protocol !== 'https:' || base.username || base.password) {
      return send(503, {code: 'LIVE_NOT_CONFIGURED', error: 'El servicio de tiempo real todavía no está conectado.'});
    }
    const upstream = new URL(`/api/metrobus/${endpoint}`, base.origin);
    if (endpoint === 'plan') {
      for (const name of ['from', 'to']) {
        const value = input.searchParams.get(name);
        if (!value || value.length > 200) return send(400, {error: 'Selecciona dos paradas válidas.'});
        upstream.searchParams.set(name, value);
      }
      if (upstream.searchParams.get('from') === upstream.searchParams.get('to')) {
        return send(400, {error: 'Selecciona dos paradas diferentes.'});
      }
    }
    const headers = {Accept: 'application/json'};
    if (process.env.METROBUS_API_TOKEN) headers.Authorization = `Bearer ${process.env.METROBUS_API_TOKEN}`;
    const result = await fetch(upstream, {
      headers, redirect: 'error', signal: AbortSignal.timeout(endpoint === 'plan' ? 25000 : 8000),
    });
    if (!result.ok) return send(result.status === 400 ? 400 : 503, {error: 'El servicio de tiempo real no está disponible en este momento.'});
    const data = await result.json();
    const valid = endpoint === 'network'
      ? Array.isArray(data?.routes) && Array.isArray(data?.stops) && data?.shapes && typeof data.shapes === 'object'
      : endpoint === 'live' ? Array.isArray(data?.vehicles) && Number.isFinite(data?.timestamp)
      : typeof data?.found === 'boolean';
    if (!valid) throw new Error('Invalid upstream response');
    // Provider errors can contain private URLs; expose only a generic message.
    if (data.error) data.error = 'No se pudo actualizar el proveedor de posiciones.';
    return send(200, data);
  } catch {
    return send(503, {error: 'El servicio de tiempo real no está disponible en este momento.'});
  }
}
