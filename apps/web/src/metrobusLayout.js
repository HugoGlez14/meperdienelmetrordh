// Coordenadas aproximadas sobre el plano oficial de Metrobús, escaladas al viewBox.
import {metrobusLines} from '@meperdienelmetro/core';

const traces={
  1:[[558,455],[520,528],[464,565],[434,626],[434,730],[390,750],[390,875],[365,903],[326,934],[326,1239],[326,1380],[410,1467]],
  2:[[1060,835],[1060,915],[727,919],[683,961],[560,961],[535,935],[400,935],[365,903],[222,877]],
  3:[[441,288],[441,520],[464,545],[474,631],[474,813],[474,1075],[452,1120]],
  4:[[434,626],[444,700],[520,740],[610,750],[690,780],[740,820]],
  5:[[726,326],[726,750],[768,780],[768,850],[726,917],[768,960],[768,1090],[726,1130],[726,1280],[798,1368],[798,1432]],
  6:[[222,454],[240,414],[430,414],[473,455],[494,437],[539,437],[558,455],[605,455],[627,437],[663,437],[685,455],[866,455],[887,414],[900,430],[978,496]],
  7:[[558,414],[620,414],[620,514],[515,627],[413,728],[351,728],[307,771],[277,792],[244,792],[179,758]]
};
const length=points=>points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);
function positionAt(points,ratio){
  const total=length(points);let passed=0;const target=total*ratio;
  for(let i=1;i<points.length;i++){
    const part=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
    if(passed+part>=target){const t=(target-passed)/part;return [points[i-1][0]+(points[i][0]-points[i-1][0])*t,points[i-1][1]+(points[i][1]-points[i-1][1])*t]}
    passed+=part;
  }
  return points.at(-1);
}
const rawStationPoint=(line,station)=>{
  const item=metrobusLines.find(entry=>entry.id===line.id||entry.id===line);
  const index=item?.stations.indexOf(station)??-1;
  return index<0?null:positionAt(traces[item.id],index/Math.max(1,item.stations.length-1));
};
// A transfer has one physical point on the diagram, even when two lines reach it
// from different traces. Sharing that coordinate keeps the network connected.
const stationPoints=new Map();
for(const line of metrobusLines)for(const station of line.stations){
  if(!stationPoints.has(station))stationPoints.set(station,rawStationPoint(line,station));
}
export const stationPoint=(line,station)=>stationPoints.get(station)??rawStationPoint(line,station);
export const segmentPoints=segment=>segment.stations.map(station=>stationPoint(segment.line,station)).filter(Boolean);
export const linePoints=line=>{
  const item=metrobusLines.find(entry=>entry.id===line.id||entry.id===line);
  return item?item.stations.map(station=>stationPoint(item,station)).filter(Boolean):[];
};
