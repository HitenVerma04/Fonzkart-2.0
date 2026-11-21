// Copy of mobile/packages/core/src/validate.ts (tested there: validate.test.ts); keep the two the same.
// Form checks shared by the three apps. Each returns null when the value is fine, or one short sentence saying what is
// wrong and how to fix it, shown under the field. The clean* helpers keep a field to what it can hold while typing
// (digits only, the right length), so most mistakes cannot be typed in the first place.

/** Digits only; a pasted "+91 98765 43210" or "098765 43210" becomes the 10-digit number. At most 10 digits. */
export function cleanPhone(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/** An Indian mobile number (10 digits starting 6–9), typed without +91. */
export function phoneProblem(digits: string, { required = true }: { required?: boolean } = {}): string | null {
  const d = digits.trim();
  if (!d) return required ? 'Enter your 10-digit mobile number.' : null;
  if (/\D/.test(d)) return 'Use digits only.';
  if (d.length < 10) return `That is ${d.length} digit${d.length === 1 ? '' : 's'}; a mobile number has 10.`;
  if (d.length > 10) return 'A mobile number has 10 digits (leave out +91).';
  if (!/^[6-9]/.test(d)) return 'Indian mobile numbers start with 6, 7, 8 or 9.';
  if (/^(\d)\1{9}$/.test(d)) return 'Enter a real mobile number.';
  return null;
}

/** An email address. */
export function emailProblem(email: string, { required = true }: { required?: boolean } = {}): string | null {
  const e = email.trim();
  if (!e) return required ? 'Enter your email address.' : null;
  if (/\s/.test(e)) return 'An email address has no spaces.';
  if (!e.includes('@')) return 'An email address needs an @, like name@example.com.';
  if (!/^[^@]+@[^@]+\.[a-z]{2,}$/i.test(e)) return 'Check the email address, like name@example.com.';
  return null;
}

/** Email or 10-digit mobile number (sign-in). */
export function emailOrPhoneProblem(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Enter your email or mobile number.';
  if (v.includes('@')) return emailProblem(v);
  if (/^[+\d\s-]+$/.test(v)) return phoneProblem(cleanPhone(v));
  return 'Enter an email address or a 10-digit mobile number.';
}

/** An Indian pincode: 6 digits, not starting with 0. */
export function pincodeProblem(pincode: string, { required = true }: { required?: boolean } = {}): string | null {
  const p = pincode.trim();
  if (!p) return required ? 'Enter the 6-digit pincode.' : null;
  if (/\D/.test(p)) return 'A pincode has digits only.';
  if (p.length !== 6) return `A pincode has 6 digits; this has ${p.length}.`;
  if (p.startsWith('0')) return 'Indian pincodes do not start with 0.';
  return null;
}

/** A person's or business name: at least 2 letters. */
export function nameProblem(name: string, { what = 'your name' }: { what?: string } = {}): string | null {
  const n = name.trim();
  if (!n) return `Enter ${what}.`;
  if ((n.match(/\p{L}/gu) ?? []).length < 2) return `Enter ${what} with at least 2 letters.`;
  if (/[<>{}\[\]\\]/.test(n) || /\d{4,}/.test(n)) return `Check ${what}: it looks like a number or code.`;
  return null;
}

/** A password of at least `min` characters. */
export function passwordProblem(password: string, min = 6): string | null {
  if (!password) return 'Enter a password.';
  if (password.length < min) return `Use at least ${min} characters (${password.length} so far).`;
  return null;
}

/** An address the executive can find: house/street and area, at least 10 characters. */
export function addressProblem(address: string, { what = 'the pickup address' }: { what?: string } = {}): string | null {
  const a = address.trim();
  if (!a) return `Enter ${what}.`;
  if (a.length < 10) return 'Add the house number, street and area so we can find you.';
  return null;
}

/** Digits only, at most 15 (IMEI). */
export function cleanImei(input: string): string {
  return input.replace(/\D/g, '').slice(0, 15);
}

/** A phone's IMEI: 15 digits with a valid check digit (Luhn). */
export function imeiProblem(imei: string, { required = true }: { required?: boolean } = {}): string | null {
  const d = imei.trim();
  if (!d) return required ? 'Enter the 15-digit IMEI (dial *#06#).' : null;
  if (/\D/.test(d)) return 'An IMEI has digits only.';
  if (d.length !== 15) return `An IMEI has 15 digits; this has ${d.length}.`;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let n = Number(d[i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0 ? null : 'This IMEI is not valid; check each digit (dial *#06#).';
}

/** A UPI id like name@bank. */
export function upiProblem(upi: string): string | null {
  const u = upi.trim();
  if (!u) return 'Enter your UPI ID, like name@okbank.';
  if (!/^[a-z0-9._-]{2,256}@[a-z][a-z0-9.-]{1,63}$/i.test(u)) return 'Check the UPI ID, like name@okbank.';
  return null;
}

/** A whole number of devices within limits (bulk orders). */
export function quantityProblem(value: string, { min = 1, max = 100000 }: { min?: number; max?: number } = {}): string | null {
  const v = value.trim();
  if (!v) return 'Enter how many devices.';
  if (!/^\d+$/.test(v)) return 'Use a whole number.';
  const n = Number(v);
  if (n < min) return `Enter at least ${min}.`;
  if (n > max) return `Enter at most ${max}.`;
  return null;
}

/** A bank IFSC: 4 letters, 0, then 6 letters or digits (SBIN0001234). */
export function ifscProblem(ifsc: string): string | null {
  const v = ifsc.trim().toUpperCase();
  if (!v) return 'Enter the IFSC code.';
  if (v.length !== 11) return `An IFSC has 11 characters, like SBIN0001234; this has ${v.length}.`;
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v)) return 'Check the IFSC: 4 letters, then 0, then 6 letters or digits (SBIN0001234).';
  return null;
}

/** A bank account number: 9 to 18 digits. */
export function bankAccountProblem(account: string): string | null {
  const v = account.trim();
  if (!v) return 'Enter the account number.';
  if (/\D/.test(v)) return 'An account number has digits only.';
  if (v.length < 9 || v.length > 18) return 'An account number has 9 to 18 digits.';
  return null;
}
