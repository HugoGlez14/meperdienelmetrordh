import { metroLines } from './metro.ts';
import { metrobusLines } from './metrobus.ts';
import type { TransitLine, TransitRoute } from './types.ts';

export type MapPoint = readonly [number, number];

const metroTraces: Record<string, MapPoint[]> = {
  '1': [[162,1016],[246,995],[275,922],[315,868],[349,857],[411,842],[476,825],[508,817],[555,821],[584,824],[612,827],[663,821],[705,815],[739,798],[779,822],[825,849],[864,872],[909,899],[963,930],[1023,906]],
  '2': [[64,575],[135,578],[227,580],[297,601],[333,632],[363,662],[392,698],[438,715],[481,731],[521,742],[565,751],[598,757],[619,779],[612,827],[602,896],[595,951],[586,1008],[580,1053],[573,1102],[565,1156],[554,1235],[545,1292],[528,1351],[552,1414]],
  '3': [[708,327],[661,406],[626,451],[589,498],[540,616],[532,687],[521,742],[515,778],[508,817],[496,876],[470,922],[465,965],[458,1045],[446,1120],[434,1162],[395,1228],[355,1296],[320,1348],[290,1395],[307,1479],[333,1553]],
  '4': [[806,405],[784,480],[757,549],[745,615],[735,655],[716,727],[705,815],[700,855],[693,948],[694,977]],
  '5': [[509,287],[534,358],[566,443],[589,498],[653,563],[710,591],[745,615],[810,647],[881,641],[927,688],[918,771],[932,846],[1023,906]],
  '6': [[172,273],[213,328],[257,362],[341,356],[427,373],[465,359],[534,358],[611,376],[661,406],[714,425],[806,405]],
  '7': [[172,273],[198,358],[238,438],[233,502],[227,580],[216,685],[222,769],[213,824],[219,930],[246,995],[254,1072],[249,1123],[241,1186],[230,1278]],
  '8': [[573,694],[565,751],[562,792],[555,821],[544,862],[539,918],[595,951],[659,967],[694,977],[746,1032],[754,1101],[770,1160],[782,1209],[773,1260],[809,1336],[902,1317],[953,1344],[1015,1375],[1091,1412]],
  '9': [[246,995],[305,969],[374,967],[465,965],[536,958],[595,951],[693,948],[749,950],[817,957],[917,957],[974,965],[1023,906]],
  'A': [[1023,906],[1038,978],[1122,1031],[1205,1081],[1223,1147],[1247,1234],[1264,1297],[1283,1369],[1305,1416],[1345,1429]],
  'B': [[488,679],[532,687],[573,694],[627,702],[672,703],[716,727],[739,798],[829,742],[873,718],[927,688],[965,658],[1043,598],[1106,571],[1145,493],[1172,424],[1202,353],[1229,287],[1268,194],[1286,149],[1310,93],[1329,44]],
  '12': [[241,1186],[297,1203],[346,1216],[395,1228],[455,1257],[492,1289],[545,1292],[690,1319],[809,1336],[787,1434],[783,1500],[828,1548],[890,1553],[949,1564],[997,1602],[1065,1612],[1125,1625],[1184,1639],[1239,1650],[1270,1718]],
};

export const metroStationPositions: Record<string, MapPoint> = {};
for (const line of metroLines) {
  const points = metroTraces[line.id];
  if (!points || points.length !== line.stations.length) throw new Error(`Incomplete Metro map ${line.id}`);
  line.stations.forEach((station, index) => { metroStationPositions[station] = points[index]; });
}
export const metroMapLines = metroLines.map((line) => ({ ...line, points: line.stations.map((station) => metroStationPositions[station]) }));

const metrobusTraces: Record<string, MapPoint[]> = {
  '1': [[558,455],[520,528],[464,565],[434,626],[434,730],[390,750],[390,875],[365,903],[326,934],[326,1239],[326,1380],[410,1467]],
  '2': [[1060,835],[1060,915],[727,919],[683,961],[560,961],[535,935],[400,935],[365,903],[222,877]],
  '3': [[441,288],[441,520],[464,545],[474,631],[474,813],[474,1075],[452,1120]],
  '4': [[434,626],[444,700],[520,740],[610,750],[690,780],[740,820]],
  '5': [[726,326],[726,750],[768,780],[768,850],[726,917],[768,960],[768,1090],[726,1130],[726,1280],[798,1368],[798,1432]],
  '6': [[222,454],[240,414],[430,414],[473,455],[494,437],[539,437],[558,455],[605,455],[627,437],[663,437],[685,455],[866,455],[887,414],[900,430],[978,496]],
  '7': [[558,414],[620,414],[620,514],[515,627],[413,728],[351,728],[307,771],[277,792],[244,792],[179,758]],
};
const distance = (a: MapPoint, b: MapPoint) => Math.hypot(b[0] - a[0], b[1] - a[1]);
function pointAt(points: MapPoint[], ratio: number): MapPoint {
  const total = points.slice(1).reduce((sum, point, index) => sum + distance(points[index], point), 0);
  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const segment = distance(points[index - 1], points[index]);
    if (travelled + segment >= total * ratio) {
      const progress = (total * ratio - travelled) / segment;
      return [points[index - 1][0] + (points[index][0] - points[index - 1][0]) * progress, points[index - 1][1] + (points[index][1] - points[index - 1][1]) * progress];
    }
    travelled += segment;
  }
  return points.at(-1)!;
}
function metrobusStationPointForLine(line: TransitLine | string, station: string): MapPoint | null {
  const current = metrobusLines.find((item) => item.id === (typeof line === 'string' ? line : line.id));
  const stationIndex = current?.stations.indexOf(station) ?? -1;
  return !current || stationIndex < 0 ? null : pointAt(metrobusTraces[current.id], stationIndex / Math.max(1, current.stations.length - 1));
}
const sharedMetrobusStations = new Map<string, MapPoint | null>();
for (const line of metrobusLines) for (const station of line.stations) if (!sharedMetrobusStations.has(station)) sharedMetrobusStations.set(station, metrobusStationPointForLine(line, station));
export const metrobusStationPoint = (line: TransitLine | string, station: string) => sharedMetrobusStations.get(station) ?? metrobusStationPointForLine(line, station);
export const metrobusLinePoints = (line: TransitLine | string) => {
  const current = metrobusLines.find((item) => item.id === (typeof line === 'string' ? line : line.id));
  return current ? current.stations.map((station) => metrobusStationPoint(current, station)).filter((point): point is MapPoint => point !== null) : [];
};
// A route segment must keep the trace of the line the rider is actually on.
// Shared points are only useful when drawing an unselected whole network.
export const metrobusSegmentPoints = (segment: TransitRoute['segments'][number]) => segment.stations.map((station) => metrobusStationPointForLine(segment.line, station)).filter((point): point is MapPoint => point !== null);
