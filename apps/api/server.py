"""Local GTFS service. Credentials and provider URLs never leave this process."""
import mysql_storage
import json, os, pathlib, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

BASE = pathlib.Path(__file__).resolve().parent
DATA = BASE / 'data'
DATA.mkdir(exist_ok=True)
LOCK = threading.Lock()
STATUS = {'error': None}

def environment():
    values = {}
    if (BASE / '.env').exists():
        values.update(line.split('=', 1) for line in (BASE / '.env').read_text(encoding='utf-8-sig').splitlines() if '=' in line and not line.startswith('#'))
    values.update(os.environ)
    return values

def download(url):
    if urlparse(url).scheme != 'https':
        raise ValueError('Expected HTTPS provider URL')
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()

def authenticate():
    env = environment()
    body = json.dumps({'usuario': env['METROBUS_USER'], 'senha': env['METROBUS_PASSWORD']}).encode()
    request = urllib.request.Request('https://metrobus-gtfs.sinopticoplus.com/gtfs-api/partnerValidation', data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)

def import_static(payload):
    mysql_storage.import_static(environment(), payload)
    (DATA / 'gtfs.zip').write_bytes(payload)

def network():
    return mysql_storage.network(environment())

def decode_realtime(payload):
    from google.transit import gtfs_realtime_pb2
    feed = gtfs_realtime_pb2.FeedMessage()
    feed.ParseFromString(payload)
    vehicles = []
    rejected = 0
    trip_map = mysql_storage.trip_shape_map(environment())
    for entity in feed.entity:
        if not entity.HasField('vehicle') or not entity.vehicle.HasField('position'):
            continue
        v = entity.vehicle
        if not (19.1 <= v.position.latitude <= 19.7 and -99.4 <= v.position.longitude <= -98.8):
            rejected += 1
            continue
        trip = trip_map.get(v.trip.trip_id)
        timestamp = int(v.timestamp or feed.header.timestamp)
        vehicles.append({'id': v.vehicle.id or entity.id, 'label': v.vehicle.label, 'routeId': v.trip.route_id or (trip[0] if trip else ''), 'tripId': v.trip.trip_id, 'shapeId': trip[1] if trip else None, 'lat': v.position.latitude, 'lng': v.position.longitude, 'timestamp': timestamp})
    result = {'timestamp': int(feed.header.timestamp), 'receivedAt': int(time.time()), 'vehicles': vehicles, 'rejectedPositions': rejected, 'tripUpdates': sum(e.HasField('trip_update') for e in feed.entity)}
    mysql_storage.store_live(environment(), result)
    (DATA / 'realtime.pb').write_bytes(payload)
    return result

def snapshot():
    result = mysql_storage.snapshot(environment())
    result['stale'] = time.time() - result['timestamp'] > 120
    result['error'] = STATUS['error']
    return result

def synchronize():
    urls, acquired = None, 0
    while True:
        try:
            if not urls or time.monotonic() - acquired > 480:
                urls, acquired = authenticate(), time.monotonic()
            if not mysql_storage.static_hash(environment()) or not (DATA / 'gtfs.zip').exists() or time.time() - (DATA / 'gtfs.zip').stat().st_mtime > 86400:
                import_static(download(urls['urlStatic']))
            decode_realtime(download(urls['urlRealTime']))
            STATUS['error'] = None
        except Exception as error:
            # Do not expose signed URLs, credentials, or provider response bodies.
            STATUS['error'] = 'No se pudo actualizar el proveedor (' + type(error).__name__ + ').'
            urls = None
        time.sleep(30)

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path
        try:
            if path == '/api/metrobus/plan':
                from planner import plan
                query = parse_qs(urlparse(self.path).query)
                with LOCK:
                    result = plan(environment(), query.get('from', [''])[0], query.get('to', [''])[0])
                return self.send_json(result)
            if path == '/api/metrobus/network':
                return self.send_json(network())
            if path == '/api/metrobus/live':
                return self.send_json(snapshot())
            downloads = {'/api/metrobus/download/static': ('gtfs.zip', 'application/zip'), '/api/metrobus/download/realtime': ('realtime.pb', 'application/octet-stream')}
            if path in downloads:
                name, mime = downloads[path]
                payload = (DATA / name).read_bytes()
                self.send_response(200)
                self.send_header('Content-Type', mime)
                self.send_header('Content-Disposition', 'attachment; filename="'+name+'"')
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return
            self.send_error(404)
        except ValueError:
            self.send_json({'error': 'Selecciona dos paradas v\u00e1lidas y diferentes.'}, 400)
        except Exception:
            self.send_json({'error': 'Datos todav\u00eda no disponibles. Intenta nuevamente en unos segundos.'}, 503)

    def send_json(self, data, status=200):
        payload = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

if __name__ == '__main__':
    mysql_storage.setup(environment())
    if (DATA / 'gtfs.zip').exists():
        if not mysql_storage.static_hash(environment()):
            import_static((DATA / 'gtfs.zip').read_bytes())
        elif not mysql_storage.connections_ready(environment()):
            mysql_storage.rebuild_connections(environment(), (DATA / 'gtfs.zip').read_bytes())
    threading.Thread(target=synchronize, daemon=True).start()
    print('Metrobus API: http://127.0.0.1:8787', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8787), Handler).serve_forever()
