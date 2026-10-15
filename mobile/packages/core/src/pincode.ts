/** Keeps only digits, at most 6, as the pincode field is typed. */
export function cleanPincode(input: string): string {
  return input.replace(/\D/g, '').slice(0, 6);
}

/** The website only checks a pincode once it has 6 digits. */
export function isCompletePincode(pincode: string): boolean {
  return /^\d{6}$/.test(pincode);
}
