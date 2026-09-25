import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';

const routeA={route_id:'a',route_short_name:'1',route_long_name:'Línea 1',route_color:'BE1830',shapeIds:['shape-a']};
const routeB={route_id:'b',route_short_name:'2',route_long_name:'Línea 2',route_color:'7848A5',shapeIds:['shape-b']};
const network={routes:[routeA,routeB],stops:[],shapes:{'shape-a':[[19.4,-99.16],[19.41,-99.15]],'shape-b':[[19.42,-99.14],[19.43,-99.13]]}};
const timestamp=Math.floor(Date.now()/1000);
const live={vehicles:[
  {id:'unit-a',label:'A',routeId:'a',lat:19.405,lng:-99.155,timestamp},
  {id:'unit-b',label:'B',routeId:'b',lat:19.425,lng:-99.135,timestamp},
  {id:'unit-unknown',label:'?',routeId:'',lat:19.41,lng:-99.15,timestamp},
]};

function ride(route){return {kind:'ride',routeId:route.route_id,route,points:network.shapes[route.shapeIds[0]],stopIds:[]}}

test('a planned journey shows only vehicles and traces for its route IDs',async()=>{
  const vite=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true}});
  try{
    const {GeographicMap,buildLiveJourney,routeTerminals}=await vite.ssrLoadModule('/src/MetrobusLive.jsx');
    const render=journey=>renderToStaticMarkup(React.createElement(GeographicMap,{network,live,line:'',variant:'',journey}));
    const browsing=render(null);
    assert.match(browsing,/data-vehicle-ids="unit-a,unit-b,unit-unknown"/,'general network can show unidentified vehicles');
    const a=render({found:true,segments:[ride(routeA)]});
    assert.match(a,/data-vehicle-ids="unit-a"/);
    assert.match(a,/data-path-lines="1"/,'only the selected route trace remains');
    const both=render({found:true,segments:[ride(routeA),ride(routeB)]});
    assert.match(both,/data-vehicle-ids="unit-a,unit-b"/,'transfers include vehicles from both route IDs');
    assert.match(both,/data-path-lines="1,2"/);
    const byLine=render({found:true,segments:[{...ride(routeA),routeId:'line-not-a-route-id',lineId:'1'}]});
    assert.match(byLine,/data-vehicle-ids="unit-a"/,'a local plan is linked to every GTFS variant of its line');
    assert.deepEqual(routeTerminals({route_long_name:'L01a07-1 indios verdes - el caminero'}),{origin:'indios verdes',destination:'el caminero'});

    const journeyNetwork={
      ...network,
      stops:[
        {stop_id:'from-l1',stop_name:'Indios Verdes L1',stop_lat:'19.4',stop_lon:'-99.16'},
        {stop_id:'to',stop_name:'El Caminero',stop_lat:'19.41',stop_lon:'-99.15'},
      ],
    };
    const routePlan={minutes:2,transfers:0,segments:[{line:{id:'1',color:'#BE1830'},stations:['Indios Verdes','El Caminero'],direction:'El Caminero'}]};
    const linked=buildLiveJourney(routePlan,journeyNetwork,1_700_000_000);
    assert.equal(linked.found,true);
    assert.equal(linked.segments[0].lineId,'1');
    assert.equal(linked.segments[0].routeId,'a');
    assert.deepEqual(linked.segments[0].stopIds,['from-l1','to']);
    assert.equal(linked.segments[0].points.length,2,'the selected GTFS shape is clipped to the requested section');
  }finally{await vite.close()}
});
