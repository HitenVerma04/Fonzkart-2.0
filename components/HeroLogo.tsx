'use client';

// The F-phone and the ONZKA₹T lettering, drawn from the official artwork (public/brand) so the letters keep the
// brand's own spacing; in dark mode the lettering is the white version. `forceLight` keeps the ink lettering always.
export const HeroLogo = ({ className = '', forceLight = false }: { className?: string; forceLight?: boolean }) => {
    const size = 'h-11 sm:h-[52px] w-auto';
    return (
        <span className={`inline-flex shrink-0 select-none ${className}`} role="img" aria-label="Fonzkart">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/fonzkart_wordmark.png" alt="" width={1408} height={346} draggable={false} className={`${size} ${forceLight ? '' : 'dark:hidden'}`} />
            {!forceLight && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/brand/fonzkart_wordmark_dark.png" alt="" width={1408} height={346} draggable={false} className={`${size} hidden dark:block`} />
            )}
        </span>
    );
};

export default HeroLogo;
