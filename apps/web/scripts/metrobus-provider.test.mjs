import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync, strToU8} from 'fflate';
import bindings from 'gtfs-realtime-bindings';
import {parseStatic, decodeLive} from '../server/gtfs-provider.mjs';
import handler from '../server/metrobus-proxy.mjs';

test('GTFS network preserves provider identities, shape order and trip assignment', () => {
  const files = {
    'routes.txt': 'route_id,route_short_name,route_long_name,route_color\nr1,1,Ruta uno,BE1830\n',
    'stops.txt': 'stop_id,stop_name,stop_lat,stop_lon\na,"Parada, Uno",19.4,-99.1\nb,Fuera de CDMX,0,0\n',
    'shapes.txt': 'shape_id,shape_pt_sequence,shape_pt_lat,shape_pt_lon\ns1,2,19.42,-99.12\ns1,1,19.4,-99.1\n',
    'trips.txt': 'trip_id,route_id,shape_id\nt1,r1,s1\n',
  };
  const archive = zipSync(Object.fromEntries(Object.entries(files).map(([name, value]) => [name, strToU8(value)])));
  const {network, trips} = parseStatic(archive);
  assert.equal(network.source, 'gtfs');
  assert.equal(network.planningMode, 'offline');
  assert.deepEqual(network.routes[0].shapeIds, ['s1']);
  assert.deepEqual(network.shapes.s1, [[19.4, -99.1], [19.42, -99.12]]);
  assert.equal(network.stops.length, 1);
  assert.equal(network.stops[0].stop_name, 'Parada, Uno');
  assert.deepEqual(trips.get('t1'), {routeId: 'r1', shapeId: 's1'});
});

test('realtime decoding rejects stale, future and out-of-city vehicles', () => {
  const now = 1800000000;
  const entity = (id, timestamp, latitude = 19.4) => ({id, vehicle: {
    trip: {tripId: 't1'}, vehicle: {id, label: id}, timestamp,
    position: {latitude, longitude: -99.1},
  }});
  const payload = bindings.transit_realtime.FeedMessage.encode({
    header: {gtfsRealtimeVersion: '2.0', timestamp: now},
    entity: [entity('fresh', now - 10), entity('stale', now - 121), entity('future', now + 100), entity('wrong', now, 0)],
  }).finish();
  const result = decodeLive(payload, new Map([['t1', {routeId: 'r1', shapeId: 's1'}]]), now);
  assert.equal(result.vehicles.length, 1);
  assert.equal(result.vehicles[0].id, 'fresh');
  assert.equal(result.vehicles[0].routeId, 'r1');
  assert.equal(result.stale, false);
});

async function invoke(url, method = 'GET') {
  const response = {headers: {}, setHeader(key, value) {this.headers[key] = value;}, status(code) {this.statusCode = code; return this;}, json(body) {this.body = body;}};
  await handler({url, method}, response);
  return response;
}

test('public API reports missing configuration, restricts endpoints and hides upstream secrets', async () => {
  const keys = ['METROBUS_API_TARGET', 'METROBUS_API_TOKEN', 'METROBUS_USER', 'METROBUS_PASSWORD'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  try {
    for (const key of keys) delete process.env[key];
    const missing = await invoke('/api/metrobus?endpoint=live');
    assert.equal(missing.statusCode, 503);
    assert.equal(missing.body.code, 'LIVE_NOT_CONFIGURED');
    assert.equal((await invoke('/api/metrobus?endpoint=../secret')).statusCode, 404);
    assert.equal((await invoke('/api/metrobus?endpoint=live', 'POST')).statusCode, 405);
    process.env.METROBUS_API_TARGET = 'https://backend.example';
    process.env.METROBUS_API_TOKEN = 'private-test-token';
    globalThis.fetch = async (url, options) => {
      assert.equal(url.origin, 'https://backend.example');
      assert.equal(url.pathname, '/api/metrobus/live');
      assert.equal(options.headers.Authorization, 'Bearer private-test-token');
      return {ok: true, json: async () => ({timestamp: 100, vehicles: [], error: 'secret signed URL'})};
    };
    const live = await invoke('/api/metrobus?endpoint=live&url=https://untrusted.example');
    assert.equal(live.statusCode, 200);
    assert.doesNotMatch(JSON.stringify(live.body), /secret|private-test-token/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});
