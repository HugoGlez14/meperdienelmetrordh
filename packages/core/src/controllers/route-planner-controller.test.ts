import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findMetroRoute,
  findMetroRoutes,
  metroLines,
  metroStations
} from '../models/metro.ts';
import {
  findMetrobusRoute,
  metrobusStations
} from '../models/metrobus.ts';
import { planRoute } from './route-planner-controller.ts';

describe('modelo de rutas de Metro', () => {
  it('incluye las 195 estaciones contadas por línea', () => {
    assert.equal(metroLines.reduce((total, line) => total + line.stations.length, 0), 195);
  });

  it('calcula una ruta directa con dirección correcta', () => {
    const route = findMetroRoute('Balderas', 'Coyoacán');
    assert.equal(route?.transfers, 0);
    assert.equal(route?.stops, 8);
    assert.equal(route?.segments[0].direction, 'Universidad');
  });

  it('mantiene conectada toda la red', () => {
    for (const station of metroStations) {
      assert.notEqual(findMetroRoute('Balderas', station), null);
    }
  });

  it('prioriza transbordos sin añadir cambios innecesarios', () => {
    for (const destination of metroStations) {
      const fewTransfers = findMetroRoute('Observatorio', destination, 'transfers');
      const fastest = findMetroRoute('Observatorio', destination, 'fast');
      assert.ok(fewTransfers!.transfers <= fastest!.transfers);
    }
  });

  it('genera alternativas conectadas y sin ciclos', () => {
    const routes = findMetroRoutes('Pantitlán', 'Villa de Cortés');
    assert.ok(routes.length > 1);
    assert.ok(routes.length <= 3);
    for (const route of routes) {
      assert.equal(route.path[0], 'Pantitlán');
      assert.equal(route.path.at(-1), 'Villa de Cortés');
      assert.equal(new Set(route.path).size, route.path.length);
    }
  });
});

describe('controlador compartido', () => {
  it('valida solicitudes incompletas', () => {
    assert.equal(
      planRoute({ transport: 'metro', from: '', to: '' }).error,
      'missing-station'
    );
  });

  it('calcula Metro y Metrobús desde la misma interfaz', () => {
    assert.notEqual(planRoute({
      transport: 'metro',
      from: 'Balderas',
      to: 'Coyoacán'
    }).routes.length, 0);

    assert.notEqual(planRoute({
      transport: 'metrobus',
      from: 'Indios Verdes',
      to: 'Reforma'
    }).routes.length, 0);
  });

  it('rechaza usar la misma estación como origen y destino', () => {
    for (const [transport, station] of [
      ['metro', 'Balderas'],
      ['metrobus', 'Reforma']
    ] as const) {
      assert.equal(planRoute({
        transport,
        from: station,
        to: station
      }).error, 'same-station');
    }
  });
});

describe('modelo de rutas de Metrobús', () => {
  it('incluye el recorrido actual de Línea 4 entre Hidalgo y Alameda Oriente', () => {
    const route = findMetrobusRoute('Hidalgo', 'Alameda Oriente');
    assert.notEqual(route, null);
    assert.equal(route!.transfers, 0);
    assert.equal(route!.stops, 12);
    assert.equal(route!.segments[0].line.id, '4');
    assert.equal(route!.segments[0].direction, 'Alameda Oriente');
  });

  it('mantiene conectada toda la red', () => {
    for (const station of metrobusStations) {
      assert.notEqual(findMetrobusRoute('Reforma', station), null);
    }
  });

  it('crea únicamente segmentos con estaciones adyacentes', () => {
    const route = findMetrobusRoute('Indios Verdes', 'Tacubaya');
    assert.notEqual(route, null);
    for (const segment of route!.segments) {
      for (let index = 1; index < segment.stations.length; index += 1) {
        const current = segment.line.stations.indexOf(segment.stations[index]);
        const previous = segment.line.stations.indexOf(segment.stations[index - 1]);
        assert.equal(Math.abs(current - previous), 1);
      }
    }
  });
});
