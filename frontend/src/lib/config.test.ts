import { describe, expect, it } from 'vitest';
import { parseStationLocationToLngLat } from './station-location';
import { API_BASE } from './config';

describe('parseStationLocationToLngLat', () => {
  it('parses canonical lat,lng values into MapLibre order', () => {
    expect(parseStationLocationToLngLat('-1.95,30.06')).toEqual([30.06, -1.95]);
  });

  it('resolves legacy city labels', () => {
    expect(parseStationLocationToLngLat('Huye Station')).toEqual([29.74, -2.6]);
  });

  it('returns null for unknown labels', () => {
    expect(parseStationLocationToLngLat('Somewhere else')).toBeNull();
  });
});

describe('API_BASE', () => {
  it('defaults to the backend dev port', () => {
    expect(API_BASE).toBe('http://localhost:3000');
  });
});
