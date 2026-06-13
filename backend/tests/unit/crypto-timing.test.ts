import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { createHash, createHmac } from 'crypto';
import { verifySignature } from '../../src/lib/crypto.js';

describe('Crypto timing functions', () => {
  it('should verify correct signatures', () => {
    const data = 'test data';
    const secret = 'test secret';
    
    // Generate a valid signature
    const expected = createHmac('sha256', secret).update(data).digest('hex');
    
    // This should return true for a valid signature
    const result = verifySignature(data, expected, secret);
    assert.equal(result, true);
  });

  it('should reject incorrect signatures', () => {
    const data = 'test data';
    const secret = 'test secret';
    const wrongSecret = 'wrong secret';
    
    // Generate signature with wrong secret
    const expected = createHmac('sha256', wrongSecret).update(data).digest('hex');
    
    const result = verifySignature(data, expected, secret);
    assert.equal(result, false);
  });
});
