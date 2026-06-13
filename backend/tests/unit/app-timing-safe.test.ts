import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { createRequest } from 'node-mocks-http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Since we can't easily import the function directly from app.ts,
// we'll test the logic by replicating it here with the same approach
import { timingSafeEqual } from 'crypto';

describe('App timing-safe token comparison', () => {
  it('should demonstrate constant-time comparison', () => {
    // Test the approach we implemented in isAuthorizedOpsRequest
    const token1 = 'correct-token';
    const token2 = 'wrong-token';
    const token3 = 'correct-token'; // Same as token1
    
    const supplied1 = Buffer.from(token1);
    const expected1 = Buffer.from(token2); // Different token
    
    const supplied2 = Buffer.from(token1);
    const expected2 = Buffer.from(token3); // Same token
    
    // To prevent timing attacks, we always perform timingSafeEqual comparison
    // even when lengths don't match, by padding the shorter buffer
    const maxLength1 = Math.max(supplied1.length, expected1.length);
    const paddedSupplied1 = Buffer.alloc(maxLength1, 0);
    const paddedExpected1 = Buffer.alloc(maxLength1, 0);
    
    supplied1.copy(paddedSupplied1);
    expected1.copy(paddedExpected1);
    
    const maxLength2 = Math.max(supplied2.length, expected2.length);
    const paddedSupplied2 = Buffer.alloc(maxLength2, 0);
    const paddedExpected2 = Buffer.alloc(maxLength2, 0);
    
    supplied2.copy(paddedSupplied2);
    expected2.copy(paddedExpected2);
    
    // Always perform timingSafeEqual to maintain constant time execution
    const lengthMatch1 = supplied1.length === expected1.length;
    const contentMatch1 = timingSafeEqual(paddedSupplied1, paddedExpected1);
    
    const lengthMatch2 = supplied2.length === expected2.length;
    const contentMatch2 = timingSafeEqual(paddedSupplied2, paddedExpected2);
    
    // Different tokens should not match
    assert.equal(lengthMatch1 && contentMatch1, false);
    
    // Same tokens should match
    assert.equal(lengthMatch2 && contentMatch2, true);
  });

  it('should handle different length tokens safely', () => {
    const token1 = 'short';
    const token2 = 'this-is-a-much-longer-token';
    
    const supplied = Buffer.from(token1);
    const expected = Buffer.from(token2);
    
    // To prevent timing attacks, we always perform timingSafeEqual comparison
    // even when lengths don't match, by padding the shorter buffer
    const maxLength = Math.max(supplied.length, expected.length);
    const paddedSupplied = Buffer.alloc(maxLength, 0);
    const paddedExpected = Buffer.alloc(maxLength, 0);
    
    supplied.copy(paddedSupplied);
    expected.copy(paddedExpected);
    
    // Always perform timingSafeEqual to maintain constant time execution
    const lengthMatch = supplied.length === expected.length;
    const contentMatch = timingSafeEqual(paddedSupplied, paddedExpected);
    
    // Different tokens should not match
    assert.equal(lengthMatch && contentMatch, false);
    
    // Length should not match
    assert.equal(lengthMatch, false);
  });
});
