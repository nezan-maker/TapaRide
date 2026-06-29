import assert from 'node:assert/strict';
import test from 'node:test';

import { registerSchema } from '../src/modules/auth/auth.schema.js';

test('registerSchema requires a valid phone number', () => {
  const result = registerSchema.safeParse({
    email: 'user@example.com',
    password: 'Password123!',
    role: 'CLIENT',
  });
  assert.equal(result.success, false, 'should fail without phone');
  if (!result.success) {
    const phoneIssue = result.error.issues.find((i) => i.path[0] === 'phone');
    assert.ok(phoneIssue, 'error should mention phone');
  }
});

test('registerSchema accepts a valid E.164 phone number', () => {
  const result = registerSchema.safeParse({
    email: 'user@example.com',
    password: 'Password123!',
    phone: '+250790000001',
    role: 'CLIENT',
  });
  assert.equal(result.success, true);
});

test('registerSchema rejects an invalid phone number', () => {
  const result = registerSchema.safeParse({
    email: 'user@example.com',
    password: 'Password123!',
    phone: '123',
    role: 'CLIENT',
  });
  assert.equal(result.success, false);
});
