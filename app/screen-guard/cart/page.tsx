import { redirect } from 'next/navigation';

// Screen guards are coming soon as a doorstep service, so there is no cart yet (CartCheckout returns at launch).
export default function ScreenGuardCartPage() {
    redirect('/screen-guard');
}
