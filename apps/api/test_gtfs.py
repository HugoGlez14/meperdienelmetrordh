from contextlib import closing
import json, pathlib, sqlite3, tempfile, unittest
from datetime import datetime
from unittest.mock import patch
import planner, server

class PlannerTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.db=pathlib.Path(self.temp.name)/'test.sqlite3'
        with closing(sqlite3.connect(self.db)) as db, db:
            db.executescript('''
CREATE TABLE stops(stop_id TEXT,stop_name TEXT,stop_lat TEXT,stop_lon TEXT);
INSERT INTO stops VALUES ('a','A','19.4','-99.1'),('b','B','19.41','-99.1'),('c','C','19.42','-99.1');
CREATE TABLE routes(route_id TEXT,route_short_name TEXT,route_color TEXT);
INSERT INTO routes VALUES('r','1','ff0000');
CREATE TABLE calendar(service_id TEXT,monday TEXT,tuesday TEXT,wednesday TEXT,thursday TEXT,friday TEXT,saturday TEXT,sunday TEXT,start_date TEXT,end_date TEXT);
INSERT INTO calendar VALUES('daily','1','1','1','1','1','1','1','20260101','20261231');
CREATE TABLE calendar_dates(service_id TEXT,date TEXT,exception_type TEXT);
CREATE TABLE trips(trip_id TEXT,route_id TEXT,shape_id TEXT,service_id TEXT);
CREATE TABLE stop_times(trip_id TEXT,stop_id TEXT,arrival_time TEXT,departure_time TEXT,stop_sequence TEXT,pickup_type TEXT,drop_off_type TEXT);
CREATE TABLE shapes(shape_id TEXT,shape_pt_lat TEXT,shape_pt_lon TEXT,shape_pt_sequence TEXT);
INSERT INTO shapes VALUES('shape','19.4','-99.1','1'),('shape','19.41','-99.1','2'),('shape','19.42','-99.1','3');
''')
    def tearDown(self): self.temp.cleanup()
    def trip(self,id,rows):
        with closing(sqlite3.connect(self.db)) as db, db:
            db.execute('INSERT INTO trips VALUES(?,?,?,?)',(id,'r','shape','daily'))
            db.executemany('INSERT INTO stop_times VALUES(?,?,?,?,?,?,?)',[(id,stop,t,t,str(i),'0','0') for i,(stop,t) in enumerate(rows)])
    def run_plan(self,hour=8,minute=0):
        return planner.plan(self.db,'a','c',datetime(2026,9,23,hour,minute,tzinfo=planner.ZONE))
    def test_wait_and_travel_not_fixed_cost(self):
        self.trip('one',[('a','08:05:00'),('b','08:09:00'),('c','08:17:00')])
        result=self.run_plan()
        self.assertEqual(result['minutes'],17); self.assertEqual(result['transfers'],0)
        self.assertEqual(result['segments'][0]['stopIds'],['a','b','c'])
    def test_transfer_and_missed_connection(self):
        self.trip('one',[('a','08:05:00'),('b','08:10:00')])
        self.trip('missed',[('b','08:10:30'),('c','08:15:00')])
        self.trip('two',[('b','08:12:00'),('c','08:20:00')])
        result=self.run_plan(); self.assertEqual(result['minutes'],20); self.assertEqual(result['transfers'],1)
    def test_service_removed(self):
        self.trip('one',[('a','08:05:00'),('c','08:17:00')])
        with closing(sqlite3.connect(self.db)) as db, db: db.execute("INSERT INTO calendar_dates VALUES('daily','20260923','2')")
        self.assertFalse(self.run_plan()['found'])
    def test_previous_service_day_after_midnight(self):
        self.trip('night',[('a','24:10:00'),('c','24:25:00')])
        self.assertEqual(self.run_plan(0)['minutes'],25)
    def test_no_boarding(self):
        self.trip('one',[('a','08:05:00'),('c','08:17:00')])
        with closing(sqlite3.connect(self.db)) as db, db: db.execute("UPDATE stop_times SET pickup_type='1' WHERE stop_id='a'")
        self.assertFalse(self.run_plan()['found'])
    def test_invalid_station(self):
        with self.assertRaises(ValueError): planner.plan(self.db,'missing','c')

class LiveTests(unittest.TestCase):
    def test_decode_and_stale_snapshot(self):
        from google.transit import gtfs_realtime_pb2 as pb
        feed=pb.FeedMessage(); feed.header.gtfs_realtime_version='2.0'; feed.header.timestamp=100
        entity=feed.entity.add(); entity.id='v'; entity.vehicle.position.latitude=19.4; entity.vehicle.position.longitude=-99.1; entity.vehicle.trip.route_id='r'
        bad=feed.entity.add(); bad.id='invalid'; bad.vehicle.position.latitude=0; bad.vehicle.position.longitude=0
        stored={}
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(server,'DATA',pathlib.Path(directory)), \
                 patch.object(server.mysql_storage,'trip_shape_map',return_value={}), \
                 patch.object(server.mysql_storage,'store_live',side_effect=lambda config,result:stored.update(result)), \
                 patch.object(server.mysql_storage,'snapshot',side_effect=lambda config:dict(stored)):
                result=server.decode_realtime(feed.SerializeToString())
                self.assertEqual(result['vehicles'][0]['routeId'],'r')
                self.assertTrue(server.snapshot()['stale'])
                self.assertEqual(result['tripUpdates'],0)
                self.assertEqual(result['rejectedPositions'],1)
                self.assertEqual(len(result['vehicles']),1)

if __name__=='__main__': unittest.main()
