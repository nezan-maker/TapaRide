// src/lib/parcel-pricing.ts
//
// Pure parcel-fee computation. No I/O, no DB, no side effects — just the
// formula. Both the backend (createParcel) and the frontend quote screen
// import this same function so the user always sees the same number.
//
// Formula:
//   basePrice      = floor(Journey.price × BASE_RATE)
//   bandFactor(w)  = weight-band multiplier (see WEIGHT_BANDS)
//   fee            = floor(basePrice × bandFactor)
//
// BASE_RATE = 0.40 means the parcel starts at 40% of the ticket price for
// that journey. Rwandan courier practice (Yego, Tap&Go, Ritco) prices
// bus-attached parcels as a fraction of the passenger fare, scaled by
// weight band — because the marginal cost of a parcel on a bus that's
// already running is low, and the bus operator's revenue is the ticket.
//
// The weight bands reflect how courier economics work: the first kilogram
// is the most expensive (handling, documentation), and each additional
// kilogram adds less marginal cost. The 4× cap at 10+ kg prevents a single
// heavy parcel from being unaffordable.

/**
 * Fraction of the journey ticket price that forms the parcel base fee.
 * Tuned for the Rwandan bus-courier market. Exposed as a constant so
 * tests can pin it and the frontend quote screen can show the math.
 */
export const BASE_RATE = 0.40;

/**
 * Hard weight cap in kg. Above this we reject the parcel outright
 * (courier economics break down — the sender should book a dedicated
 * freight service instead).
 */
export const MAX_WEIGHT_KG = 50;

interface WeightBand {
  /** Exclusive upper bound in kg. Use Infinity for the top band. */
  readonly upToKg: number;
  readonly factor: number;
  /** Human-readable label for the UI, e.g. "1–3 kg". */
  readonly label: string;
}

/**
 * Weight bands, ordered from lightest to heaviest. The first band starts
 * at 0 (any weight > 0 and < 1 kg falls into it).
 */
export const WEIGHT_BANDS: readonly WeightBand[] = [
  { upToKg: 1.0, factor: 1.0, label: '< 1 kg' },
  { upToKg: 3.0, factor: 1.5, label: '1–3 kg' },
  { upToKg: 10.0, factor: 2.5, label: '3–10 kg' },
  { upToKg: Infinity, factor: 4.0, label: '10+ kg' },
];

/**
 * Look up the weight band for a given weight in kg. Returns the band
 * whose `upToKg` is the first strictly greater than `weightKg`.
 */
export function getWeightBand(weightKg: number): WeightBand {
  if (weightKg <= 0) {
    throw new RangeError('weightKg must be positive');
  }
  if (weightKg > MAX_WEIGHT_KG) {
    throw new RangeError(
      `weightKg ${weightKg} exceeds the ${MAX_WEIGHT_KG} kg limit`,
    );
  }
  const band = WEIGHT_BANDS.find((b) => weightKg < b.upToKg);
  // The Infinity-terminated top band always matches as a fallback.
  return band ?? WEIGHT_BANDS[WEIGHT_BANDS.length - 1];
}

export interface ParcelPricingInput {
  /** Ticket price for the journey, in whole RWF. Must be > 0. */
  journeyPrice: number;
  /** Parcel weight in kg. Must be > 0 and ≤ MAX_WEIGHT_KG. */
  weightKg: number;
}

export interface ParcelPricingResult {
  /** Final fee in whole RWF. Always ≥ 0. */
  fee: number;
  /** Journey.price × BASE_RATE, floored. Shown in the UI breakdown. */
  basePrice: number;
  /** The weight band that was applied. */
  band: WeightBand;
  /** band.factor, extracted for convenience. */
  weightMultiplier: number;
  /** The rate used (BASE_RATE), so the UI can show "40% of ticket". */
  baseRate: number;
  /** Strategy tag stored on the Parcel row for audit / tuning later. */
  strategy: 'JOURNEY_X_BAND';
}

/**
 * Compute the parcel fee for a given journey price and weight.
 *
 * Throws RangeError for invalid inputs (non-positive price, non-positive
 * or excessive weight). The caller is expected to catch and surface a
 * ValidationError to the user.
 */
export function computeParcelFee(input: ParcelPricingInput): ParcelPricingResult {
  if (!Number.isFinite(input.journeyPrice) || input.journeyPrice <= 0) {
    throw new RangeError('journeyPrice must be a positive number');
  }
  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) {
    throw new RangeError('weightKg must be a positive number');
  }

  const band = getWeightBand(input.weightKg);
  const basePrice = Math.floor(input.journeyPrice * BASE_RATE);
  const fee = Math.floor(basePrice * band.factor);

  return {
    fee,
    basePrice,
    band,
    weightMultiplier: band.factor,
    baseRate: BASE_RATE,
    strategy: 'JOURNEY_X_BAND',
  };
}

/**
 * Format a whole-RWF integer as a human-readable string like
 * "5,400 RWF". Uses the Rwandan locale convention (comma thousands,
 * no decimals — RWF has no fractional units in practice).
 */
export function formatRwf(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError('amount must be a non-negative finite number');
  }
  return `${Math.round(amount).toLocaleString('en-RW')} RWF`;
}
