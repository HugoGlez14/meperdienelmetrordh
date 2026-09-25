"""Earliest-arrival journey search using GTFS calendars and scheduled connections."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import math, sqlite3
import mysql_storage
from contextlib import closing

ZONE = ZoneInfo('America/Mexico_City')
def seconds(value):
    h,m,s = map(int,value.split(':'))
    return h*3600+m*60+s

def distance(a,b):
    lat1,lon1,lat2,lon2=map(math.radians,[float(a['stop_lat']),float(a['stop_lon']),float(b['stop_lat']),float(b['stop_lon'])])
    return 6371000*2*math.asin(min(1,math.sqrt(math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2)))

def plan(db_path, origin, destination, now=None):
    now=now or datetime.now(ZONE)
    if now.tzinfo is None: raise ValueError('Timezone required')
    now=now.astimezone(ZONE)
    mysql=isinstance(db_path,dict)
    table='gtfs_' if mysql else ''
    cast='UNSIGNED' if mysql else 'INTEGER'
    placeholder='%s' if mysql else '?'
    with closing(mysql_storage.connect(db_path) if mysql else sqlite3.connect(db_path)) as db:
        if not mysql: db.row_factory=sqlite3.Row
        def query(sql,params=()):
            if not mysql: return db.execute(sql,params)
            cursor=db.cursor()
            cursor.execute(sql,params)
            return cursor
        stops={r['stop_id']:dict(r) for r in query(f'SELECT * FROM {table}stops')}
        if origin not in stops or destination not in stops or origin==destination:
            raise ValueError('Selecciona dos paradas diferentes.')
        routes={r['route_id']:dict(r) for r in query(f'SELECT * FROM {table}routes')}
        calendars=[dict(r) for r in query(f'SELECT * FROM {table}calendar')]
        exceptions=[dict(r) for r in query(f'SELECT * FROM {table}calendar_dates')]
        start=now.timestamp(); end=start+4*3600
        connections=[]
        for offset in (-1,0,1):
            day=(now+timedelta(days=offset)).date(); date=day.strftime('%Y%m%d')
            weekday=['monday','tuesday','wednesday','thursday','friday','saturday','sunday'][day.weekday()]
            active={c['service_id'] for c in calendars if c['start_date']<=date<=c['end_date'] and c[weekday]=='1'}
            for e in exceptions:
                if e['date']==date:
                    if e['exception_type']=='1': active.add(e['service_id'])
                    elif e['exception_type']=='2': active.discard(e['service_id'])
            if not active: continue
            midnight=datetime.combine(day,datetime.min.time(),ZONE).timestamp()
            if mysql:
                lower=max(0,int(start-midnight)); upper=int(end-midnight)
                if upper < 0: continue
                rows=query('SELECT trip_id,route_id,shape_id,from_stop_id,to_stop_id,departure_seconds,arrival_seconds,pickup,dropoff '
                           'FROM gtfs_connections WHERE service_id IN ('+','.join('%s' for _ in active)+') '
                           'AND departure_seconds BETWEEN %s AND %s',(*active,lower,upper))
                for row in rows:
                    dep=midnight+row['departure_seconds']; arr=midnight+row['arrival_seconds']
                    if start<=dep<=end and dep<=arr<=end:
                        connections.append((dep,arr,row['from_stop_id'],row['to_stop_id'],date+':'+row['trip_id'],row['route_id'],row['shape_id'],row['pickup'],row['dropoff']))
                continue
            else:
                rows=query(f'SELECT t.trip_id,t.route_id,t.shape_id,s.stop_id,s.arrival_time,s.departure_time,s.stop_sequence,s.pickup_type,s.drop_off_type FROM {table}trips t JOIN {table}stop_times s ON s.trip_id=t.trip_id WHERE t.service_id IN ('+','.join(placeholder for _ in active)+f') ORDER BY t.trip_id,CAST(s.stop_sequence AS {cast})',tuple(active))
            previous=None
            for row in rows:
                if previous and previous['trip_id']==row['trip_id']:
                    dep=midnight+seconds(previous['departure_time']); arr=midnight+seconds(row['arrival_time'])
                    if start<=dep<=end and dep<=arr<=end:
                        connections.append((dep,arr,previous['stop_id'],row['stop_id'],date+':'+row['trip_id'],row['route_id'],row['shape_id'],previous['pickup_type']!='1',row['drop_off_type']!='1'))
                previous=row
        connections.sort(key=lambda c:(c[0],c[1]))
        # Only short physical walks; do not invent transfers from equal station names.
        walking={s:[] for s in stops}
        for a in stops:
            for b in stops:
                if a==b: continue
                metres=distance(stops[a],stops[b])
                if metres<=120: walking[a].append((b,max(60,math.ceil(metres/1.1))))
        best={origin:(start,[])}; onboard={}
        def relax(stop,arrival,path):
            if arrival>=best.get(stop,(math.inf,))[0]: return
            best[stop]=(arrival,path)
            for other,duration in walking[stop]:
                if arrival+duration<best.get(other,(math.inf,))[0]:
                    best[other]=(arrival+duration,path+[{'kind':'walk','from':stop,'to':other,'departure':arrival,'arrival':arrival+duration}])
        relax(origin,start,[])
        # Seed neighboring platforms from origin (origin is already recorded above).
        for other,duration in walking[origin]: best[other]=(start+duration,[{'kind':'walk','from':origin,'to':other,'departure':start,'arrival':start+duration}])
        for dep,arr,a,b,trip,route,shape,pickup,dropoff in connections:
            boarded=onboard.get(trip)
            candidate=best.get(a)
            buffer=60 if candidate and any(p['kind']=='ride' for p in candidate[1]) else 0
            if pickup and candidate and candidate[0]+buffer<=dep and (boarded is None or candidate[0]<boarded[0]):
                boarded=(candidate[0],candidate[1]); onboard[trip]=boarded
            if boarded is None: continue
            path=boarded[1]+[{'kind':'ride','from':a,'to':b,'departure':dep,'arrival':arr,'tripId':trip,'routeId':route,'shapeId':shape}]
            onboard[trip]=(arr,path)
            if dropoff: relax(b,arr,path)
        if destination not in best: return {'found':False,'message':'No hay un viaje programado en las próximas cuatro horas para estas paradas.','calculatedAt':start}
        arrival,path=best[destination]; segments=[]
        for leg in path:
            if segments and leg['kind']=='ride' and segments[-1].get('tripId')==leg['tripId']:
                segments[-1]['to']=leg['to']; segments[-1]['arrival']=leg['arrival']; segments[-1]['stopIds'].append(leg['to'])
            else: segments.append({**leg,'stopIds':[leg['from'],leg['to']]})
        for segment in segments:
            segment['fromName']=stops[segment['from']]['stop_name']; segment['toName']=stops[segment['to']]['stop_name']
            if segment['kind']=='ride':
                segment['route']=routes[segment['routeId']]
                points=[[float(r['shape_pt_lat']),float(r['shape_pt_lon'])] for r in query(f'SELECT shape_pt_lat,shape_pt_lon FROM {table}shapes WHERE shape_id={placeholder} ORDER BY CAST(shape_pt_sequence AS {cast})',(segment['shapeId'],))]
                indices=[]; lower=0
                for stop_id in segment['stopIds']:
                    stop=stops[stop_id]
                    if points:
                        lower=min(range(lower,len(points)),key=lambda i:(points[i][0]-float(stop['stop_lat']))**2+(points[i][1]-float(stop['stop_lon']))**2)
                        indices.append(lower)
                segment['points']=points[indices[0]:indices[-1]+1] if indices else []
        return {'found':True,'basis':'schedule','calculatedAt':start,'departure':start,'arrival':arrival,'minutes':math.ceil((arrival-start)/60),'transfers':max(0,sum(s['kind']=='ride' for s in segments)-1),'segments':segments,'walkingNote':'Conexiones a pie de hasta 120 m por proximidad; verifica cruces y accesos.'}
