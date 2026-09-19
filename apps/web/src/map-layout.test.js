import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { metroStations } from '@meperdienelmetro/core';
import { stationPositions } from './map-layout.js';

describe('mapa web del Metro', () => {
  it('tiene una posición fija para cada estación', () => {
    for (const station of metroStations) {
      assert.equal(stationPositions[station].length, 2);
      assert.equal(stationPositions[station].every(Number.isFinite), true);
    }
    assert.deepEqual(stationPositions.Pantitlán, [1023, 906]);
  });
});
