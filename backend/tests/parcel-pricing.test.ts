import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BASE_RATE,
  MAX_WEIGHT_KG,
  WEIGHT_BANDS,
  computeParcelFee,
  formatRwf,
  getWeightBand,
} from '../src/lib/parcel-pricing.js';

test('getWeightBand maps weights to the expected courier bands', () => {
  assert.equal(getWeightBand(0.5).label, '< 1 kg');
  assert.equal(getWeightBand(2).label, '1–3 kg');
  assert.equal(getWeightBand(5).label, '3–10 kg');
  assert.equal(getWeightBand(12).label, '10+ kg');
});

test('computeParcelFee applies journey price and weight band multiplier', () => {
  const result = computeParcelFee({ journeyPrice: 10_000, weightKg: 2 });

  assert.equal(result.basePrice, Math.floor(10_000 * BASE_RATE));
  assert.equal(result.fee, Math.floor(result.basePrice * 1.5));
  assert.equal(result.band.label, '1–3 kg');
  assert.equal(result.strategy, 'JOURNEY_X_BAND');
  assert.equal(result.baseRate, BASE_RATE);
});

test('computeParcelFee scales heavy parcels up to the top band factor', () => {
  const light = computeParcelFee({ journeyPrice: 8_000, weightKg: 0.8 });
  const heavy = computeParcelFee({ journeyPrice: 8_000, weightKg: 15 });

  assert.ok(heavy.fee > light.fee);
  assert.equal(heavy.weightMultiplier, WEIGHT_BANDS[WEIGHT_BANDS.length - 1].factor);
});

test('computeParcelFee rejects invalid inputs', () => {
  assert.throws(() => computeParcelFee({ journeyPrice: 0, weightKg: 1 }), RangeError);
  assert.throws(() => computeParcelFee({ journeyPrice: 5_000, weightKg: 0 }), RangeError);
  assert.throws(
    () => computeParcelFee({ journeyPrice: 5_000, weightKg: MAX_WEIGHT_KG + 1 }),
    RangeError,
  );
});

test('formatRwf renders whole-RWF amounts with locale grouping', () => {
  assert.match(formatRwf(5400), /5,?400 RWF/);
});
