"""MariaDB storage for the local Metrobús GTFS service."""
import csv
import hashlib
import io
import json
import time
import zipfile

import pymysql
from pymysql.cursors import DictCursor

GTFS_TABLES = ('routes', 'stops', 'trips', 'shapes', 'stop_times', 'calendar', 'calendar_dates', 'feed_info')
INDEXES = {
    'routes': ('route_id',),
    'stops': ('stop_id',),
    'trips': ('trip_id', 'route_id', 'service_id', 'shape_id'),
    'shapes': ('shape_id',),
    'stop_times': ('trip_id', 'stop_id'),
    'calendar': ('service_id',),
    'calendar_dates': ('service_id', 'date'),
}


def connect(config, *, database=True):
    return pymysql.connect(
        host=config.get('MYSQL_HOST', '127.0.0.1'),
        port=int(config.get('MYSQL_PORT', 3307)),
        user=config.get('MYSQL_USER', 'root'),
        password=config.get('MYSQL_PASSWORD', ''),
        database=config.get('MYSQL_DATABASE', 'metrobus_gtfs') if database else None,
        charset='utf8mb4',
        cursorclass=DictCursor,
        autocommit=False,
        connect_timeout=5,
        read_timeout=30,
        write_timeout=60,
    )


def setup(config):
    database = config.get('MYSQL_DATABASE', 'metrobus_gtfs')
    if not database.replace('_', '').isalnum():
        raise ValueError('Invalid database name')
    with connect(config, database=False) as connection:
        with connection.cursor() as cursor:
            cursor.execute(f'CREATE DATABASE IF NOT EXISTS `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
        connection.commit()
    with connect(config) as connection:
        with connection.cursor() as cursor:
            cursor.execute('CREATE TABLE IF NOT EXISTS metrobus_meta (name VARCHAR(64) PRIMARY KEY, value TEXT NOT NULL)')
            cursor.execute('CREATE TABLE IF NOT EXISTS live_snapshot (id TINYINT PRIMARY KEY, payload LONGTEXT NOT NULL)')
            cursor.execute('''CREATE TABLE IF NOT EXISTS vehicle_positions (
                vehicle_id VARCHAR(96) PRIMARY KEY,
                label VARCHAR(255), route_id VARCHAR(96), trip_id VARCHAR(96), shape_id VARCHAR(96),
                latitude DOUBLE NOT NULL, longitude DOUBLE NOT NULL,
                observed_at BIGINT NOT NULL, received_at BIGINT NOT NULL,
                INDEX idx_vehicle_route (route_id), INDEX idx_vehicle_observed (observed_at)
            )''')
        connection.commit()


def static_hash(config):
    with connect(config) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT value FROM metrobus_meta WHERE name='static_sha256'")
            row = cursor.fetchone()
            return row['value'] if row else None


def import_static(config, payload):
    digest = hashlib.sha256(payload).hexdigest()
    with zipfile.ZipFile(io.BytesIO(payload)) as archive, connect(config) as connection:
        for name in GTFS_TABLES:
            target = f'gtfs_{name}_next'
            with connection.cursor() as cursor:
                cursor.execute(f'DROP TABLE IF EXISTS `{target}`')
                with archive.open(name + '.txt') as source:
                    rows = csv.reader(io.TextIOWrapper(source, encoding='utf-8-sig'))
                    columns = next(rows)
                    if not columns or not all(column.replace('_', '').isalnum() for column in columns):
                        raise ValueError('Invalid GTFS header')
                    definitions = ', '.join(f'`{column}` TEXT' for column in columns)
                    cursor.execute(f'CREATE TABLE `{target}` ({definitions}) CHARACTER SET utf8mb4')
                    placeholders = ','.join('%s' for _ in columns)
                    batch = []
                    for row in rows:
                        if not row:
                            continue
                        if len(row) != len(columns):
                            raise ValueError(f'Invalid GTFS row in {name}')
                        batch.append(row)
                        if len(batch) == 500:
                            cursor.executemany(f'INSERT INTO `{target}` VALUES ({placeholders})', batch)
                            batch.clear()
                    if batch:
                        cursor.executemany(f'INSERT INTO `{target}` VALUES ({placeholders})', batch)
                for column in INDEXES.get(name, ()):
                    cursor.execute(f'CREATE INDEX `idx_{name}_{column}` ON `{target}` (`{column}`(96))')
                if name == 'stop_times':
                    cursor.execute(f'CREATE INDEX idx_stop_times_departure ON `{target}` (departure_time(8),trip_id(96))')
            connection.commit()
        with connection.cursor() as cursor:
            cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name LIKE 'gtfs_%'")
            existing = {row['table_name'] for row in cursor.fetchall()}
            renames = []
            for name in GTFS_TABLES:
                current = f'gtfs_{name}'
                previous = f'gtfs_{name}_previous'
                if current in existing:
                    cursor.execute(f'DROP TABLE IF EXISTS `{previous}`')
                    renames.append(f'`{current}` TO `{previous}`')
                renames.append(f'`{current}_next` TO `{current}`')
            cursor.execute('RENAME TABLE ' + ', '.join(renames))
            cursor.execute("INSERT INTO metrobus_meta (name,value) VALUES ('static_sha256',%s) ON DUPLICATE KEY UPDATE value=VALUES(value)", (digest,))
            cursor.execute("INSERT INTO metrobus_meta (name,value) VALUES ('static_imported_at',%s) ON DUPLICATE KEY UPDATE value=VALUES(value)", (str(int(time.time())),))
            for name in GTFS_TABLES:
                cursor.execute(f'DROP TABLE IF EXISTS `gtfs_{name}_previous`')
        connection.commit()
    rebuild_connections(config, payload)
    return digest


def network(config):
    with connect(config) as connection:
        with connection.cursor() as cursor:
            cursor.execute('SELECT * FROM gtfs_routes')
            routes = cursor.fetchall()
            cursor.execute('SELECT * FROM gtfs_stops')
            stops = cursor.fetchall()
            cursor.execute('SELECT shape_id,shape_pt_lat,shape_pt_lon FROM gtfs_shapes ORDER BY shape_id,CAST(shape_pt_sequence AS UNSIGNED)')
            shapes = {}
            for row in cursor.fetchall():
                shapes.setdefault(row['shape_id'], []).append([float(row['shape_pt_lat']), float(row['shape_pt_lon'])])
            cursor.execute('SELECT DISTINCT route_id,shape_id FROM gtfs_trips')
            by_route = {}
            for row in cursor.fetchall():
                by_route.setdefault(row['route_id'], []).append(row['shape_id'])
            for route in routes:
                route['shapeIds'] = by_route.get(route['route_id'], [])
            return {'routes': routes, 'stops': stops, 'shapes': shapes}


def trip_shape_map(config):
    with connect(config) as connection:
        with connection.cursor() as cursor:
            cursor.execute('SELECT trip_id,route_id,shape_id FROM gtfs_trips')
            return {row['trip_id']: (row['route_id'], row['shape_id']) for row in cursor.fetchall()}


def store_live(config, result):
    with connect(config) as connection:
        with connection.cursor() as cursor:
            cursor.execute('DELETE FROM vehicle_positions')
            rows = [(v['id'], v['label'], v['routeId'], v['tripId'], v['shapeId'], v['lat'], v['lng'], v['timestamp'], result['receivedAt']) for v in result['vehicles']]
            if rows:
                cursor.executemany('INSERT INTO vehicle_positions (vehicle_id,label,route_id,trip_id,shape_id,latitude,longitude,observed_at,received_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)', rows)
            cursor.execute('INSERT INTO live_snapshot (id,payload) VALUES (1,%s) ON DUPLICATE KEY UPDATE payload=VALUES(payload)', (json.dumps(result, ensure_ascii=False),))
        connection.commit()


def snapshot(config):
    with connect(config) as connection:
        with connection.cursor() as cursor:
            cursor.execute('SELECT payload FROM live_snapshot WHERE id=1')
            row = cursor.fetchone()
            return json.loads(row['payload']) if row else {'timestamp': 0, 'vehicles': []}

def connections_ready(config):
    with connect(config) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='gtfs_connections'")
            return cursor.fetchone()['count'] == 1


def rebuild_connections(config, payload):
    """Build a searchable timetable from the supplied GTFS ZIP."""
    def gtfs_seconds(value):
        hours, minutes, seconds = map(int, value.split(':'))
        return hours * 3600 + minutes * 60 + seconds

    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        with archive.open('trips.txt') as source:
            trips = {row['trip_id']: row for row in csv.DictReader(io.TextIOWrapper(source, encoding='utf-8-sig'))}
        with connect(config) as connection:
            with connection.cursor() as cursor:
                cursor.execute('DROP TABLE IF EXISTS gtfs_connections_next')
                cursor.execute('''CREATE TABLE gtfs_connections_next (
                    service_id VARCHAR(96) NOT NULL, trip_id VARCHAR(96) NOT NULL,
                    route_id VARCHAR(96) NOT NULL, shape_id VARCHAR(96) NOT NULL,
                    from_stop_id VARCHAR(96) NOT NULL, to_stop_id VARCHAR(96) NOT NULL,
                    departure_seconds INT NOT NULL, arrival_seconds INT NOT NULL,
                    pickup TINYINT NOT NULL, dropoff TINYINT NOT NULL
                ) CHARACTER SET utf8mb4''')
                batch = []
                previous = {}
                with archive.open('stop_times.txt') as source:
                    for row in csv.DictReader(io.TextIOWrapper(source, encoding='utf-8-sig')):
                        trip_id = row['trip_id']
                        old = previous.get(trip_id)
                        if old:
                            if int(row['stop_sequence']) <= int(old['stop_sequence']):
                                raise ValueError('GTFS stop sequence is not increasing')
                            trip = trips[trip_id]
                            batch.append((trip['service_id'], trip_id, trip['route_id'], trip['shape_id'],
                                          old['stop_id'], row['stop_id'], gtfs_seconds(old['departure_time']),
                                          gtfs_seconds(row['arrival_time']), old.get('pickup_type') != '1',
                                          row.get('drop_off_type') != '1'))
                            if len(batch) >= 1000:
                                cursor.executemany('INSERT INTO gtfs_connections_next VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)', batch)
                                batch.clear()
                        previous[trip_id] = row
                if batch:
                    cursor.executemany('INSERT INTO gtfs_connections_next VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)', batch)
                connection.commit()
                cursor.execute('CREATE INDEX idx_connections_service_time ON gtfs_connections_next (service_id,departure_seconds)')
                cursor.execute('DROP TABLE IF EXISTS gtfs_connections_previous')
                if connections_ready(config):
                    cursor.execute('RENAME TABLE gtfs_connections TO gtfs_connections_previous, gtfs_connections_next TO gtfs_connections')
                    cursor.execute('DROP TABLE gtfs_connections_previous')
                else:
                    cursor.execute('RENAME TABLE gtfs_connections_next TO gtfs_connections')
            connection.commit()
