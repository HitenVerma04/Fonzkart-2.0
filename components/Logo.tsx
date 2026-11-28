'use client';

import React from 'react';
import { FCartLogo } from '@/components/FCartLogo';
import { Wordmark } from '@/components/Wordmark';

/** The cart logo; with `wordmark`, "Fonzkart" written beside it. */
export const Logo = ({ className = "h-11 sm:h-12 w-auto", wordmark = false, cartSize = 68 }: { className?: string; wordmark?: boolean; cartSize?: number }) => {
    return (
        <div className={`relative flex items-center ${wordmark ? 'gap-1' : 'justify-center'} ${className}`} aria-label="Fonzkart">
            <FCartLogo size={cartSize} animate={false} />
            {wordmark && <Wordmark className="text-[21px] sm:text-[26px] -ml-0.5" />}
        </div>
    );
};

export default Logo;
