'use client';

// Name, mobile, address and pincode for buying a device or booking a repair, each with its own message when wrong
// (lib/validate.ts, the same checks as the apps). useDeliveryForm holds the values; `check()` on the button shows every
// message and says whether the form is ready.
import { useState } from 'react';
import { addressProblem, cleanPhone, nameProblem, phoneProblem, pincodeProblem } from '@/lib/validate';
import { invalidBox, useFormChecks } from '@/lib/useFormChecks';
import { FieldError } from '@/components/ui/FieldError';

export type DeliveryValues = { name: string; phone: string; address: string; pincode: string };

export function useDeliveryForm(defaultName = '') {
    const [values, setValues] = useState<DeliveryValues>({ name: defaultName, phone: '', address: '', pincode: '' });
    const errors = {
        name: nameProblem(values.name),
        phone: phoneProblem(values.phone),
        address: addressProblem(values.address, { what: 'your full address' }),
        pincode: pincodeProblem(values.pincode),
    };
    const checks = useFormChecks(errors);
    return {
        values,
        setValues,
        checks,
        /** The first thing still wrong ('' when ready). */
        problem: errors.name ?? errors.phone ?? errors.address ?? errors.pincode ?? '',
        check: checks.ok,
    };
}

export function DeliveryFields({ form, field }: { form: ReturnType<typeof useDeliveryForm>; field: string }) {
    const { values, setValues, checks } = form;
    const cls = (key: keyof DeliveryValues) => `${field} ${checks.show(key) ? invalidBox : ''}`;
    return (
        <>
            <div>
                <input className={cls('name')} placeholder="Full name" autoComplete="name" value={values.name}
                    aria-invalid={!!checks.show('name')} onBlur={checks.leave('name')}
                    onChange={e => setValues(v => ({ ...v, name: e.target.value }))} />
                <FieldError message={checks.show('name')} />
            </div>
            <div>
                <input className={cls('phone')} placeholder="10-digit mobile number" inputMode="numeric" autoComplete="tel-national" value={values.phone}
                    aria-invalid={!!checks.show('phone')} onBlur={checks.leave('phone')}
                    onChange={e => setValues(v => ({ ...v, phone: cleanPhone(e.target.value) }))} />
                <FieldError message={checks.show('phone')} />
            </div>
            <div>
                <textarea className={cls('address')} placeholder="House / flat, street, area" rows={3} autoComplete="street-address" value={values.address}
                    aria-invalid={!!checks.show('address')} onBlur={checks.leave('address')}
                    onChange={e => setValues(v => ({ ...v, address: e.target.value }))} />
                <FieldError message={checks.show('address')} />
            </div>
            <div>
                <input className={cls('pincode')} placeholder="6-digit pincode" inputMode="numeric" maxLength={6} autoComplete="postal-code" value={values.pincode}
                    aria-invalid={!!checks.show('pincode')} onBlur={checks.leave('pincode')}
                    onChange={e => setValues(v => ({ ...v, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
                <FieldError message={checks.show('pincode')} />
            </div>
        </>
    );
}
