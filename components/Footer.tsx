import Link from 'next/link';
import { Facebook, Twitter, Instagram, Linkedin, Mail, Phone, MapPin } from 'lucide-react';
import { Logo } from '@/components/Logo';

export default function Footer() {
    return (
        <footer className="w-full border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pt-16 pb-8 text-foreground">
            <div className="container mx-auto px-4 md:px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
                    <div className="space-y-4">
                        <Link href="/" className="flex items-center gap-0.5">
                            {/* Single Line Logo with CSS Variables */}
                            <Logo />
                        </Link>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            The smartest way to sell your old gadgets. Get instant quotes, free doorstep pickup, and instant payment.
                        </p>
                        <div className="flex gap-4 pt-2">
                            <Link href="https://www.facebook.com/share/17i7TEiHMJ/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                                <Facebook className="h-5 w-5" />
                            </Link>
                            <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                                <Twitter className="h-5 w-5" />
                            </Link>
                            <Link href="https://www.instagram.com/fonzkart?igsh=ZWJuZnJlbHkwMnVi" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                                <Instagram className="h-5 w-5" />
                            </Link>
                            <Link href="https://www.linkedin.com/company/fonzkart" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                                <Linkedin className="h-5 w-5" />
                            </Link>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-bold text-lg text-foreground">Services</h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="/sell?category=smartphone" className="hover:text-primary transition-colors">Sell Smartphone</Link></li>
                            <li><Link href="/sell?category=tablet" className="hover:text-primary transition-colors">Sell Tablet</Link></li>
                            <li><Link href="/sell?category=laptop" className="hover:text-primary transition-colors">Sell Laptop</Link></li>
                            <li><Link href="/sell?category=console" className="hover:text-primary transition-colors">Sell Console</Link></li>
                            <li><Link href="/sell?category=smarttv" className="hover:text-primary transition-colors">Sell Smart TV</Link></li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-bold text-lg text-foreground">Company</h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="/about" className="hover:text-primary transition-colors">About Us</Link></li>
                            <li><Link href="/how-it-works" className="hover:text-primary transition-colors">How it Works</Link></li>
                            <li>
                                <Link href="/careers" className="inline-flex items-center gap-2 hover:text-primary transition-colors group">
                                    <span>Careers</span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 group-hover:bg-emerald-500/25 transition-colors">
                                        Hiring
                                    </span>
                                </Link>
                            </li>
                            <li><Link href="/contact" className="hover:text-primary transition-colors">Contact Us</Link></li>
                            <li><Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
                            <li><Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-bold text-lg text-foreground">Contact</h3>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li className="flex items-center gap-3">
                                <Phone className="h-5 w-5 text-primary shrink-0" />
                                <span>+91 90603 36060</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <Mail className="h-5 w-5 text-primary shrink-0" />
                                <span>connect@fonzkart.in</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                <div>
                                    <span className="block text-foreground font-medium">ceo@fonzkart.in</span>
                                    <span className="text-xs text-muted-foreground block mt-0.5">Connect CEO: Syed Yaseen Ahmed R</span>
                                </div>
                            </li>


                            <li className="flex items-start gap-3 pt-1">
                                <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                <span className="leading-relaxed">#69 8th cross Hegde Nagar, SRK Nagar Post, Bangalore - 560077</span>
                            </li>
                        </ul>
                    </div>
                </div>


                <div className="border-t pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-muted-foreground text-foreground">
                        © {new Date().getFullYear()} NR Waste Management Private Limited (Fonzkart). All rights reserved.
                    </p>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground justify-center md:justify-end">
                        <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
                        <Link href="/cancellation-policy" className="hover:text-primary transition-colors">Cancellation Policy</Link>
                        <Link href="/refund-policy" className="hover:text-primary transition-colors">Refund Policy</Link>
                        <Link href="/return-policy" className="hover:text-primary transition-colors">Return & Exchange Policy</Link>
                        <Link href="/sitemap" className="hover:text-primary transition-colors">Sitemap</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
