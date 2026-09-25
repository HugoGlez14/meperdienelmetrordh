import { defineConfig } from "vite";
import { loadEnv } from "vite";
import {
  metrobusLinePoints,
  metrobusLines,
  metrobusStationPoint,
  planRoute,
} from "@meperdienelmetro/core";

const toCoordinate = ([x, y]) => [
  19.6 - (y / 1824) * 0.45,
  -99.25 + (x / 1368) * 0.35,
];
const routeId = (line) => `local-${line.id}`;

export function createLocalMetrobusNetwork() {
  const stops = new Map();
  for (const line of metrobusLines) {
    for (const station of line.stations) {
      const point = metrobusStationPoint(line, station);
      if (point && !stops.has(station)) {
        const [stop_lat, stop_lon] = toCoordinate(point);
        stops.set(station, {
          stop_id: station,
          stop_name: station,
          stop_lat: String(stop_lat),
          stop_lon: String(stop_lon),
        });
      }
    }
  }
  return {
    source: "local",
    routes: metrobusLines.map((line) => ({
      route_id: routeId(line),
      route_short_name: line.id,
      route_long_name: `${line.stations[0]} — ${line.stations.at(-1)}`,
      route_color: line.color.replace("#", ""),
      shapeIds: [routeId(line)],
    })),
    stops: [...stops.values()],
    shapes: Object.fromEntries(
      metrobusLines.map((line) => [routeId(line), metrobusLinePoints(line).map(toCoordinate)]),
    ),
  };
}

export function planLocalMetrobusJourney(from, to, now = Date.now() / 1000) {
  const route = planRoute({ transport: "metrobus", from, to }).routes[0];
  if (!route) return { found: false, source: "local", message: "No se encontró una ruta para esas estaciones." };
  let departure = now;
  const segments = route.segments.map((segment) => {
    const duration = Math.max(0, segment.stations.length - 1) * 2 * 60;
    const arrival = departure + duration;
    const lineRoute = {
      route_id: routeId(segment.line),
      route_short_name: segment.line.id,
      route_long_name: `${segment.stations[0]} — ${segment.stations.at(-1)}`,
      route_color: segment.line.color.replace("#", ""),
    };
    const result = {
      kind: "ride",
      routeId: lineRoute.route_id,
      route: lineRoute,
      fromName: segment.stations[0],
      toName: segment.stations.at(-1),
      stopIds: segment.stations,
      points: segment.stations
        .map((station) => metrobusStationPoint(segment.line, station))
        .filter(Boolean)
        .map(toCoordinate),
      departure,
      arrival,
    };
    departure = arrival + 4 * 60;
    return result;
  });
  return {
    found: true,
    source: "local",
    calculatedAt: now,
    arrival: now + route.minutes * 60,
    minutes: route.minutes,
    transfers: route.transfers,
    segments,
  };
}

function sendJson(response, body, status = 200) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

function localMetrobusApi() {
  const network = createLocalMetrobusNetwork();
  return {
    name: "local-metrobus-api",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url, "http://127.0.0.1");
        if (url.pathname === "/api/metrobus/network") return sendJson(response, network);
        if (url.pathname === "/api/metrobus/live") return sendJson(response, {
          source: "local",
          timestamp: 0,
          vehicles: [],
          stale: true,
          error: "Las posiciones en vivo requieren el backend GTFS configurado.",
        });
        if (url.pathname === "/api/metrobus/plan") {
          try {
            return sendJson(response, planLocalMetrobusJourney(
              url.searchParams.get("from") || "",
              url.searchParams.get("to") || "",
            ));
          } catch {
            return sendJson(response, { error: "Selecciona dos estaciones válidas y diferentes." }, 400);
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const apiTarget = loadEnv(mode, process.cwd(), "").METROBUS_API_TARGET;
  return apiTarget
    ? { server: { proxy: { "/api/metrobus": apiTarget } } }
    : { plugins: [localMetrobusApi()] };
});
