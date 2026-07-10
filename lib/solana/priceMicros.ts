export const PRICE_MICROS_ONE = 1_000_000;

export function priceToMicros(price: number): number {
  return Math.round(price * PRICE_MICROS_ONE);
}

export function microsToPrice(micros: number): number {
  return micros / PRICE_MICROS_ONE;
}

export function microsToCents(micros: number): string {
  return `${Math.round((micros / PRICE_MICROS_ONE) * 100)}¢`;
}

export function signedMicrosToCents(micros: number): string {
  const sign = micros > 0 ? "+" : "";
  return `${sign}${microsToCents(micros)}`;
}
