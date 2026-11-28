// The resting loader: the Fonzkart cart over the name, with a slim progress sweep. Shown while a page or a list
// loads; the page transition (components/nav/NavTransition.tsx) ends in the same picture.
import { FCartLogo } from '@/components/FCartLogo';
import { Wordmark } from '@/components/Wordmark';

export function BrandLoader({ fullscreen = false, className = '' }: { fullscreen?: boolean; className?: string }) {
    return (
        <div role="status" aria-label="Loading" className={`fz-load ${fullscreen ? 'fz-load-full' : ''} ${className}`}>
            <div className="fz-load-cart">
                <FCartLogo size={fullscreen ? 120 : 96} animate={false} />
            </div>
            <Wordmark className={fullscreen ? 'fz-load-word' : 'fz-load-word fz-load-word-sm'} />
            <div className="fz-load-track" />
        </div>
    );
}

export default BrandLoader;
