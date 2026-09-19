import React,{useEffect,useRef,useState} from 'react';
import {Download,Expand,Minus,Plus,X} from 'lucide-react';
import {mapLines,stationPositions} from './map-layout';
import {metroStationLines as stationLines} from '@meperdienelmetro/core';
const mapViewBox=path=>{const points=path.map(name=>stationPositions[name]).filter(Boolean);if(!points.length)return '0 0 1436 1780';const xs=points.map(point=>point[0]),ys=points.map(point=>point[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),pad=Math.max(120,Math.min(260,Math.max(maxX-minX,maxY-minY)*.22));return `${Math.max(0,minX-pad)} ${Math.max(0,minY-pad)} ${Math.min(1436,maxX-minX+pad*2)} ${Math.min(1780,maxY-minY+pad*2)}`};

export default function RouteMap({route,from,to,language='es'}){
  const [zoom,setZoom]=useState(1),[fullscreen,setFullscreen]=useState(false);
  const viewport=useRef(null),svg=useRef(null),drag=useRef(null),active=new Set(route.path);
  const labels=new Set([from,to,...route.segments.flatMap(segment=>[segment.stations[0],segment.stations.at(-1)])]);
  useEffect(()=>{const el=viewport.current;if(!el)return;const points=route.path.map(s=>stationPositions[s]);const x=points.reduce((n,a)=>n+a[0],0)/points.length*zoom,y=points.reduce((n,a)=>n+a[1],0)/points.length*zoom;el.scrollTo({left:Math.max(0,x-el.clientWidth/2),top:Math.max(0,y-el.clientHeight/2),behavior:'smooth'});},[route,zoom]);
  useEffect(()=>{if(!fullscreen)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous}},[fullscreen]);
  function download(){const copy=svg.current.cloneNode(true);copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('width','1436');copy.setAttribute('height','1780');const svgUrl=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml;charset=utf-8'})),image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=1436;canvas.height=1780;canvas.getContext('2d').drawImage(image,0,0);URL.revokeObjectURL(svgUrl);canvas.toBlob(blob=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='mi-ruta-metro-cdmx.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),0)},'image/png')};image.src=svgUrl}
  // On touch screens the map must not capture the gesture: vertical swipes are
  // reserved for scrolling the page. Mouse/trackpad dragging still pans it.
  function down(e){if(e.pointerType==='touch')return;const el=viewport.current;drag.current={x:e.clientX,y:e.clientY,left:el.scrollLeft,top:el.scrollTop};el.setPointerCapture(e.pointerId)}
  function move(e){if(!drag.current)return;const el=viewport.current;el.scrollLeft=drag.current.left-(e.clientX-drag.current.x);el.scrollTop=drag.current.top-(e.clientY-drag.current.y)}
  function up(){drag.current=null}
  return <div className={'network-map'+(fullscreen?' map-fullscreen':'')}>
    <div className="map-toolbar"><span>{language==='en'?'METRO NETWORK MAP · CDMX':'MAPA DE LA RED · CDMX'}</span><div>
      <button className="map-download" type="button" onClick={download} title={language==='en'?'Download route as PNG':'Descargar ruta como PNG'}><Download size={17}/></button>
      <button type="button" disabled={zoom<=1} onClick={()=>setZoom(z=>Math.max(1,z-.5))} title={language==='en'?'Zoom out':'Alejar'}><Minus size={17}/></button>
      <button type="button" disabled={zoom>=4} onClick={()=>setZoom(z=>Math.min(4,z+.5))} title={language==='en'?'Zoom in':'Acercar'}><Plus size={17}/></button>
      <button type="button" onClick={()=>setFullscreen(value=>!value)} title={fullscreen?(language==='en'?'Close full screen':'Cerrar pantalla completa'):(language==='en'?'Expand map':'Expandir mapa')}>{fullscreen?<X size={18}/>:<Expand size={18}/>}</button>
    </div></div>
    <div className="map-viewport" ref={viewport} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <svg ref={svg} style={{width:zoom*100+'%'}} viewBox={mapViewBox(route.path)} role="img" aria-label={'Ruta de '+from+' a '+to}>
        <rect width="1436" height="1780" fill="#f8faf5"/>
        {mapLines.map(l=><polyline key={l.id} points={l.points.map(p=>p.join(',')).join(' ')} fill="none" stroke={l.color} opacity=".22" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round"/>)}
        {route.segments.map((s,i)=><polyline key={i} points={s.stations.map(n=>stationPositions[n].join(',')).join(' ')} fill="none" stroke={s.line.color} strokeWidth="13" strokeLinejoin="round" strokeLinecap="round"/>)}
        {Object.entries(stationPositions).map(([name,[x,y]])=>{const selected=active.has(name),end=name===from||name===to,transfer=stationLines(name).length>1,showLabel=labels.has(name),offsetY=end?-12:(y%2?18:-12);return <g key={name}><title>{name+' · Línea '+stationLines(name).map(l=>l.id).join(', ')}</title>{end&&<circle cx={x} cy={y} r="18" fill="#ef5b24" opacity=".2"/>}<circle cx={x} cy={y} r={end?8:transfer?6:3.5} fill="white" stroke={selected?'#233d34':'#a5b2a1'} strokeWidth={selected?3:1}/>{selected&&showLabel&&<text x={x+13} y={y+offsetY} fontSize={end?20:15} fill="#1d3429" fontWeight="700" paintOrder="stroke" stroke="#f8faf5" strokeWidth="5">{name}</text>}</g>})}
      </svg>
    </div>
    <div className="map-caption"><span>{language==='en'?'Only boarding, transfer and arrival stations are labelled · drag to move':'Se muestran subida, transbordos y llegada · arrastra para mover'}</span><button type="button" onClick={download}>{language==='en'?'Download route PNG':'Descargar ruta PNG'}</button></div>
  </div>
}
