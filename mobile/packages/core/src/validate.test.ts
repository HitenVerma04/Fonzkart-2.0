import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addressProblem, bankAccountProblem, cleanImei, cleanPhone, emailOrPhoneProblem, emailProblem, ifscProblem, imeiProblem,
  nameProblem, passwordProblem, phoneProblem, pincodeProblem, quantityProblem, upiProblem,
} from './validate';

test('mobile numbers: pasted forms are cleaned, and every mistake has its own message', () => {
  assert.equal(cleanPhone('+91 98765 43210'), '9876543210');
  assert.equal(cleanPhone('098765-43210'), '9876543210');
  assert.equal(cleanPhone('98765abc43210999'), '9876543210');
  assert.equal(phoneProblem('9876543210'), null);
  assert.equal(phoneProblem(''), 'Enter your 10-digit mobile number.');
  assert.equal(phoneProblem('', { required: false }), null);
  assert.equal(phoneProblem('98765'), 'That is 5 digits; a mobile number has 10.');
  assert.equal(phoneProblem('5876543210'), 'Indian mobile numbers start with 6, 7, 8 or 9.');
  assert.equal(phoneProblem('9999999999'), 'Enter a real mobile number.');
});

test('emails, sign-in ids and names', () => {
  assert.equal(emailProblem('a@b.in'), null);
  assert.match(emailProblem('ab.in')!, /needs an @/);
  assert.match(emailProblem('a b@c.in')!, /no spaces/);
  assert.match(emailProblem('a@b')!, /Check the email/);
  assert.equal(emailOrPhoneProblem('a@b.in'), null);
  assert.equal(emailOrPhoneProblem('+91 98765 43210'), null);
  assert.match(emailOrPhoneProblem('12345')!, /10/);
  assert.match(emailOrPhoneProblem('hello')!, /email address or a 10-digit/);
  assert.equal(nameProblem('Ravi K'), null);
  assert.equal(nameProblem(''), 'Enter your name.');
  assert.match(nameProblem('9876543210')!, /at least 2 letters/);
  assert.equal(passwordProblem('abc'), 'Use at least 6 characters (3 so far).');
});

test('pincodes, addresses, IMEI, UPI, bank details and quantities', () => {
  assert.equal(pincodeProblem('600001'), null);
  assert.equal(pincodeProblem('60001'), 'A pincode has 6 digits; this has 5.');
  assert.equal(pincodeProblem('012345'), 'Indian pincodes do not start with 0.');
  assert.equal(addressProblem('12 Main Road, Adyar'), null);
  assert.match(addressProblem('12 Main')!, /house number/);
  assert.equal(cleanImei('35-209900-176148-1 x'), '352099001761481');
  assert.equal(imeiProblem('352099001761481'), null);
  assert.match(imeiProblem('352099001761482')!, /not valid/);
  assert.equal(upiProblem('ravi.k@okaxis'), null);
  assert.match(upiProblem('ravi')!, /Check the UPI ID/);
  assert.equal(ifscProblem('sbin0001234'), null);
  assert.match(ifscProblem('SBIN1001234')!, /4 letters, then 0/);
  assert.equal(bankAccountProblem('123456789012'), null);
  assert.match(bankAccountProblem('1234')!, /9 to 18/);
  assert.equal(quantityProblem('25'), null);
  assert.equal(quantityProblem('0'), 'Enter at least 1.');
  assert.equal(quantityProblem('2.5'), 'Use a whole number.');
});
