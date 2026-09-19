import type { RouteMode, TransitLine, TransitRoute } from './types.ts';

const definitions: [string,string,string][] = [
['1','#e65c9c','Observatorio|Tacubaya|Juanacatlán|Chapultepec|Sevilla|Insurgentes|Cuauhtémoc|Balderas|Salto del Agua|Isabel la Católica|Pino Suárez|Merced|Candelaria|San Lázaro|Moctezuma|Balbuena|Boulevard Puerto Aéreo|Gómez Farías|Zaragoza|Pantitlán'],
['2','#1765b0','Cuatro Caminos|Panteones|Tacuba|Cuitláhuac|Popotla|Colegio Militar|Normal|San Cosme|Revolución|Hidalgo|Bellas Artes|Allende|Zócalo/Tenochtitlan|Pino Suárez|San Antonio Abad|Chabacano|Viaducto|Xola|Villa de Cortés|Nativitas|Portales|Ermita|General Anaya|Tasqueña'],
['3','#9b9b26','Indios Verdes|Deportivo 18 de Marzo|Potrero|La Raza|Tlatelolco|Guerrero|Hidalgo|Juárez|Balderas|Niños Héroes/Poder Judicial CDMX|Hospital General|Centro Médico|Etiopía/Plaza de la Transparencia|Eugenia|División del Norte|Zapata|Coyoacán|Viveros/Derechos Humanos|Miguel Ángel de Quevedo|Copilco|Universidad'],
['4','#6cb7ae','Martín Carrera|Talismán|Bondojito|Consulado|Canal del Norte|Morelos|Candelaria|Fray Servando|Jamaica|Santa Anita'],
['5','#e8bc20','Politécnico|Instituto del Petróleo|Autobuses del Norte|La Raza|Misterios|Valle Gómez|Consulado|Eduardo Molina|Aragón|Oceanía|Terminal Aérea|Hangares|Pantitlán'],
['6','#cc353a','El Rosario|Tezozómoc|UAM-Azcapotzalco|Ferrería/Arena Ciudad de México|Norte 45|Vallejo|Instituto del Petróleo|Lindavista|Deportivo 18 de Marzo|La Villa-Basílica|Martín Carrera'],
['7','#e87b26','El Rosario|Aquiles Serdán|Camarones|Refinería|Tacuba|San Joaquín|Polanco|Auditorio|Constituyentes|Tacubaya|San Pedro de los Pinos|San Antonio|Mixcoac|Barranca del Muerto'],
['8','#168a66','Garibaldi/Lagunilla|Bellas Artes|San Juan de Letrán|Salto del Agua|Doctores|Obrera|Chabacano|La Viga|Santa Anita|Coyuya|Iztacalco|Apatlaco|Aculco|Escuadrón 201|Atlalilco|Iztapalapa|Cerro de la Estrella|UAM-I|Constitución de 1917'],
['9','#79513c','Tacubaya|Patriotismo|Chilpancingo|Centro Médico|Lázaro Cárdenas|Chabacano|Jamaica|Mixiuhca|Velódromo|Ciudad Deportiva|Puebla|Pantitlán'],
['A','#8b4b9f','Pantitlán|Agrícola Oriental|Canal de San Juan|Tepalcates|Guelatao|Peñón Viejo|Acatitla|Santa Marta|Los Reyes|La Paz'],
['B','#759487','Buenavista|Guerrero|Garibaldi/Lagunilla|Lagunilla|Tepito|Morelos|San Lázaro|Ricardo Flores Magón|Romero Rubio|Oceanía|Deportivo Oceanía|Bosque de Aragón|Villa de Aragón|Nezahualcóyotl|Impulsora|Río de los Remedios|Múzquiz|Ecatepec|Olímpica|Plaza Aragón|Ciudad Azteca'],
['12','#b69a39','Mixcoac|Insurgentes Sur|Hospital 20 de Noviembre|Zapata|Parque de los Venados|Eje Central|Ermita|Mexicaltzingo|Atlalilco|Culhuacán|San Andrés Tomatlán|Lomas Estrella|Calle 11|Periférico Oriente|Tezonco|Olivos|Nopalera|Zapotitlán|Tlaltenco|Tláhuac']
];

export const metroLines: TransitLine[] = definitions.map(([id,color,stations])=>({id,color,stations:stations.split('|')}));
export const metroStations = [...new Set(metroLines.flatMap(line=>line.stations))].sort((a,b)=>a.localeCompare(b,'es'));
export const metroStationLines = (name:string) => metroLines.filter(line=>line.stations.includes(name));
export const normalizeStation = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

