import type { TransitLine, TransitRoute } from './types.ts';

const definitions:[string,string,string][]=[
['1','#c9212c','Indios Verdes|Deportivo 18 de Marzo|Euzkaro|Potrero|La Raza|Circuito|San Simón|Manuel González|Buenavista|El Chopo|Revolución|Plaza de la República|Reforma|Hamburgo|Insurgentes|Durango|Álvaro Obregón|Sonora|Campeche|Chilpancingo|Nuevo León|Río Piedad|Polifórum|Nápoles|Col. del Valle|Ciudad de los Deportes|Parque Hundido|Félix Cuevas|Río Churubusco|Teatro Insurgentes|José María Velasco|Francia|Olivo|Altavista|La Bombilla|Doctor Gálvez|Ciudad Universitaria|Centro Cultural Universitario|Perisur|Villa Olímpica|Corregidora|Ayuntamiento|Fuentes Brotantes|Santa Úrsula|La Joya|El Caminero'],
['2','#8a2be2','Tepalcates|General Antonio de León|Nicolás Bravo|Canal de San Juan|Constitución de Apatzingán|CCH Oriente|Leyes de Reforma|Del Moral|Río Frío|Rojo Gómez|Río Mayo|Río Tecolutla|El Rodeo|UPIICSA|Iztacalco|Goma|Tlacotal|Canela|Metro Coyuya|Coyuya|La Viga|Andrés Molina Enríquez|Las Américas|Xola|Álamos|Centro SCOP|Doctor Vértiz|Etiopía|Amores|Viaducto|Nuevo León|Escandón|Patriotismo|Parque Lira|De la Salle|Antonio Maceo|Tacubaya'],
['3','#4f9c46','Tenayuca|San José de la Escalera|Progreso Nacional|Tres Anegas|Júpiter|La Patera|Poniente 146|Montevideo|Poniente 134|Poniente 128|Magdalena de las Salinas|Coltongo|Cuitláhuac|Héroe de Nacozari|Hospital La Raza|Circuito|Tolnahuac|Tlatelolco|Ricardo Flores Magón|Guerrero|Mina|Hidalgo|Juárez|Balderas|Cuauhtémoc|Jardín Pushkin|Hospital General|Doctor Márquez|Centro Médico|Obrero Mundial|Luz Saviñón|Eugenia|División del Norte|Miguel Laurent|Pueblo Santa Cruz Atoyac'],
['4','#f18b2b','Hidalgo|Bellas Artes|Teatro Blanquita|República de Chile|República de Argentina|Teatro del Pueblo|Mixcalco|Ferrocarril de Cintura|Morelos|Archivo General de la Nación|Pantitlán|Calle 6|Alameda Oriente'],
['5','#2a6ecb','Río de los Remedios|314 Memorial New’s Divine|5 de Mayo|Vasco de Quiroga|El Coyol|Preparatoria 3|San Juan de Aragón|Río de Guadalupe|Talismán|Victoria|Oriente 101|Río Santa Coleta|Río Consulado|Canal del Norte|Deportivo Eduardo Molina|Mercado Morelos|Archivo General de la Nación|Moctezuma|Venustiano Carranza|Avenida del Taller|Mixiuhca|Hospital General Troncoso|Metro Coyuya|Recreo|Oriente 116|Colegio de Bachilleres 3|Canal de Apatlaco|Apatlaco|Aculco|Churubusco Oriente|Escuadrón 201|Atanasio G. Sarabia|Ermita Iztapalapa|Ganaderos|Pueblo Los Reyes|Barrio San Antonio|Calzada Taxqueña|Cafetales|ESIME Culhuacán|Manuela Sáenz|La Virgen|Tepetlapa|Las Bombas|Vista Hermosa|Calzada del Hueso|Cañaverales|Muyuguarda|Circuito Cuemanco|DIF Xochimilco|Preparatoria 1'],
['6','#e85a9b','El Rosario|Colegio de Bachilleres 1|De las Culturas|Ferrocarriles Nacionales|UAM Azcapotzalco|Tecnoparque|Norte 59|Norte 45|Montevideo|Lindavista-Vallejo|Instituto del Petróleo|San Bartolo|Instituto Politécnico Nacional|Riobamba|Deportivo 18 de Marzo|La Villa|De los Misterios|Hospital Infantil La Villa|Delegación Gustavo A. Madero|Martín Carrera|Hospital General La Villa|San Juan de Aragón|Gran Canal|Casas Alemán|Pueblo San Juan de Aragón|Loreto Fabela|482|414|416 Oriente|416 Poniente|Deportivo Los Galeana|Ampliación Providencia|Volcán de Fuego|La Pradera|Colegio de Bachilleres 9|Francisco Morazán|Villa de Aragón'],
['7','#1f6d54','Indios Verdes|De los Misterios|Hospital Infantil La Villa|Delegación Gustavo A. Madero|Garrido|Avenida Talismán|Necaxa|Excélsior|Robles Domínguez|Clave|Misterios|Mercado Beethoven|Peralvillo|Tres Culturas|Glorieta Cuitláhuac|Garibaldi|Glorieta Violeta|Hidalgo|El Caballito|Glorieta de Colón|París|Reforma|Hamburgo|La Palma|El Ángel|La Diana|Chapultepec|Gandhi|Antropología|Auditorio|Campo Marte']
];

