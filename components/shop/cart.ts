'use client';

// The screen guard cart, kept in this browser.
import { useEffect, useState } from 'react';

export type CartLine = { screenGuardId: string; quantity: number };

const KEY = 'fonzkart-shop-cart';
export const MAX_QUANTITY = 5;

function read(): CartLine[] {
    try {
        const lines = JSON.parse(localStorage.getItem(KEY) ?? '[]');
        return Array.isArray(lines) ? lines : [];
    } catch {
        return [];
    }
}

function write(lines: CartLine[]) {
    try {
        localStorage.setItem(KEY, JSON.stringify(lines));
    } catch { /* private mode: the cart lasts for this page only */ }
    window.dispatchEvent(new Event('fonzkart-cart'));
}

export function useCart() {
    const [lines, setLines] = useState<CartLine[]>([]);
    useEffect(() => {
        const sync = () => setLines(read());
        sync();
        window.addEventListener('fonzkart-cart', sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener('fonzkart-cart', sync);
            window.removeEventListener('storage', sync);
        };
    }, []);
    const setQuantity = (screenGuardId: string, quantity: number) => {
        const rest = read().filter(l => l.screenGuardId !== screenGuardId);
        write(quantity > 0 ? [...rest, { screenGuardId, quantity: Math.min(quantity, MAX_QUANTITY) }] : rest);
    };
    return { lines, setQuantity, clear: () => write([]) };
}
