import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  availableSlots, bookingAnswers, bookingProblems, expressAvailable, pickupDays, type BookingDetails,
} from './booking';
import { trackerSteps, statusLabel } from './orderStatus';

const at = (hour: number, minute = 0) => new Date(2026, 9, 15, hour, minute);

test('pickup days start tomorrow after 4 PM, like the website', () => {
  assert.equal(pickupDays(at(15, 59))[0]!.isToday, true);
  const late = pickupDays(at(16));
  assert.equal(late[0]!.isToday, false);
  assert.equal(late[0]!.date, 16);
  assert.equal(late.length, 4);
  assert.deepEqual(late.map(d => d.weekday), ['Fri', 'Sat', 'Sun', 'Mon']);
});

test('today\'s slots close at 11 AM and 4 PM; express runs 10 AM to 4 PM', () => {
  const today = pickupDays(at(9))[0]!;
  assert.deepEqual(availableSlots(today, at(9)), ['10:00 AM - 02:00 PM', '03:00 PM - 07:00 PM']);
  assert.deepEqual(availableSlots(today, at(11)), ['03:00 PM - 07:00 PM']);
  assert.deepEqual(availableSlots(pickupDays(at(15))[0]!, at(15, 30)), ['03:00 PM - 07:00 PM']);
  assert.deepEqual(availableSlots(pickupDays(at(9))[1]!, at(9)).length, 2);
  assert.equal(expressAvailable(at(9, 59)), false);
  assert.equal(expressAvailable(at(10)), true);
  assert.equal(expressAvailable(at(16)), false);
});

const base: BookingDetails = {
  phone: '98765 43210', address: '9 Beach Rd', pincode: '600001', location: null, detectedAddress: '',
  day: pickupDays(at(9))[1], slot: '10:00 AM - 02:00 PM', isExpress: false, paymentMethod: 'cash',
  upiId: '', bankAccount: '', bankIfsc: '', bankAccountName: '',
};

test('a booking needs a phone, an address or location, a pincode, a time and payment details', () => {
  assert.deepEqual(bookingProblems(base), []);
  assert.equal(bookingProblems({ ...base, phone: '12345' }).length, 1);
  assert.equal(bookingProblems({ ...base, address: ' ', location: { lat: 1, lng: 2 } }).length, 0);
  assert.equal(bookingProblems({ ...base, slot: '', isExpress: true }).length, 0);
  assert.equal(bookingProblems({ ...base, slot: '' }).length, 1);
  assert.equal(bookingProblems({ ...base, paymentMethod: 'upi' }).length, 1);
  assert.equal(bookingProblems({ ...base, paymentMethod: 'bank_transfer', bankAccount: '1', bankIfsc: 'x' }).length, 1);
});

test('the order answers carry the booking exactly as the website sends them', () => {
  const answers = bookingAnswers({ physical_condition: 'good' },
    { ...base, paymentMethod: 'bank_transfer', bankAccount: ' 123 ', bankIfsc: 'sbin0001', bankAccountName: 'A B' });
  assert.equal(answers.physical_condition, 'good');
  assert.equal(answers.phone, '9876543210');
  assert.equal(answers.scheduledSlot, '10:00 AM - 02:00 PM');
  assert.equal(answers.isExpress, false);
  assert.equal(answers.bankIfsc, 'SBIN0001');
  assert.equal(answers.upiId, undefined);
});

test('the shared order-status logic gives customers the website\'s tracker', () => {
  assert.equal(statusLabel('Pending Pickup', 'customer'), 'Order placed');
  const steps = trackerSteps({ status: 'assigned', price: 1500, riderId: 'r1', partnerId: 'p1', executive: { name: 'Ravi' } });
  assert.deepEqual(steps.map(s => s.state), ['done', 'done', 'done', 'current', 'upcoming', 'upcoming']);
  assert.equal(steps[2]!.detail, 'Ravi');
});

test('an order\'s device splits into model and variant like the website\'s lookup', async () => {
  const { splitDevice } = await import('./booking');
  assert.deepEqual(splitDevice('iPhone 13 (128GB)'), { model: 'iPhone 13', variant: '128GB' });
  assert.deepEqual(splitDevice('Galaxy S21 (8GB + 128GB)'), { model: 'Galaxy S21', variant: '8GB + 128GB' });
  assert.equal(splitDevice('Watch Series 8'), null);
});
