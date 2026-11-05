'use client';

// The festive theme in the browser. It lives on <html data-festive="...">, which globals.css reads for the colours.
import { useEffect, useState } from 'react';

const STORE_KEY = 'fz-festive';

function apply(theme: string) {
    const root = document.documentElement;
    if (theme === 'none') delete root.dataset.festive;
    else root.dataset.festive = theme;
    try {
        localStorage.setItem(STORE_KEY, theme);
    } catch { /* private mode: the theme is fetched again on the next page */ }
    window.dispatchEvent(new Event('fonzkart-festive'));
}

/** Rendered once in the layout: asks for the current theme after the page has loaded. */
export function FestiveSync() {
    useEffect(() => {
        fetch('/api/festive')
            .then(r => (r.ok ? r.json() : null))
            .then(body => {
                if (typeof body?.theme === 'string') apply(body.theme);
            })
            .catch(() => undefined);
    }, []);
    return null;
}

export function useFestive(): string {
    const [theme, setTheme] = useState('none');
    useEffect(() => {
        const read = () => setTheme(document.documentElement.dataset.festive ?? 'none');
        read();
        window.addEventListener('fonzkart-festive', read);
        return () => window.removeEventListener('fonzkart-festive', read);
    }, []);
    return theme;
}
