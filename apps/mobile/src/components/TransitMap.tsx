import { useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import Svg, { Circle, Polyline, Text as SvgText } from 'react-native-svg';
import {
  metroMapLines,
  metroStationPositions,
  metrobusLinePoints,
  metrobusLines,
  metrobusSegmentPoints,
  metrobusStationPoint,
  type TransitLine,
  type TransitRoute,
} from '@meperdienelmetro/core';
import { useApp } from '../app-state';

type Props = { lines: TransitLine[]; route?: TransitRoute; title: string };
type Point = readonly [number, number];
type Marker = { name: string; kind: 'origin' | 'transfer' | 'destination'; point: Point };

const boundsFor = (points: Point[], width: number, height: number) => {
  if (!points.length) return `0 0 ${width} ${height}`;
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
  const padding = Math.max(88, Math.min(190, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 0.18));
  return `${Math.max(0, Math.min(...xs) - padding)} ${Math.max(0, Math.min(...ys) - padding)} ${Math.min(width, Math.max(...xs) - Math.min(...xs) + padding * 2)} ${Math.min(height, Math.max(...ys) - Math.min(...ys) + padding * 2)}`;
};
const pointString = (points: Point[]) => points.map((point) => point.join(',')).join(' ');

export function TransitMap({ lines, route, title }: Props) {
  const { theme, t, mode } = useApp();
  const mapCapture = useRef<View>(null);
  const metro = Boolean(lines[0] && metroStationPositions[lines[0].stations[0]]);
  const width = metro ? 1436 : 1368, height = metro ? 1780 : 1824;
  const network = metro ? metroMapLines : metrobusLines.map((line) => ({ ...line, points: metrobusLinePoints(line) }));
  const active = new Set(route?.path ?? []);
  const segmentPoints = (segment: TransitRoute['segments'][number]) => metro
    ? segment.stations.map((station) => metroStationPositions[station]).filter((point): point is Point => Boolean(point))
    : metrobusSegmentPoints(segment);
  const routePoints = route?.segments.flatMap(segmentPoints) ?? [];
  const markers: Marker[] = !route ? [] : route.segments.flatMap((segment, index) => {
    const points = segmentPoints(segment);
    if (!points.length) return [];
    const current: Marker[] = index === 0 ? [{ name: segment.stations[0], kind: 'origin', point: points[0] }] : [{ name: segment.stations[0], kind: 'transfer', point: points[0] }];
    if (index === route.segments.length - 1) current.push({ name: segment.stations.at(-1)!, kind: 'destination', point: points.at(-1)! });
    return current;
  });
  const viewBox = route ? boundsFor([...routePoints, ...markers.map((marker) => marker.point)], width, height) : `0 0 ${width} ${height}`;
  const pointFor = (line: TransitLine, station: string) => metro ? metroStationPositions[station] : metrobusStationPoint(line, station);

  const download = async () => {
    if (!mapCapture.current) return;
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso necesario', 'Permite guardar imágenes para descargar el mapa.');
        return;
      }
      const uri = await captureRef(mapCapture, { format: 'png', quality: 1, result: 'tmpfile' });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Mapa guardado', 'Encontrarás la imagen PNG en tu galería.');
    } catch {
      Alert.alert('No se pudo descargar', 'Intenta nuevamente o revisa el permiso de fotos.');
    }
  };

  return <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
    <View style={styles.heading}>
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      <View style={styles.headingRight}>
        <Text style={[styles.caption, { color: theme.colors.muted }]}>{route ? `${route.stops} ${t.stops}` : t.map}</Text>
        {route && <Pressable onPress={download} accessibilityRole="button" accessibilityLabel="Descargar mapa como imagen" hitSlop={8} style={[styles.download, { borderColor: theme.colors.border }]}><Text style={[styles.downloadIcon, { color: theme.colors.text }]}>⇩</Text></Pressable>}
      </View>
    </View>
    <View ref={mapCapture} collapsable={false} style={[styles.viewport, { backgroundColor: mode === 'dark' ? '#10241d' : '#f8faf5' }]}>
      <Svg width="100%" height="100%" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" accessibilityLabel={title}>
        {network.map((line) => <Polyline key={line.id} points={pointString(line.points)} fill="none" stroke={line.color} strokeOpacity={route ? 0.2 : 0.72} strokeWidth={route ? 10 : 8} strokeLinecap="round" strokeLinejoin="round" />)}
        {route?.segments.map((segment, index) => <Polyline key={`${segment.line.id}-${index}`} points={pointString(segmentPoints(segment))} fill="none" stroke={segment.line.color} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" />)}
        {network.flatMap((line) => line.stations.map((station, index) => ({ line, station, point: pointFor(line, station), index }))).map(({ line, station, point, index }) => point && <Circle key={`${line.id}-${station}-${index}`} cx={point[0]} cy={point[1]} r={active.has(station) ? 5 : 3.5} fill={theme.colors.surface} stroke={active.has(station) ? theme.colors.dark : '#9cab9f'} strokeWidth={active.has(station) ? 2.5 : 1.2} />)}
        {markers.map((marker, index) => <>
          <Circle key={`halo-${marker.kind}-${index}`} cx={marker.point[0]} cy={marker.point[1]} r={22} fill={theme.colors.accent} fillOpacity={0.22} />
          <Circle key={`marker-${marker.kind}-${index}`} cx={marker.point[0]} cy={marker.point[1]} r={9} fill={theme.colors.surface} stroke={theme.colors.accent} strokeWidth={4} />
          <SvgText key={`label-${marker.kind}-${index}`} x={marker.point[0] + 18} y={marker.point[1] - 18} fontSize={marker.kind === 'transfer' ? 28 : 38} fontWeight="800" fill={theme.colors.text} stroke={mode === 'dark' ? '#10241d' : '#f8faf5'} strokeWidth={7}>{marker.name}</SvgText>
        </>)}
      </Svg>
    </View>
    <Text style={[styles.note, { color: theme.colors.muted }]}>{route ? t.mapRouteNote : t.mapNetworkNote}</Text>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 22, overflow: 'hidden', marginTop: 20 },
  heading: { paddingHorizontal: 16, paddingTop: 15, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  headingRight: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  title: { fontSize: 16, fontWeight: '900' },
  caption: { fontSize: 11, fontWeight: '700' },
  download: { width: 30, height: 30, borderWidth: 1, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  downloadIcon: { fontSize: 20, fontWeight: '900', marginTop: -3 },
  viewport: { height: 340 },
  note: { paddingHorizontal: 16, paddingVertical: 12, fontSize: 11, lineHeight: 16 },
});
