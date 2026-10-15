import React from 'react';
import Link from 'next/link';

export default function SitemapPage() {
    return (
        <div className="container mx-auto px-4 py-16 md:py-24 max-w-4xl space-y-12">
            <h1 className="text-3xl font-bold mb-8 text-green-700 dark:text-green-500">Sitemap</h1>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold border-b pb-2">Buyback Categories</h2>
                    <ul className="space-y-2 text-muted-foreground">
                        <li><Link href="/sell?category=smartphone" className="hover:text-green-600">Sell Mobile Phone</Link></li>
                        <li><Link href="/sell?category=tablet" className="hover:text-green-600">Sell Tablet</Link></li>
                        <li><Link href="/sell?category=laptop" className="hover:text-green-600">Sell Laptop</Link></li>
                        <li><Link href="/sell?category=watch" className="hover:text-green-600">Sell Smartwatch</Link></li>
                        <li><Link href="/sell?category=console" className="hover:text-green-600">Sell Gaming Console</Link></li>
                        <li><Link href="/sell?category=smarttv" className="hover:text-green-600">Sell Smart TV</Link></li>
                    </ul>
                </div>

                <div className="space-y-4">
                    <h2 className="text-xl font-semibold border-b pb-2">Company</h2>
                    <ul className="space-y-2 text-muted-foreground">
                        <li><Link href="/about" className="hover:text-green-600">About Us</Link></li>
                        <li><Link href="/how-it-works" className="hover:text-green-600">How It Works</Link></li>
                        <li><Link href="/careers" className="hover:text-green-600">Careers</Link></li>
                        <li><Link href="/contact" className="hover:text-green-600">Contact Us</Link></li>
                    </ul>
                </div>

                <div className="space-y-4">
                    <h2 className="text-xl font-semibold border-b pb-2">Legal & Support</h2>
                    <ul className="space-y-2 text-muted-foreground">
                        <li><Link href="/privacy" className="hover:text-green-600">Privacy Policy</Link></li>
                        <li><Link href="/terms" className="hover:text-green-600">Terms of Service</Link></li>
                        <li><Link href="/contact" className="hover:text-green-600">Help Center</Link></li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
