// Run while apps/api/server.py is active: node scripts/verify-metrobus.mjs
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const vite=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true}});
try {
  const {GeographicMap}=await vite.ssrLoadModule('/src/MetrobusLive.jsx');
  const request=async path=>{const r=await fetch('http://127.0.0.1:8787/api/metrobus/'+path);assert.equal(r.status,200);return r.json()};
  const network=await request('network'),live=await request('live');
  for(const line of ['', '1','7']) {
    const html=renderToStaticMarkup(React.createElement(GeographicMap,{network,live,line,variant:'',journey:null}));
    assert.ok(html.includes('<polyline'));assert.ok(!/NaN|Infinity/.test(html));
    console.log('Map render:',line||'all','paths:',(html.match(/<polyline/g)||[]).length,'vehicles:',(html.match(/role="button"/g)||[]).length);
  }
  const old={...live,vehicles:live.vehicles.map(v=>({...v,timestamp:1}))};
  const html=renderToStaticMarkup(React.createElement(GeographicMap,{network,live:old,line:'',variant:'',journey:null}));
  assert.ok(!html.includes('role="button"'));
  console.log('Stale vehicles hidden; live feed timestamp:',live.timestamp,'rejected positions:',live.rejectedPositions);
} finally {await vite.close();}
