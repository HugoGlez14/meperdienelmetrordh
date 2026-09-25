import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, BusFront, Clock3, Download, Footprints, MapPin, Navigation, Route } from "lucide-react";
import { metrobusStationLines, metrobusStations, planRoute } from "@meperdienelmetro/core";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import OfflinePlanner from "./MetrobusPlanner";
import MetrobusSelect from "./MetrobusSelect";

async function get(path, signal) {
  const request = new AbortController();
  const abort = () => request.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, path === 'network' ? 45000 : path.startsWith("plan?") ? 30000 : 10000);
  try {
    const response = await fetch("/api/metrobus/" + path, { signal: request.signal });
    if (!response.ok) throw new Error("Las posiciones en vivo no están disponibles en este momento.");
    return await response.json();
  } catch (error) {
    if (request.signal.aborted && !signal?.aborted)
      throw new Error("La consulta tardó demasiado. Puedes usar el planificador sin conexión.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
const clock = (value) =>
  new Date(value * 1000).toLocaleTimeString("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
  });

const stationKey = (value = "") => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("es")
  .replace(/\s+l[1-7](?:\s+(?:norte|sur|oriente|poniente|e\d+))?\.?$/i, "")
  .replace(/[.'’]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const distance = ([lat, lng], point) => (lat - point[0]) ** 2 + (lng - point[1]) ** 2;

function stationCandidates(network, name, lineId) {
  const key = stationKey(name);
  const matches = network.stops.filter((stop) => stationKey(stop.stop_name) === key);
  const lineMatches = matches.filter((stop) => new RegExp(`(?:^|\\s)L${lineId}(?:\\s|\\.|$)`, "i").test(stop.stop_name));
  return (lineMatches.length ? lineMatches : matches).map((stop) => ({
    id: stop.stop_id,
    point: [+stop.stop_lat, +stop.stop_lon],
  }));
}

function closestIndex(points, candidates) {
  let best = { index: -1, score: Infinity, stopId: null };
  for (const candidate of candidates) {
    for (let index = 0; index < points.length; index += 1) {
      const score = distance(candidate.point, points[index]);
      if (score < best.score) best = { index, score, stopId: candidate.id };
    }
  }
  return best;
}

export function buildLiveJourney(routePlan, network, startedAt = Math.floor(Date.now() / 1000)) {
  if (!routePlan) return { found: false, message: "No encontramos un recorrido entre esas estaciones." };
  let elapsedMinutes = 0;
  const segments = routePlan.segments.map((segment, segmentIndex) => {
    const lineId = String(segment.line.id);
    const fromName = segment.stations[0];
    const toName = segment.stations.at(-1);
    const fromCandidates = stationCandidates(network, fromName, lineId);
    const toCandidates = stationCandidates(network, toName, lineId);
    let selected = null;
    for (const route of network.routes.filter((item) => String(item.route_short_name) === lineId)) {
      for (const shapeId of route.shapeIds || []) {
        const shape = network.shapes[shapeId] || [];
        if (!shape.length || !fromCandidates.length || !toCandidates.length) continue;
        const fromPoint = closestIndex(shape, fromCandidates);
        const toPoint = closestIndex(shape, toCandidates);
        const score = fromPoint.score + toPoint.score;
        if (!selected || score < selected.score) selected = { route, shape, fromPoint, toPoint, score };
      }
    }
    const rideMinutes = Math.max(2, (segment.stations.length - 1) * 2);
    const departure = startedAt + elapsedMinutes * 60;
    elapsedMinutes += rideMinutes;
    const arrival = startedAt + elapsedMinutes * 60;
    if (segmentIndex < routePlan.segments.length - 1) elapsedMinutes += 4;
    let points = [];
    let stopIds = [];
    if (selected) {
      const start = selected.fromPoint.index;
      const end = selected.toPoint.index;
      points = start <= end
        ? selected.shape.slice(start, end + 1)
        : selected.shape.slice(end, start + 1).reverse();
      stopIds = [selected.fromPoint.stopId, selected.toPoint.stopId].filter(Boolean);
    }
    const route = selected?.route || network.routes.find((item) => String(item.route_short_name) === lineId) || {
      route_id: `line-${lineId}`,
      route_short_name: lineId,
      route_long_name: `Línea ${lineId}`,
      route_color: segment.line.color.replace("#", ""),
    };
    return {
      kind: "ride", lineId, routeId: route.route_id, route, points, stopIds,
      fromName, toName, departure, arrival, stations: segment.stations,
    };
  });
  return {
    found: true,
    source: "local-live",
    minutes: routePlan.minutes,
    arrival: startedAt + routePlan.minutes * 60,
    transfers: routePlan.transfers,
    segments,
  };
}

function LegacyGeographicMap({ network, live, line, variant, journey }) {
  const [zoom, setZoom] = useState(1),
    [selected, setSelected] = useState(null);
  const local = network.source === "local";
  const now = Date.now() / 1000;
  const freshVehicles = (live?.vehicles || []).filter(v =>
    Number.isFinite(v.lat) && Number.isFinite(v.lng) && v.timestamp > 0 && now - v.timestamp <= 120 && v.timestamp <= now + 30,
  );
  const journeyRouteIds = new Set(
    journey?.found
      ? journey.segments.filter((segment) => segment.kind === "ride").map((segment) => segment.routeId)
      : [],
  );
  const journeyLineIds = new Set(
    journey?.found
      ? journey.segments.filter((segment) => segment.kind === "ride").map((segment) => String(segment.lineId || segment.route?.route_short_name || ""))
      : [],
  );
  const routes = network.routes.filter((route) =>
    journey?.found
      ? journeyRouteIds.has(route.route_id) || journeyLineIds.has(String(route.route_short_name))
      : (!line || route.route_short_name === line) && (!variant || route.route_id === variant),
  );
  const routeIds = new Set(routes.map((r) => r.route_id));
  const paths = routes.flatMap((r) =>
    r.shapeIds.map((id) => ({
      id: r.route_id + ":" + id,
      points: network.shapes[id] || [],
      color: "#" + r.route_color,
    })),
  );
  const selectedJourneyPoints = journey?.found
    ? journey.segments.filter((segment) => segment.kind === "ride").flatMap((segment) => segment.points || [])
    : [];
  const extent = selectedJourneyPoints.length ? selectedJourneyPoints : paths.flatMap((p) => p.points);
  const all = [
    ...(extent.length ? extent : Object.values(network.shapes).flat()),
    ...(!journey?.found && !line && !variant
      ? freshVehicles
          .map((v) => [v.lat, v.lng])
      : []),
  ];
  const extentBounds = all.reduce((bounds, [lat, lng]) => [
    Math.min(bounds[0], lat), Math.max(bounds[1], lat),
    Math.min(bounds[2], lng), Math.max(bounds[3], lng),
  ], [Infinity, -Infinity, Infinity, -Infinity]);
  const [minLat, maxLat, minLng, maxLng] = all.length ? extentBounds : [19.3, 19.5, -99.2, -99.1];
  const latPadding = Math.max(0.003, (maxLat - minLat) * 0.08);
  const lngPadding = Math.max(0.003, (maxLng - minLng) * 0.08);
  const viewMinLat = selectedJourneyPoints.length ? minLat - latPadding : minLat;
  const viewMaxLat = selectedJourneyPoints.length ? maxLat + latPadding : maxLat;
  const viewMinLng = selectedJourneyPoints.length ? minLng - lngPadding : minLng;
  const viewMaxLng = selectedJourneyPoints.length ? maxLng + lngPadding : maxLng;
  const scale = Math.min(
    900 / (Math.max(0.001, viewMaxLng - viewMinLng) * Math.cos((19.4 * Math.PI) / 180)),
    1000 / Math.max(0.001, viewMaxLat - viewMinLat),
  );
  const point = ([lat, lng]) => [
    50 + (lng - viewMinLng) * Math.cos((19.4 * Math.PI) / 180) * scale,
    50 + (viewMaxLat - lat) * scale,
  ];
  const points = (coordinates) =>
    coordinates.map((p) => point(p).join(",")).join(" ");
  const vehicles =
    freshVehicles.filter(
      (v) =>
        (routeIds.has(v.routeId) || (!journey?.found && !line && !variant)) &&
        Date.now() / 1000 - v.timestamp <= 120 &&
        (!selectedJourneyPoints.length || (
          v.lat >= minLat - latPadding && v.lat <= maxLat + latPadding &&
          v.lng >= minLng - lngPadding && v.lng <= maxLng + lngPadding
        )),
    ) || [];
  const journeyStopIds = new Set(
    journey?.found ? journey.segments.flatMap((segment) => segment.stopIds || []) : [],
  );
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selected?.id);
  useEffect(() => {
    setZoom(1);
    setSelected(null);
  }, [line, variant, journey]);
  function download() {
    const data = JSON.stringify(
      {
        type: "FeatureCollection",
        features: paths.map((p) => ({
          type: "Feature",
          properties: { id: p.id, color: p.color },
          geometry: {
            type: "LineString",
            coordinates: p.points.map(([lat, lng]) => [lng, lat]),
          },
        })),
      },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([data], { type: "application/geo+json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "recorridos-metrobus.geojson";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="mb-map" aria-label="Mapa de Metrobús">
      <div className="mb-map-head">
        <div className="mb-map-heading">
          <span className="mb-map-heading-icon"><Navigation size={19} /></span>
          <div>
            <p className="eyebrow">{local ? "MAPA LOCAL" : "MAPA EN VIVO"}</p>
            <h3>{local ? "Recorridos de Metrobús" : journey?.found ? "Unidades de tu trayecto" : "Recorridos de Metrobús"}</h3>
          </div>
        </div>
        <span className="mb-map-count"><BusFront size={17} /> {vehicles.length} unidades recientes</span>
      </div>
      <div className="mb-map-tools">
        <div className="mb-map-lines" aria-label="Líneas visibles">
          {[...new Map(routes.map((route) => [route.route_short_name, route])).values()].map((route) => (
            <span className="mb-map-line" key={route.route_short_name} style={{"--line-color": `#${route.route_color}`}}>
              Línea {route.route_short_name}
            </span>
          ))}
        </div>
        <div>
          <button
            onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
            aria-label="Alejar mapa"
          >
            −
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(4, z + 0.5))}
            aria-label="Acercar mapa"
          >
            +
          </button>
          <button onClick={download} title="Descargar recorridos visibles"><Download size={16} /> <span>Descargar</span></button>
        </div>
      </div>
      <div className="mb-map-viewport">
        <svg
          viewBox="0 0 1000 1100"
          style={{
            width: zoom * 100 + "%",
            display: "block",
            background: "transparent",
          }}
          role="img"
          aria-label="Recorridos geográficos y posiciones recientes de Metrobús"
        >
          {paths.map((p) => (
            <polyline
              key={p.id}
              points={points(p.points)}
              fill="none"
              stroke={p.color}
              strokeWidth={journey?.found ? "5" : "3"}
              opacity={journey?.found ? ".82" : ".7"}
            />
          ))}
          {journey?.segments
            ?.filter((s) => s.kind === "ride")
            .map((s, i) => (
              <polyline
                key={i}
                points={points(s.points || [])}
                fill="none"
                stroke={"#" + s.route.route_color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          {network.stops
            .filter(
              (s) =>
                (!journey?.found || journeyStopIds.has(s.stop_id)) &&
                +s.stop_lat >= viewMinLat &&
                +s.stop_lat <= viewMaxLat &&
                +s.stop_lon >= viewMinLng &&
                +s.stop_lon <= viewMaxLng,
            )
            .map((s) => {
              const [x, y] = point([+s.stop_lat, +s.stop_lon]);
              return (
                <circle
                  key={s.stop_id}
                  cx={x}
                  cy={y}
                  r={journey?.found ? "5" : "3"}
                  fill="white"
                  stroke={journey?.found ? "#aa263d" : "#62545b"}
                  strokeWidth={journey?.found ? "2" : "1"}
                >
                  <title>{s.stop_name}</title>
                </circle>
              );
            })}
          {vehicles.map((v) => {
            const [x, y] = point([v.lat, v.lng]);
            return (
              <g
                key={v.id}
                tabIndex="0"
                role="button"
                aria-label={`Unidad ${v.label || v.id}, ruta ${v.routeId || "sin asignar"}, posición ${clock(v.timestamp)}`}
                onClick={() => setSelected(v)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(v);
                  }
                }}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={selectedVehicle?.id === v.id ? "11" : "9"}
                  fill={"#" + (network.routes.find((route) => route.route_id === v.routeId)?.route_color || "162b45")}
                  stroke="white"
                  strokeWidth="2"
                />
                <BusFront x={x - 6} y={y - 6} width={12} height={12} color="white" strokeWidth={2} aria-hidden="true" />
                <title>{`Unidad ${v.label || v.id} - ${clock(v.timestamp)}`}</title>
              </g>
            );
          })}
        </svg>
      </div>
      {selectedVehicle && (
        <div className="mb-vehicle-detail" role="status">
          <BusFront size={19} />
          <div><strong>Unidad {selectedVehicle.label || selectedVehicle.id}</strong><span>Ruta {selectedVehicle.routeId || "sin asignar"} · posición {clock(selectedVehicle.timestamp)}</span></div>
        </div>
      )}
      <p className="mb-map-note">
        {local ? "Mapa esquemático incluido en la aplicación." : "Posiciones recibidas en los últimos 2 minutos. Toca una unidad para ver su información."}
        {journey?.found && !local && " El tiempo de llegada del viaje procede del horario, no de la ubicación de la unidad."}
      </p>
    </section>
  );
}

function FitLeafletMap({ points }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (!points.length) return;
    const bounds = L.latLngBounds(points);
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [34, 34], maxZoom: 15, animate: false });
  }, [map, points]);
  return null;
}

export function routeTerminals(route) {
  const clean = String(route?.route_long_name || "")
    .replace(/^\S+\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
  const parts = clean.split(/\s+-\s+/).filter(Boolean);
  return {
    origin: parts[0] || "Origen no identificado",
    destination: parts.slice(1).join(" - ") || "Destino no identificado",
  };
}

function titleCase(value) {
  return value.replace(/(^|\s)(\p{L})/gu, (_, space, letter) => space + letter.toLocaleUpperCase("es"));
}

function vehicleMarker(color) {
  return L.divIcon({
    className: "mb-leaflet-vehicle-wrap",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -13],
    html: `<span class="mb-leaflet-vehicle" style="--vehicle-color:#${color}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 17h12M6 17V6.8C6 5.25 7.25 4 8.8 4h6.4C16.75 4 18 5.25 18 6.8V17M7 12h10M8.5 8h7M8 20v-3m8 3v-3"/><circle cx="9" cy="15" r="1"/><circle cx="15" cy="15" r="1"/></svg></span>`,
  });
}

export function GeographicMap({ network, live, line, variant, journey }) {
  const now = Date.now() / 1000;
  const freshVehicles = (live?.vehicles || []).filter((vehicle) =>
    Number.isFinite(vehicle.lat) && Number.isFinite(vehicle.lng) && vehicle.timestamp > 0 &&
    now - vehicle.timestamp <= 120 && vehicle.timestamp <= now + 30,
  );
  const journeyRouteIds = new Set(journey?.found
    ? journey.segments.filter((segment) => segment.kind === "ride").map((segment) => segment.routeId)
    : []);
  const journeyLineIds = new Set(journey?.found
    ? journey.segments.filter((segment) => segment.kind === "ride").map((segment) => String(segment.lineId || segment.route?.route_short_name || ""))
    : []);
  const routes = network.routes.filter((route) => journey?.found
    ? journeyRouteIds.has(route.route_id) || journeyLineIds.has(String(route.route_short_name))
    : (!line || route.route_short_name === line) && (!variant || route.route_id === variant));
  const routeIds = new Set(routes.map((route) => route.route_id));
  const allRoutePaths = routes.flatMap((route) => (route.shapeIds || []).map((shapeId) => ({
    id: `${route.route_id}:${shapeId}`,
    route,
    points: network.shapes[shapeId] || [],
  }))).filter((path) => path.points.length > 1);
  const journeyPaths = journey?.found
    ? journey.segments.filter((segment) => segment.kind === "ride" && segment.points?.length > 1).map((segment, index) => ({
      id: `journey:${index}`,
      route: segment.route,
      points: segment.points,
    }))
    : [];
  const visiblePaths = journeyPaths.length ? journeyPaths : allRoutePaths;
  const journeyPoints = journeyPaths.flatMap((path) => path.points);
  const journeyBounds = journeyPoints.length ? journeyPoints.reduce((bounds, [lat, lng]) => ({
    minLat: Math.min(bounds.minLat, lat), maxLat: Math.max(bounds.maxLat, lat),
    minLng: Math.min(bounds.minLng, lng), maxLng: Math.max(bounds.maxLng, lng),
  }), { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity }) : null;
  const latPadding = journeyBounds ? Math.max(0.004, (journeyBounds.maxLat - journeyBounds.minLat) * 0.12) : 0;
  const lngPadding = journeyBounds ? Math.max(0.004, (journeyBounds.maxLng - journeyBounds.minLng) * 0.12) : 0;
  const vehicles = freshVehicles.filter((vehicle) => {
    if (!(routeIds.has(vehicle.routeId) || (!journey?.found && !line && !variant))) return false;
    if (!journeyBounds) return true;
    return vehicle.lat >= journeyBounds.minLat - latPadding && vehicle.lat <= journeyBounds.maxLat + latPadding &&
      vehicle.lng >= journeyBounds.minLng - lngPadding && vehicle.lng <= journeyBounds.maxLng + lngPadding;
  });
  const boundsPoints = [...visiblePaths.flatMap((path) => path.points), ...vehicles.map((vehicle) => [vehicle.lat, vehicle.lng])];
  const routeById = new Map(network.routes.map((route) => [route.route_id, route]));
  const mapKey = `${line}:${variant}:${journey?.segments?.map((segment) => segment.routeId || segment.lineId).join(",") || "network"}`;
  const download = () => {
    const data = JSON.stringify({
      type: "FeatureCollection",
      features: visiblePaths.map((path) => ({
        type: "Feature",
        properties: { id: path.id, line: path.route.route_short_name, color: path.route.route_color },
        geometry: { type: "LineString", coordinates: path.points.map(([lat, lng]) => [lng, lat]) },
      })),
    }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: "application/geo+json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = journey?.found ? "mi-trayecto-metrobus.geojson" : "recorridos-metrobus.geojson";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="mb-map mb-leaflet-map" aria-label="Mapa de Metrobús" data-vehicle-ids={vehicles.map((vehicle) => vehicle.id).join(",")} data-path-lines={visiblePaths.map((path) => path.route.route_short_name).join(",")}>
      <div className="mb-map-head">
        <div className="mb-map-heading"><span className="mb-map-heading-icon"><Navigation size={19} /></span><div><p className="eyebrow">MAPA EN VIVO</p><h3>{journey?.found ? "Tu trayecto y sus unidades" : "Red y unidades de Metrobús"}</h3></div></div>
        <span className="mb-map-count"><BusFront size={15} /> {vehicles.length} unidades visibles</span>
      </div>
      <div className="mb-map-tools">
        <div className="mb-map-lines" aria-label="Líneas visibles">
          {[...new Map(routes.map((route) => [route.route_short_name, route])).values()].map((route) => <span className="mb-map-line" key={route.route_short_name} style={{ "--line-color": `#${route.route_color}` }}>Línea {route.route_short_name}</span>)}
        </div>
        <div><button type="button" onClick={download} title="Descargar recorridos visibles"><Download size={15} /> <span>Descargar</span></button></div>
      </div>
      <div className="mb-map-viewport mb-leaflet-viewport">
        <MapContainer key={mapKey} center={[19.4326, -99.1332]} zoom={11} scrollWheelZoom className="mb-leaflet-canvas">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitLeafletMap points={boundsPoints} />
          {visiblePaths.map((path) => <Polyline key={path.id} positions={path.points} pathOptions={{ color: `#${path.route.route_color}`, weight: journey?.found ? 7 : 4, opacity: journey?.found ? 0.95 : 0.72 }} />)}
          {vehicles.map((vehicle) => {
            const route = routeById.get(vehicle.routeId);
            const terminals = routeTerminals(route);
            const age = Math.max(0, Math.round(now - vehicle.timestamp));
            return <Marker key={vehicle.id} position={[vehicle.lat, vehicle.lng]} icon={vehicleMarker(route?.route_color || "26364A")}>
              <Popup minWidth={280} maxWidth={340} className="mb-vehicle-popup">
                <div className="mb-popup-head"><span style={{ background: `#${route?.route_color || "26364A"}` }}><BusFront size={17} /></span><div><small>LÍNEA {route?.route_short_name || "SIN ASIGNAR"}</small><strong>Unidad {vehicle.label || vehicle.id}</strong></div></div>
                <div className="mb-popup-direction"><div><small>Origen</small><strong>{titleCase(terminals.origin)}</strong></div><ArrowRight size={18} /><div><small>Destino</small><strong>{titleCase(terminals.destination)}</strong></div></div>
                <dl className="mb-popup-details">
                  <div><dt>Última señal</dt><dd>{age < 15 ? "Hace unos segundos" : `Hace ${age} segundos`} · {clock(vehicle.timestamp)}</dd></div>
                  <div><dt>Recorrido GTFS</dt><dd>{route?.route_long_name || "No identificado"}</dd></div>
                  <div><dt>ID de unidad</dt><dd>{vehicle.id}</dd></div>
                  {vehicle.tripId && <div><dt>ID de viaje</dt><dd>{vehicle.tripId}</dd></div>}
                  <div><dt>Ubicación</dt><dd>{vehicle.lat.toFixed(5)}, {vehicle.lng.toFixed(5)}</dd></div>
                </dl>
                <p className="mb-popup-note">Posición reportada por el servicio GTFS en tiempo real. El destino corresponde al recorrido asignado a esta unidad.</p>
              </Popup>
            </Marker>;
          })}
        </MapContainer>
      </div>
      <p className="mb-map-note">Mapa de calles por OpenStreetMap · posiciones GTFS de los últimos 2 minutos. Toca un camioncito para ver origen, destino y detalles.</p>
    </section>
  );
}

function MetrobusLiveBackend({ mobile }) {
  const [network, setNetwork] = useState(null),
    [live, setLive] = useState(null),
    [networkError, setNetworkError] = useState(""),
    [liveError, setLiveError] = useState(""),
    [offline, setOffline] = useState(false),
    [automaticFallback, setAutomaticFallback] = useState(false),
    [retryKey, setRetryKey] = useState(0),
    [line, setLine] = useState(""),
    [variant, setVariant] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [journey, setJourney] = useState(null),
    [busy, setBusy] = useState(false),
    [planError, setPlanError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    let networkLoaded = false;
    async function refresh() {
      const tasks = [
        get("live", controller.signal).then(value => {
          setLive(value);
          setLiveError("");
        }).catch(error => {
          if (!controller.signal.aborted) setLiveError(error.message);
        }),
      ];
      if (!networkLoaded) tasks.push(
        get("network", controller.signal).then(value => {
          setNetwork(value);
          networkLoaded = true;
          setNetworkError("");
        }).catch(error => {
          if (!controller.signal.aborted) {
            setNetworkError(error.message);
            setAutomaticFallback(true);
            setOffline(true);
          }
        }),
      );
      await Promise.allSettled(tasks);
      if (!controller.signal.aborted) timer = setTimeout(refresh, 30000);
    }
    refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [retryKey]);
  const error = networkError || liveError;
  const localNetwork = network?.source === "local";
  const plannerStops = useMemo(() => metrobusStations.map((name) => ({
    value: name,
    label: name,
    description: `Línea${metrobusStationLines(name).length === 1 ? "" : "s"} ${metrobusStationLines(name).map((item) => item.id).join(", ")}`,
  })), []);
  function calculate(e) {
    e.preventDefault();
    setBusy(true);
    setPlanError("");
    setJourney(null);
    try {
      const routePlan = planRoute({ transport: "metrobus", from, to }).routes[0] || null;
      const result = buildLiveJourney(routePlan, network);
      setJourney(result);
      if (result.found) {
        setLine("");
        setVariant("");
      } else {
        setPlanError(result.message);
      }
    } catch (e) {
      setPlanError("No pudimos calcular ese recorrido. Intenta con otras estaciones.");
    } finally {
      setBusy(false);
    }
  }
  if (offline)
    return (
      <>
        {automaticFallback ? (
          <div className="mb-live-status mb-offline-status" role="status">
            <span className="mb-status-dot mb-status-dot-muted" aria-hidden="true" />
            <div className="mb-live-status-copy">
              <strong>Tiempo real no disponible · Planificador local activo</strong>
              <span>Puedes calcular tu recorrido mientras se restablecen las posiciones de las unidades.</span>
            </div>
            <button onClick={() => {
              setOffline(false);
              setAutomaticFallback(false);
              setNetworkError("");
              setLiveError("");
              setRetryKey(value => value + 1);
            }}>Con conexión <ArrowRight size={16} /></button>
          </div>
        ) : (
          <div className="mb-mode-switch" aria-label="Modo del mapa">
            <button type="button" onClick={() => setOffline(false)}>Con conexión</button>
            <button type="button" className="active" aria-pressed="true">Sin conexión</button>
          </div>
        )}
        <OfflinePlanner mobile={mobile} />
      </>
    );
  return (
    <section className="metrobus-page mb-live-page">
      <div className="metrobus-intro mb-live-intro" id="ruta-metrobus">
        <div>
          <p className="eyebrow">METROBÚS CDMX · RUTAS Y UNIDADES</p>
          <h1>
            Tu camino por la ciudad, <span>más claro.</span>
          </h1>
          <p>Elige tu destino, revisa el trayecto y ubica las unidades que circulan por sus rutas.</p>
        </div>
        <div className="mb-intro-emblem" aria-hidden="true"><BusFront size={39} /></div>
      </div>
      <div className="mb-live-status" role="status">
        <span className={"mb-status-dot" + (error || !live || live.stale ? " mb-status-dot-muted" : "")} aria-hidden="true" />
        <div className="mb-live-status-copy">
          <strong>{error || (!network ? "Cargando recorridos…" : localNetwork ? "Servicio local disponible" : !live || live.stale ? "Sin posiciones recientes" : "Unidades actualizadas")}</strong>
          <span>{!network ? "Estamos preparando el mapa." : localNetwork ? "Rutas, estaciones y cálculo de trayectos listos." : !live || live.stale ? "Puedes consultar rutas y horarios mientras tanto." : `Última señal ${clock(live.timestamp)} · se actualiza automáticamente`}</span>
          {live?.error && <small>{live.error}</small>}
        </div>
        <div className="mb-mode-switch" aria-label="Modo del mapa">
          <button type="button" className="active" aria-pressed="true">Con conexión</button>
          <button type="button" onClick={() => setOffline(true)}>Sin conexión</button>
        </div>
      </div>
      {network && (
        <>
          <div className="workspace mb-live-workspace">
            <aside className="mb-live-sidebar">
              <form className="mb-plan-form" onSubmit={calculate}>
                <div className="mb-panel-title"><span className="mb-panel-icon"><Route size={20} /></span><div><p className="eyebrow">PLANEA TU VIAJE</p><h2>¿A dónde vas?</h2></div></div>
                {[
                  ["Origen", from, setFrom],
                  ["Destino", to, setTo],
                ].map(([label, value, set]) => (
                  <MetrobusSelect key={label} label={label} value={value} disabled={busy} icon={<MapPin size={18}/>}
                    options={plannerStops}
                    onChange={next => {set(next); setJourney(null);}}/>
                ))}
                <p className="mb-departure"><Clock3 size={15} /> Salida ahora · hora de Ciudad de México</p>
                <button
                  className="search-button"
                  aria-busy={busy}
                  disabled={busy || !from || !to || from === to}
                >
                  {busy ? "Calculando…" : <>Encontrar trayecto <ArrowRight size={18} /></>}
                </button>
                <p role="alert">{planError}</p>
              </form>
              {journey?.found ? <div className="mb-filter-panel mb-trip-filter"><p className="eyebrow">VISTA ACTIVA</p><strong>Solo tu trayecto</strong><p>El mapa muestra los recorridos y las unidades identificadas para las líneas de este viaje.</p><button type="button" onClick={() => { setJourney(null); setLine(""); setVariant(""); }}>Explorar toda la red <ArrowRight size={16} /></button></div> : <div className="mb-filter-panel"><p className="eyebrow">EXPLORA LA RED</p><h3>Filtra los recorridos</h3>
                <MetrobusSelect label="Línea" value={line} icon={<BusFront size={18}/>}
                  options={[{value: '', label: 'Todas las líneas'}, ...[...new Set(network.routes.map(r => r.route_short_name))].sort().map(value => ({value, label: `Línea ${value}`, color: '#' + network.routes.find(r => r.route_short_name === value).route_color}))]}
                  onChange={value => {setLine(value); setVariant('');}}/>
                <MetrobusSelect label="Recorrido y sentido" value={variant} icon={<Navigation size={18}/>}
                  options={[{value: '', label: 'Todos los recorridos'}, ...network.routes.filter(r => !line || r.route_short_name === line).map(r => ({value: r.route_id, label: r.route_long_name, color: '#' + r.route_color}))]}
                  onChange={setVariant}/>
              </div>}
              {!localNetwork && import.meta.env.DEV && network.planningMode !== 'offline' && <div className="mb-downloads">
                <a href="/api/metrobus/download/static">
                  <Download size={15} /> Datos de rutas GTFS
                </a>
                <a href="/api/metrobus/download/realtime">
                  <Download size={15} /> Últimas posiciones
                </a>
              </div>}
            </aside>
            <section className="result metrobus-result">
              {journey &&
                (journey.found ? (
                  <div className="mb-journey">
                    <div className="mb-journey-heading"><div><p className="eyebrow">TU VIAJE EN METROBÚS</p><h2>{from} <ArrowRight size={20} /> {to}</h2></div><span className="mb-schedule-label"><Clock3 size={15} /> Ruta estimada + unidades en vivo</span></div>
                    <div className="mb-trip-stats"><div><strong>{journey.minutes}<small> min</small></strong><span>duración estimada</span></div><div><strong>{clock(journey.arrival)}</strong><span>llegada estimada</span></div><div><strong>{journey.transfers}</strong><span>{journey.transfers === 1 ? "transbordo" : "transbordos"}</span></div></div>
                    <div className="mb-steps-heading"><h3>Tu recorrido paso a paso</h3><span>{journey.segments.length} {journey.segments.length === 1 ? "tramo" : "tramos"}</span></div>
                    <ol className="mb-steps">
                      {journey.segments.map((segment, index) => (
                        <li className="mb-step" key={index}>
                          <span className="mb-step-icon" style={{"--step-color": segment.kind === "walk" ? "#64748b" : `#${segment.route.route_color}`}}>{segment.kind === "walk" ? <Footprints size={18} /> : <BusFront size={18} />}</span>
                          <div className="mb-step-body"><div className="mb-step-top"><strong>{segment.kind === "walk" ? "Camina al siguiente andén" : `Línea ${segment.route.route_short_name}`}</strong><span>{clock(segment.departure)}–{clock(segment.arrival)}</span></div><p>{segment.fromName} <ArrowRight size={15} /> {segment.toName}</p>{segment.kind === "ride" && <small>{segment.route.route_long_name}</small>}</div>
                        </li>
                      ))}
                    </ol>
                    <p className="mb-schedule-note"><Clock3 size={16} /> El trayecto se calcula con la red de estaciones; las unidades mostradas sí provienen del servicio en tiempo real.</p>
                    {journey.walkingNote && <small className="mb-walking-note">{journey.walkingNote}</small>}
                  </div>
                ) : (
                  <div className="mb-no-journey" role="status"><Route size={25} /><strong>Sin viaje programado</strong><p>{journey.message}</p></div>
                ))}
              {!journey && <div className="mb-map-intro"><span className="mb-map-intro-icon"><BusFront size={22} /></span><div><h2>Explora el Metrobús en vivo</h2><p>Filtra por línea y recorrido. Toca un camioncito para consultar su última posición.</p></div></div>}
              <GeographicMap network={network} live={error ? { ...live, vehicles: [] } : live} line={line} variant={variant} journey={journey} />
            </section>
          </div>
        </>
      )}
    </section>
  );
}

export default function MetrobusLive({ mobile }) {
  return <MetrobusLiveBackend mobile={mobile} />;
}
