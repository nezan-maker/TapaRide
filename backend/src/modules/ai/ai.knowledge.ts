/**
 * Ground-truth support knowledge for the Phase 1 copilot.
 * Keep in sync with Support.tsx FAQs and real product flows.
 */
export const SUPPORT_KNOWLEDGE = `
# TapaRide Help Center

TapaRide is a Rwanda-focused transport platform for intercity bus tickets, parcel sending, and Tapa Wallet payments.

## Bookings & Trips
- Search routes from the home page or /search with from, to, and date.
- After choosing a journey, pick seats on the seat map, then pay with Tapa Wallet or card top-up.
- View booked trips under Dashboard → My Trips (/dashboard/trips).
- To change or cancel: open My Trips, select the trip, then Change or Cancel. Refunds follow the cancellation policy based on how far ahead you cancel.

## Parcels & Delivery
- Send a parcel at /send-parcel (login required, CLIENT role).
- Fee is computed from the journey ticket price and weight band — not a flat per-kg rate.
- Sender pays from Tapa Wallet. After payment, the receiver gets an SMS with a claim code.
- Track a parcel at /track with the tracking code, or see sent parcels at Dashboard → My Parcels.
- Receivers confirm pickup at /receive (or /parcels/receive) using the claim code and their phone number. No Tapa account required.

## Payments & Wallet
- Tapa Wallet lives at Dashboard → Payments (/dashboard/payments).
- Set up a wallet password, unlock, then top up via Stripe (card) or use existing balance.
- Wallet pays for tickets and parcel sends. Top-ups credit the wallet; spends debit it.
- Supported payment rails: MTN/Airtel Mobile Money (via wallet top-up flow), Visa, Mastercard through Stripe.

## Account & Security
- Sign up at /signup, verify email/phone via OTP.
- Passkeys supported for passwordless login.
- Wallet password is separate from login password and is required to authorize payments.

## Support channels
- Phone: +250 788 000 000 (Mon–Sun, 6am–10pm)
- Email: support@taparide.rw (replies within 24h)

## Important limitations (do not invent features)
- You cannot book or pay on behalf of the user in this chat — direct them to the app screens.
- You cannot see private account data unless the user is logged in and you are told their status in context.
- Agency payouts via Stripe Connect are not live yet; wallet is the payment rail for parcels and tickets.
`.trim();

export const SUPPORT_SUGGESTIONS = [
  'How do I track my parcel?',
  'How does Tapa Wallet top-up work?',
  'How do I cancel a booking?',
  'How does the parcel claim code work?',
] as const;
