/** ₹ amount with Indian digit grouping (₹1,23,456), independent of the phone's Intl support. */
export function formatInr(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const digits = String(Math.abs(rounded));
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${sign}₹${rest ? rest + ',' + lastThree : lastThree}`;
}

/** A price or a price range: "₹7,000" or "₹7,000 – ₹10,000" (when max is above min). */
export function formatInrRange(min: number, max?: number | null): string {
  return max != null && max > min ? `${formatInr(min)} – ${formatInr(max)}` : formatInr(min);
}