export const metrobusLines: TransitLine[]=definitions.map(([id,color,stations])=>({id,color,stations:stations.split('|')}));
export const metrobusStations=[...new Set(metrobusLines.flatMap(line=>line.stations))].sort((a,b)=>a.localeCompare(b,'es'));
export const metrobusStationLines=(name:string)=>metrobusLines.filter(line=>line.stations.includes(name));

const key=(station:string,lineId:string)=>JSON.stringify([station,lineId]);

export function findMetrobusRoute(from:string,to:string):TransitRoute|null{
  if(!metrobusStations.includes(from)||!metrobusStations.includes(to)) return null;
  if(from===to) return {segments:[],stops:0,transfers:0,minutes:0,path:[from]};

  const distances=new Map<string,number>();
  const previous=new Map<string,string>();
  const queue:[number,string][]=[];
  for(const line of metrobusStationLines(from)){
    const start=key(from,line.id);
    distances.set(start,0);
    queue.push([0,start]);
  }

  let end:string|undefined;
  while(queue.length){
    queue.sort((a,b)=>a[0]-b[0]);
    const [cost,current]=queue.shift()!;
    if(cost!==distances.get(current)) continue;
    const [station,lineId]=JSON.parse(current) as [string,string];
    if(station===to){end=current;break;}

    const line=metrobusLines.find(item=>item.id===lineId)!;
    const index=line.stations.indexOf(station);
    const neighbors:[string,number][]=[
      line.stations[index-1],
      line.stations[index+1]
    ].filter((next): next is string=>Boolean(next)).map(next=>[key(next,lineId),2]);

    for(const other of metrobusStationLines(station)){
      if(other.id!==lineId) neighbors.push([key(station,other.id),4]);
    }

    for(const [next,weight] of neighbors){
      const distance=cost+weight;
      if(distance<(distances.get(next)??Infinity)){
        distances.set(next,distance);
        previous.set(next,current);
        queue.push([distance,next]);
      }
    }
  }

  if(!end) return null;
  const nodes:[string,string][]=[];
  for(let current:string|undefined=end;current;current=previous.get(current)) nodes.unshift(JSON.parse(current) as [string,string]);

  const segments:TransitRoute['segments']=[];
  for(let i=1;i<nodes.length;i++){
    const [a,lineId]=nodes[i-1];
    const [b,nextLineId]=nodes[i];
    if(lineId!==nextLineId) continue;
    let segment=segments.at(-1);
    if(!segment||segment.line.id!==lineId){
      segment={line:metrobusLines.find(line=>line.id===lineId)!,stations:[a],direction:''};
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
    minutes:stops*2+transfers*4,
    path:nodes.map(node=>node[0]).filter((station,index,array)=>index===0||station!==array[index-1])
  };
}
