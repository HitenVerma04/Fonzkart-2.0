import Link from 'next/link';
import { Suspense } from 'react';
import { ThemeToggle } from './theme-toggle';
import { Logo } from './Logo';
import HeaderActions, { HeaderActionsSkeleton } from './HeaderActions';

export default function Header() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 shadow-xs transition-colors duration-200">
            {/* Accessible Skip Link */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-xl focus:shadow-lg focus:outline-none"
            >
                Skip to main content
            </a>

            <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
                {/* Logo & Brand Link */}
                <Link
                    href="/"
                    className="flex items-center gap-2 group transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
                    aria-label="Fonzkart Home"
                >
                    <Logo wordmark className="w-auto h-11 sm:h-12 py-0.5 text-primary" />
                </Link>

                {/* Right Utilities & Navigation Actions */}
                <div className="flex items-center gap-2 sm:gap-3">
                    <ThemeToggle />
                    <Suspense fallback={<HeaderActionsSkeleton />}>
                        <HeaderActions />
                    </Suspense>
                </div>
            </div>
        </header>
    );
}
