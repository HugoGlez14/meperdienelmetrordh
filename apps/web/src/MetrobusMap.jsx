import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Expand,X,Plus,Minus,Download} from 'lucide-react';
import {metrobusLines} from '@meperdienelmetro/core';
import {linePoints,segmentPoints,stationPoint} from './metrobusLayout';

const W=1368,H=1824;
const asPoints=points=>points.map(point=>point.join(',')).join(' ');
const routeViewBox=(points,boxes=[])=>{if(!points.length)return `0 0 ${W} ${H}`;const xs=[...points.map(point=>point[0]),...boxes.flatMap(box=>[box.left,box.right])],ys=[...points.map(point=>point[1]),...boxes.flatMap(box=>[box.top,box.bottom])],minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),pad=Math.max(105,Math.min(230,Math.max(maxX-minX,maxY-minY)*.22));return `${Math.max(0,minX-pad)} ${Math.max(0,minY-pad)} ${Math.min(W,maxX-minX+pad*2)} ${Math.min(H,maxY-minY+pad*2)}`};
const overlaps=(a,b)=>a.left<b.right+12&&a.right>b.left-12&&a.top<b.bottom+12&&a.bottom>b.top-12;
const networkSegments=metrobusLines.flatMap(line=>{const points=linePoints(line);return points.slice(1).map((point,index)=>[points[index],point])});
const pointInBox=([x,y],box)=>x>=box.left&&x<=box.right&&y>=box.top&&y<=box.bottom;
const crosses=(a,b,c,d)=>{const side=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);const ab1=side(a,b,c),ab2=side(a,b,d),cd1=side(c,d,a),cd2=side(c,d,b);return ((ab1>=0&&ab2<=0)||(ab1<=0&&ab2>=0))&&((cd1>=0&&cd2<=0)||(cd1<=0&&cd2>=0))};
const crossesLine=(box,[a,b])=>{const safe={left:box.left-15,right:box.right+15,top:box.top-15,bottom:box.bottom+15};if(pointInBox(a,safe)||pointInBox(b,safe))return true;const corners=[[safe.left,safe.top],[safe.right,safe.top],[safe.right,safe.bottom],[safe.left,safe.bottom]];return corners.some((corner,index)=>crosses(a,b,corner,corners[(index+1)%corners.length]))};
const labelPositions=labels=>{
 const occupied=[];
 return labels.map(label=>{
  if(!label.point)return label;
  const [px,py]=label.point,width=Math.max(72,label.name.length*10.5);
  const options=[
   {x:px+24,y:py-17,anchor:'start',box:{left:px+24,right:px+24+width,top:py-40,bottom:py-13}},
   {x:px+24,y:py+35,anchor:'start',box:{left:px+24,right:px+24+width,top:py+12,bottom:py+39}},
   {x:px-24,y:py-17,anchor:'end',box:{left:px-24-width,right:px-24,top:py-40,bottom:py-13}},
   {x:px-24,y:py+35,anchor:'end',box:{left:px-24-width,right:px-24,top:py+12,bottom:py+39}},
   {x:px,y:py-29,anchor:'middle',box:{left:px-width/2,right:px+width/2,top:py-52,bottom:py-25}},
   {x:px,y:py+47,anchor:'middle',box:{left:px-width/2,right:px+width/2,top:py+24,bottom:py+51}},
   {x:px+48,y:py-45,anchor:'start',box:{left:px+48,right:px+48+width,top:py-68,bottom:py-41}},
   {x:px+48,y:py+63,anchor:'start',box:{left:px+48,right:px+48+width,top:py+40,bottom:py+67}},
   {x:px-48,y:py-45,anchor:'end',box:{left:px-48-width,right:px-48,top:py-68,bottom:py-41}},
   {x:px-48,y:py+63,anchor:'end',box:{left:px-48-width,right:px-48,top:py+40,bottom:py+67}},
   {x:px,y:py-64,anchor:'middle',box:{left:px-width/2,right:px+width/2,top:py-87,bottom:py-60}},
   {x:px,y:py+82,anchor:'middle',box:{left:px-width/2,right:px+width/2,top:py+59,bottom:py+86}}
  ];
  const position=options.find(option=>option.box.left>=0&&option.box.right<=W&&option.box.top>=0&&option.box.bottom<=H&&!occupied.some(box=>overlaps(option.box,box))&&!networkSegments.some(segment=>crossesLine(option.box,segment)))||options[0];
  occupied.push(position.box);
  return {...label,...position};
 });
};

