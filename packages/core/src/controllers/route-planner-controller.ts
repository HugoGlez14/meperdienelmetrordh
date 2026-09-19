import {
  findMetroRoute,
  findMetroRoutes,
  metroStations
} from '../models/metro.ts';
import {
  findMetrobusRoute,
  metrobusStations
} from '../models/metrobus.ts';
import type {
  RouteMode,
  TransitRoute,
  Transport
} from '../models/types.ts';

export type PlanRouteRequest = {
  transport: Transport;
  from: string;
  to: string;
  mode?: RouteMode;
};

export type RoutePlanError =
  | 'missing-station'
  | 'same-station'
  | 'unknown-station'
  | 'route-not-found';

export type PlanRouteResult = {
  routes: TransitRoute[];
  error: RoutePlanError | null;
};

export function stationsFor(transport: Transport): string[] {
  return transport === 'metro' ? metroStations : metrobusStations;
}

export function planRoute({
  transport,
  from,
  to,
  mode = 'fast'
}: PlanRouteRequest): PlanRouteResult {
  if (!from || !to) return { routes: [], error: 'missing-station' };
  if (from === to) return { routes: [], error: 'same-station' };

  const stations = stationsFor(transport);
  if (!stations.includes(from) || !stations.includes(to)) {
    return { routes: [], error: 'unknown-station' };
  }

  const routes = transport === 'metro'
    ? findMetroRoutes(from, to, mode)
    : [findMetrobusRoute(from, to)].filter(
      (route): route is TransitRoute => route !== null
    );

  return {
    routes,
    error: routes.length ? null : 'route-not-found'
  };
}

export function planPrimaryRoute(request: PlanRouteRequest): TransitRoute | null {
  if (request.transport === 'metro') {
    return findMetroRoute(request.from, request.to, request.mode ?? 'fast');
  }
  return findMetrobusRoute(request.from, request.to);
}
