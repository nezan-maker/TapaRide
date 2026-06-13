/**
 * Maps backend error codes and technical messages to user-friendly messages
 * that non-programmer users can understand.
 */

const errorCodeMap: Record<string, string> = {
  AUTHENTICATION_ERROR: 'Your email or password is incorrect. Please double-check and try again.',
  VALIDATION_ERROR: 'Some information you entered is not quite right. Please review your details and try again.',
  NOT_FOUND: 'We couldn\'t find what you\'re looking for. It may have been removed or the link may be incorrect.',
  NOT_FOUND_ERROR: 'We couldn\'t find what you\'re looking for. It may have been removed or the link may be incorrect.',
  CONFLICT_ERROR: 'This already exists in our system. Please use a different value.',
  AUTHORIZATION_ERROR: 'You don\'t have permission to do that. Please sign in with the correct account.',
  RATE_LIMIT_ERROR: 'Too many attempts. Please wait a moment before trying again.',
  EXTERNAL_PROVIDER_ERROR: 'A service we use is temporarily unavailable. Please try again in a few minutes.',
  INTERNAL_SERVER_ERROR: 'Something went wrong on our end. We\'ve been notified and are working on it. Please try again.',
  PAYMENT_FAILED: 'Your payment could not be processed. Please check your card details or try a different payment method.',
  PAYMENT_REQUIRED: 'Payment is required to complete this action. Please add funds to your wallet.',
  WALLET_LOCKED: 'Your wallet is locked. Please enter your wallet password to continue.',
  INSUFFICIENT_FUNDS: 'You don\'t have enough funds in your wallet. Please top up and try again.',
  EMAIL_NOT_VERIFIED: 'Please verify your email address first. Check your inbox for a verification link.',
  PHONE_NOT_VERIFIED: 'Please verify your phone number first. We sent you a code via SMS.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again to continue.',
  SEAT_ALREADY_BOOKED: 'Sorry, this seat has just been booked by someone else. Please select a different seat.',
  JOURNEY_NOT_FOUND: 'This trip is no longer available. It may have been cancelled or departed.',
  BOARDING_INVALID: 'This boarding code is not valid. Please check the code and try again.',
};

const technicalPatterns: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /Unique constraint failed/i, replacement: 'This already exists in our system.' },
  { pattern: /Foreign key constraint/i, replacement: 'Related information is missing or invalid.' },
  { pattern: /is required/i, replacement: 'Please fill in all required fields.' },
  { pattern: /must be a.*email/i, replacement: 'Please enter a valid email address.' },
  { pattern: /must contain at least \d+ character/i, replacement: 'This field is too short. Please use more characters.' },
  { pattern: /must contain at least one uppercase/i, replacement: 'Please include at least one capital letter.' },
  { pattern: /must contain at least one number/i, replacement: 'Please include at least one number.' },
  { pattern: /Invalid phone/i, replacement: 'Please enter a valid phone number starting with + and country code.' },
  { pattern: /Invalid uuid/i, replacement: 'Invalid ID format. Please refresh and try again.' },
  { pattern: /NetworkError|Failed to fetch|Network request failed/i, replacement: 'Unable to connect. Please check your internet connection and try again.' },
  { pattern: /timeout|timed out/i, replacement: 'The request took too long. Please check your connection and try again.' },
  { pattern: /JWT|jwt|token.*invalid|token.*expired/i, replacement: 'Your session has expired. Please log in again to continue.' },
  { pattern: /password.*incorrect|wrong password/i, replacement: 'Your current password is incorrect.' },
  { pattern: /Passkey|WebAuthn/i, replacement: 'There was a problem with your security key or passkey. Please try again.' },
  { pattern: /RURA/i, replacement: 'The RURA verification code could not be validated.' },
];

export function friendlyError(message: string, code?: string): string {
  // 1. If we have a known error code, use its mapping
  if (code && errorCodeMap[code]) {
    return errorCodeMap[code];
  }

  // 2. Try to match technical patterns
  for (const { pattern, replacement } of technicalPatterns) {
    if (pattern.test(message)) {
      return replacement;
    }
  }

  // 3. If the message looks like an internal/technical error, give generic message
  if (
    message.includes('Internal Server Error') ||
    message.includes('INTERNAL_SERVER_ERROR') ||
    message.includes('Cannot read properties') ||
    message.includes('undefined is not') ||
    message.includes('prisma') ||
    message.toLowerCase().includes('error:')
  ) {
    return 'Something went wrong on our end. Please try again. If the problem persists, contact support.';
  }

  // 4. Return the original message if it's already user-friendly
  return message;
}

export const PAYMENT_ERRORS = {
  cardDeclined: 'Your card was declined. Please try a different card or payment method.',
  insufficientFunds: 'Your card doesn\'t have enough funds. Please try a different card.',
  expiredCard: 'Your card has expired. Please use a different card.',
  incorrectCvc: 'The security code (CVC) is incorrect. Please check and try again.',
  processingError: 'There was an error processing your payment. Please try again.',
  requires3ds: 'Your bank requires extra verification. Please complete the authentication prompt.',
};