const nodeKey=(station:string,lineId:string)=>JSON.stringify([station,lineId]);

export function findMetroRoute(from:string,to:string,mode:RouteMode='fast',blocked=new Set<string>()): TransitRoute | null {
  if(!metroStations.includes(from)||!metroStations.includes(to)) return null;
  if(from===to) return {segments:[],stops:0,transfers:0,minutes:0,path:[from]};

  const distances=new Map<string,number>();
  const previous=new Map<string,string>();
  const queue:[number,string][]=[];
  for(const line of metroStationLines(from)){
    const key=nodeKey(from,line.id);
    distances.set(key,0);
    queue.push([0,key]);
  }

  let end:string|undefined;
  while(queue.length){
    queue.sort((a,b)=>a[0]-b[0]);
    const [cost,key]=queue.shift()!;
    if(cost!==distances.get(key)) continue;
    const [station,lineId]=JSON.parse(key) as [string,string];
    if(station===to){end=key;break;}

    const line=metroLines.find(item=>item.id===lineId)!;
    const index=line.stations.indexOf(station);
    const neighbors:[string,number][]=[
      line.stations[index-1],
      line.stations[index+1]
    ].filter((next): next is string=>Boolean(next)).map(next=>[nodeKey(next,lineId),2]);

    for(const other of metroStationLines(station)){
      if(other.id!==lineId) neighbors.push([nodeKey(station,other.id),mode==='transfers'?1000:5]);
    }

    for(const [next,weight] of neighbors){
      if(blocked.has([key,next].sort().join('::'))) continue;
      const distance=cost+weight;
      if(distance<(distances.get(next)??Infinity)){
        distances.set(next,distance);
        previous.set(next,key);
        queue.push([distance,next]);
      }
    }
  }

  if(!end) return null;
  const nodes:[string,string][]=[];
  for(let key:string|undefined=end;key;key=previous.get(key)) nodes.unshift(JSON.parse(key) as [string,string]);

  const segments: TransitRoute['segments']=[];
  for(let i=1;i<nodes.length;i++){
    const [a,lineId]=nodes[i-1];
    const [b,nextLineId]=nodes[i];
    if(lineId!==nextLineId) continue;
    let segment=segments.at(-1);
    if(!segment||segment.line.id!==lineId){
      segment={line:metroLines.find(line=>line.id===lineId)!,stations:[a],direction:''};
      segments.push(segment);
    }
    segment.stations.push(b);
  }

  for(const segment of segments){
    const list=segment.line.stations;
    segment.direction=list.indexOf(segment.stations[0])<list.indexOf(segment.stations.at(-1)!)?list.at(-1)!:list[0];
  }

  const stops=segments.reduce((total,segment)=>total+segment.stations.length-1,0);
  const transfers=Math.max(0,segments.length-1);
  return {
    segments,
    stops,
    transfers,
    minutes:stops*2+transfers*5,
    path:nodes.map(node=>node[0]).filter((station,index,array)=>index===0||station!==array[index-1])
  };
}

export function findMetroRoutes(from:string,to:string,mode:RouteMode='fast'): TransitRoute[] {
  const first=findMetroRoute(from,to,mode);
  if(!first) return [];
  if(!first.stops) return [first];

  const candidates:(TransitRoute|null)[]=[first,findMetroRoute(from,to,mode==='fast'?'transfers':'fast')];
  for(let i=0;i<first.segments.length;i++){
    const segment=first.segments[i];
    for(let j=1;j<segment.stations.length;j++){
      const edge=[nodeKey(segment.stations[j-1],segment.line.id),nodeKey(segment.stations[j],segment.line.id)].sort().join('::');
      candidates.push(findMetroRoute(from,to,mode,new Set([edge])));
    }
    if(i){
      const previousSegment=first.segments[i-1];
      const station=segment.stations[0];
      const edge=[nodeKey(station,previousSegment.line.id),nodeKey(station,segment.line.id)].sort().join('::');
      candidates.push(findMetroRoute(from,to,mode,new Set([edge])));
    }
  }

  const seen=new Set<string>();
  const valid=candidates.filter((route):route is TransitRoute=>{
    if(!route||new Set(route.path).size!==route.path.length||route.minutes>first.minutes+30) return false;
    const id=JSON.stringify(route.segments.map(segment=>[segment.line.id,segment.stations]));
    if(seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  valid.sort((a,b)=>mode==='transfers'
    ? a.transfers-b.transfers || a.minutes-b.minutes
    : a.minutes-b.minutes || a.transfers-b.transfers
  );
  return valid.slice(0,3);
}
