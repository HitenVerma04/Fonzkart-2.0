// Name, mobile, address and pincode, for buying a device or booking a repair. Starts from the account's name and phone.
import { useEffect, useState } from 'react';
import { useProfile, useSession } from '@fonzkart/api';
import { cleanPincode, isCompletePincode } from '@fonzkart/core';
import { TextField } from '../design';

export function useDeliveryForm() {
  const { session } = useSession();
  const profile = useProfile(session.status === 'signedIn');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');

  // The account's name and phone (stored as +91XXXXXXXXXX) as defaults.
  useEffect(() => {
    if (!profile.data) return;
    setName(current => current || profile.data.name);
    const stored = profile.data.phone?.replace(/\D/g, '').slice(-10);
    if (stored) setPhone(current => current || stored);
  }, [profile.data]);

  const problem = !name.trim() ? 'Enter your name.'
    : phone.length !== 10 ? 'Enter your 10-digit mobile number.'
    : address.trim().length < 10 ? 'Enter your full address.'
    : !isCompletePincode(pincode) ? 'Enter your 6-digit pincode.'
    : '';

  return {
    name, setName, phone, setPhone, address, setAddress, pincode, setPincode, problem,
    values: { name: name.trim(), phone, address: address.trim(), pincode },
  };
}

export function DeliveryFields({ form, phoneHint }: { form: ReturnType<typeof useDeliveryForm>; phoneHint: string }) {
  return (
    <>
      <TextField label="Full name" value={form.name} onChangeText={form.setName} autoComplete="name" textContentType="name" />
      <TextField label="Mobile number" value={form.phone} onChangeText={text => form.setPhone(text.replace(/\D/g, '').slice(0, 10))}
        keyboardType="phone-pad" prefix="+91" hint={phoneHint} />
      <TextField label="House / flat, street, area" value={form.address} onChangeText={form.setAddress} multiline
        placeholder="e.g. 12, 2nd Cross, Indiranagar, Bengaluru" />
      <TextField label="Pincode" value={form.pincode} onChangeText={text => form.setPincode(cleanPincode(text))}
        keyboardType="number-pad" maxLength={6} />
    </>
  );
}
