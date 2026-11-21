// Name, mobile, address and pincode, for buying a device or booking a repair. Starts from the account's name and phone.
// Each field says what is wrong under it (the @fonzkart/core checks); `tried` shows every message at once after the
// customer pressed the button with something still wrong.
import { useEffect, useState } from 'react';
import { useProfile, useSession } from '@fonzkart/api';
import { addressProblem, cleanPhone, cleanPincode, nameProblem, phoneProblem, pincodeProblem } from '@fonzkart/core';
import { TextField } from '../design';

export function useDeliveryForm() {
  const { session } = useSession();
  const profile = useProfile(session.status === 'signedIn');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [tried, setTried] = useState(false);

  // The account's name and phone (stored as +91XXXXXXXXXX) as defaults.
  useEffect(() => {
    if (!profile.data) return;
    setName(current => current || profile.data.name);
    const stored = profile.data.phone?.replace(/\D/g, '').slice(-10);
    if (stored) setPhone(current => current || stored);
  }, [profile.data]);

  const errors = {
    name: nameProblem(name),
    phone: phoneProblem(phone),
    address: addressProblem(address, { what: 'your address' }),
    pincode: pincodeProblem(pincode),
  };
  const problem = errors.name ?? errors.phone ?? errors.address ?? errors.pincode ?? '';

  return {
    name, setName, phone, setPhone, address, setAddress, pincode, setPincode, problem, errors, tried,
    /** Call when the button is pressed: true when the form is ready, else every field shows its message. */
    check: () => {
      setTried(true);
      return !problem;
    },
    values: { name: name.trim(), phone, address: address.trim(), pincode },
  };
}

export function DeliveryFields({ form, phoneHint }: { form: ReturnType<typeof useDeliveryForm>; phoneHint: string }) {
  return (
    <>
      <TextField label="Full name" value={form.name} onChangeText={form.setName} autoComplete="name" textContentType="name"
        error={form.errors.name} showError={form.tried} />
      <TextField label="Mobile number" value={form.phone} onChangeText={text => form.setPhone(cleanPhone(text))}
        keyboardType="phone-pad" prefix="+91" hint={phoneHint} placeholder="10-digit mobile number"
        error={form.errors.phone} showError={form.tried} />
      <TextField label="House / flat, street, area" value={form.address} onChangeText={form.setAddress} multiline
        placeholder="e.g. 12, 2nd Cross, Indiranagar, Bengaluru" error={form.errors.address} showError={form.tried} />
      <TextField label="Pincode" value={form.pincode} onChangeText={text => form.setPincode(cleanPincode(text))}
        keyboardType="number-pad" maxLength={6} placeholder="6-digit pincode" error={form.errors.pincode} showError={form.tried} />
    </>
  );
}
