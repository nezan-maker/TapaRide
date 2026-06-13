import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { createHmac } from 'crypto';
import { verifySignature } from '../../src/lib/crypto.js';
import { timingSafeEqual } from 'crypto';

describe('Timing safe comparison functions', () => {
  it('should verify that timingSafeEqual works correctly', () => {
    const buf1 = Buffer.from('test1234');
    const buf2 = Buffer.from('test1234');
    const buf3 = Buffer.from('test5678'); // Same length as buf1
    
    // Should return true for identical buffers
    assert.equal(timingSafeEqual(buf1, buf2), true);
    
    // Should return false for different buffers of same length
    assert.equal(timingSafeEqual(buf1, buf3), false);
  });

  it('should verify correct signatures using our function', () => {
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
    // Create a signature with a different secret to ensure it's different
    const wrongSignature = createHmac('sha256', 'wrong secret').update(data).digest('hex');
    
    const result = verifySignature(data, wrongSignature, secret);
    assert.equal(result, false);
  });
});
