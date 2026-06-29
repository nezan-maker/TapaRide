import assert from 'node:assert/strict';
import test from 'node:test';

import { parseStationLocation, formatStationLocation } from '../src/lib/station-location.js';

test('parseStationLocation accepts lat,lng pairs', () => {
  assert.deepEqual(parseStationLocation('-1.95,30.06'), [-1.95, 30.06]);
});

test('parseStationLocation resolves Rwanda city labels', () => {
  assert.deepEqual(parseStationLocation('Kigali Central Bus Park'), [-1.95, 30.06]);
  assert.deepEqual(parseStationLocation('Musanze Station'), [-1.5, 29.63]);
});

test('parseStationLocation returns null for unknown labels', () => {
  assert.equal(parseStationLocation('Unknown place'), null);
});

test('formatStationLocation serializes coordinates', () => {
  assert.equal(formatStationLocation(-1.95, 30.06), '-1.95,30.06');
});
