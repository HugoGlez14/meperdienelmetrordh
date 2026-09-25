import {unzipSync} from 'fflate';
import {parse} from 'csv-parse/sync';
import bindings from 'gtfs-realtime-bindings';

const AUTH_URL = 'https://metrobus-gtfs.sinopticoplus.com/gtfs-api/partnerValidation';
const caches = new Map();
function cached(key, ttl, create) {
  const entry = caches.get(key);
  if (entry && entry.expires > Date.now()) return entry.promise;
  const next = {expires: Date.now() + ttl, promise: null};
  next.promise = Promise.resolve().then(create).catch(error => {
    if (caches.get(key) === next) caches.delete(key);
    throw error;
  });
  caches.set(key, next);
  return next.promise;
}

async function download(url, limit) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Invalid provider URL');
  const response = await fetch(parsed, {redirect: 'error', signal: AbortSignal.timeout(25000)});
  if (!response.ok || Number(response.headers.get('content-length')) > limit) throw new Error('Provider download failed');
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) throw new Error('Feed too large');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, length);
  } finally { await reader.cancel(); }
}

function session() {
  return cached('session', 7 * 60000, async () => {
    const response = await fetch(AUTH_URL, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({usuario: process.env.METROBUS_USER, senha: process.env.METROBUS_PASSWORD}),
      signal: AbortSignal.timeout(10000), redirect: 'error',
    });
    if (!response.ok) throw new Error('Provider authentication failed');
    const value = await response.json();
    if (!value.urlStatic || !value.urlRealTime) throw new Error('Invalid provider session');
    return value;
  });
}

export function parseStatic(payload) {
  const names = new Set(['routes.txt', 'stops.txt', 'trips.txt', 'shapes.txt']);
  let totalSize = 0;
  const files = unzipSync(payload, {filter: file => {
    if (!names.has(file.name)) return false;
    totalSize += file.originalSize;
    if (totalSize > 128 * 1024 * 1024) throw new Error('Static feed too large');
    return true;
  }});
  const rows = name => {
    if (!files[name]) throw new Error('Incomplete GTFS feed');
    return parse(Buffer.from(files[name]), {columns: true, bom: true, skip_empty_lines: true});
  };
  const routes = rows('routes.txt').map(row => ({
    route_id: row.route_id, route_short_name: row.route_short_name,
    route_long_name: row.route_long_name,
    route_color: /^[0-9a-f]{6}$/i.test(row.route_color) ? row.route_color : 'BE1830', shapeIds: [],
  }));
  const stops = rows('stops.txt').filter(row => validPosition(+row.stop_lat, +row.stop_lon)).map(row => ({
    stop_id: row.stop_id, stop_name: row.stop_name, stop_lat: row.stop_lat, stop_lon: row.stop_lon,
  }));
  const grouped = new Map();
  for (const row of rows('shapes.txt')) {
    if (!validPosition(+row.shape_pt_lat, +row.shape_pt_lon)) continue;
    if (!grouped.has(row.shape_id)) grouped.set(row.shape_id, []);
    grouped.get(row.shape_id).push([+row.shape_pt_sequence, +row.shape_pt_lat, +row.shape_pt_lon]);
  }
  const shapes = Object.create(null);
  for (const [id, points] of grouped) {
    points.sort((a, b) => a[0] - b[0]);
    // Bound the public response for Vercel; keep ordered endpoints and up to 600 points per shape.
    const stride = Math.max(1, Math.ceil(points.length / 600));
    shapes[id] = points.filter((_, index) => index % stride === 0 || index === points.length - 1).map(p => p.slice(1));
  }
  const trips = new Map();
  const byRoute = new Map(routes.map(route => [route.route_id, new Set()]));
  for (const trip of rows('trips.txt')) {
    trips.set(trip.trip_id, {routeId: trip.route_id, shapeId: trip.shape_id});
    if (shapes[trip.shape_id]) byRoute.get(trip.route_id)?.add(trip.shape_id);
  }
  for (const route of routes) route.shapeIds = [...byRoute.get(route.route_id)];
  if (!routes.length || !stops.length || !Object.keys(shapes).length) throw new Error('Empty network');
  return {network: {source: 'gtfs', planningMode: 'offline', routes, stops, shapes}, trips};
}

const validPosition = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && lat >= 19.1 && lat <= 19.7 && lng >= -99.4 && lng <= -98.8;
export function decodeLive(payload, trips = new Map(), now = Date.now() / 1000) {
  const feed = bindings.transit_realtime.FeedMessage.decode(payload);
  const timestamp = Number(feed.header.timestamp || 0);
  const vehicles = [];
  for (const entity of feed.entity) {
    const vehicle = entity.vehicle;
    if (!vehicle?.position || !validPosition(vehicle.position.latitude, vehicle.position.longitude)) continue;
    const observed = Number(vehicle.timestamp || timestamp);
    if (!observed || observed > now + 30 || now - observed > 120) continue;
    const trip = trips.get(vehicle.trip?.tripId);
    vehicles.push({
      id: vehicle.vehicle?.id || entity.id, label: vehicle.vehicle?.label || '',
      routeId: vehicle.trip?.routeId || trip?.routeId || '', tripId: vehicle.trip?.tripId || '',
      shapeId: trip?.shapeId || null, lat: vehicle.position.latitude, lng: vehicle.position.longitude, timestamp: observed,
    });
  }
  return {source: 'gtfs', timestamp, receivedAt: Math.floor(now), stale: !timestamp || now - timestamp > 120 || timestamp > now + 30, vehicles};
}

function staticFeed() {
  return cached('static', 60 * 60000, async () => {
    const urls = await session();
    return parseStatic(await download(urls.urlStatic, 32 * 1024 * 1024));
  });
}

export async function providerData(endpoint) {
  if (endpoint === 'network') return (await staticFeed()).network;
  if (endpoint === 'live') return cached('live', 20000, async () => {
    const urls = await session();
    const payload = await download(urls.urlRealTime, 8 * 1024 * 1024);
    // Positions are independent of the large static download.
    const staticEntry = caches.get('static');
    const data = staticEntry ? await staticEntry.promise.catch(() => null) : null;
    return decodeLive(payload, data?.trips);
  });
  return {found: false, message: 'Utiliza el planificador de estaciones para calcular tu recorrido.'};
}
