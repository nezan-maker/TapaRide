const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates that a string is a valid UUID format.
 * Use this before interpolating any value into raw SQL.
 */
export function assertUuid(value: string, label: string): asserts value is string {
  if (!UUID_REGEX.test(value)) {
    throw new Error(`Invalid UUID format for ${label}: ${value}`);
  }
}
