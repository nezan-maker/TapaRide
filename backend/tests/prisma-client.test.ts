import assert from 'node:assert/strict';
import test from 'node:test';

import { isNeonDatabaseUrl } from '../src/lib/prisma-client.js';
test('isNeonDatabaseUrl detects Neon hosts', () => {
  assert.equal(
    isNeonDatabaseUrl('postgresql://user:pass@ep-test.neon.tech/neondb?sslmode=require'),
    true,
  );
});

test('isNeonDatabaseUrl treats local postgres as non-Neon', () => {
  assert.equal(
    isNeonDatabaseUrl('postgresql://nezn@localhost:5432/tapa_ride'),
    false,
  );
});