export default function MetrobusMap({route}){
 const [full,setFull]=useState(false),[zoom,setZoom]=useState(1),[network,setNetwork]=useState(!route);const svg=useRef(null);
 useEffect(()=>{setNetwork(!route);setZoom(1)},[route]);
 useEffect(()=>{if(!full)return;const old=document.body.style.overflow;document.body.style.overflow='hidden';const esc=e=>{if(e.key==='Escape')setFull(false)};window.addEventListener('keydown',esc);return()=>{document.body.style.overflow=old;window.removeEventListener('keydown',esc)}},[full]);
 const labels=route?.segments.length?[{name:route.segments[0].stations[0],point:stationPoint(route.segments[0].line,route.segments[0].stations[0]),kind:'Origen'},...route.segments.slice(1).map(segment=>({name:segment.stations[0],point:stationPoint(segment.line,segment.stations[0]),kind:'Transbordo'})),{name:route.segments.at(-1).stations.at(-1),point:stationPoint(route.segments.at(-1).line,route.segments.at(-1).stations.at(-1)),kind:'Destino'}]:[];
 const active=useMemo(()=>new Set(route?.path||[]),[route]),selectedPoints=route?.segments.flatMap(segmentPoints)||[],placedLabels=useMemo(()=>labelPositions(labels),[labels]),displayPoints=network?metrobusLines.flatMap(linePoints):[...selectedPoints,...placedLabels.flatMap(label=>label.box?[[label.box.left,label.box.top],[label.box.right,label.box.bottom]]:[])];
 function download(){if(!svg.current)return;const copy=svg.current.cloneNode(true);copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('width',String(W));copy.setAttribute('height',String(H));const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml'}));const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;canvas.getContext('2d').drawImage(image,0,0);URL.revokeObjectURL(url);canvas.toBlob(png=>{const link=document.createElement('a');link.href=URL.createObjectURL(png);link.download='mi-ruta-metrobus.png';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)},'image/png')};image.src=url}
 return <section className={'mb-map'+(full?' mb-map-full':'')} aria-label="Mapa de Metrobús"><div className="mb-map-tools"><div><button onClick={()=>{setNetwork(true);setZoom(1)}} aria-pressed={network}>Toda la red</button><button disabled={!route} onClick={()=>{setNetwork(false);setZoom(1)}} aria-pressed={!network}>Mi ruta</button></div><div><button title="Alejar" onClick={()=>setZoom(z=>Math.max(1,z-.5))}><Minus size={17}/></button><button title="Acercar" onClick={()=>setZoom(z=>Math.min(3,z+.5))}><Plus size={17}/></button><button title={full?'Cerrar mapa':'Expandir mapa'} onClick={()=>setFull(!full)}>{full?<X size={17}/>:<Expand size={17}/>}</button>{route&&<button title="Descargar ruta PNG" onClick={download}><Download size={17}/></button>}</div></div><div className="mb-map-viewport"><svg ref={svg} className="mb-route-map" xmlns="http://www.w3.org/2000/svg" viewBox={routeViewBox(displayPoints)} style={{width:zoom*100+'%'}} role="img" aria-label={route?'Ruta de Metrobús':'Red de Metrobús'}><rect width={W} height={H} fill="#fffafa"/>{metrobusLines.map(line=><polyline key={line.id} points={asPoints(linePoints(line))} fill="none" stroke={line.color} opacity=".23" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round"/>)}{route&&!network&&route.segments.map((segment,index)=><polyline key={index} points={asPoints(segmentPoints(segment))} fill="none" stroke={segment.line.color} strokeWidth="17" strokeLinecap="round" strokeLinejoin="round"/>)}{metrobusLines.flatMap(line=>line.stations.map(station=>({line,station,point:stationPoint(line,station)}))).map(({line,station,point},index)=>point&&<circle key={`${line.id}-${station}-${index}`} cx={point[0]} cy={point[1]} r={active.has(station)&&!network?6:3.5} fill="white" stroke={active.has(station)&&!network?'#452d36':'#b7aaa9'} strokeWidth={active.has(station)&&!network?3:1.25}/>)}{route&&!network&&placedLabels.map((label,index)=>label.point&&<g key={`${label.kind}-${label.name}-${index}`}><circle cx={label.point[0]} cy={label.point[1]} r="15" fill="#fffafa" stroke="#be1830" strokeWidth="6"/><text x={label.x} y={label.y} textAnchor={label.anchor} fontFamily="Georgia, serif" fontWeight="700" fontSize="18" fill="#3e3034" paintOrder="stroke" stroke="#fffafa" strokeWidth="5">{label.name}</text></g>)}</svg></div><p className="mb-map-note">{network?'Red completa de Metrobús · Amplía o mueve el mapa para leerlo.':'Se muestran la ruta, los transbordos y la llegada · amplía para revisarla.'}</p></section>
}
