import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fonzkart - Sell Your Used Smartphone",
  description: "Get the best price for your used smartphone instantly.",
};

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import InitialLoader from "@/components/ui/InitialLoader";
import { ThemeProvider } from "@/components/theme-provider";
import HeaderVisibility from "@/components/HeaderVisibility";
import MobileBottomNav from "@/components/MobileBottomNav";
import { FestiveSync } from "@/components/festive/festive-client";


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Before the first paint: the last festive theme, and whether the launch animation has played in this tab. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement,f=localStorage.getItem('fz-festive');if(f&&f!=='none')d.dataset.festive=f;if(sessionStorage.getItem('fz-boot')||/^\\/(admin|executive|partner|zonal|rm|login|signup)/.test(location.pathname)||matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('fz-booted')}catch(e){}`,
          }}
        />
        {/* Google tag (gtag.js) */}
        {/* eslint-disable-next-line @next/next/next-script-for-ga */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=AW-18446569040"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'AW-18446569040');
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Initial Splash Loader for first visit/refresh */}
          <InitialLoader />
          <FestiveSync />

          <HeaderVisibility>
            <Header />
          </HeaderVisibility>
          
          <main id="main-content" className="flex-1 pb-16 md:pb-0">
            {children}
          </main>

          <HeaderVisibility>
            <Footer />
          </HeaderVisibility>

          <HeaderVisibility>
            <MobileBottomNav />
          </HeaderVisibility>
        </ThemeProvider>
      </body>
    </html>
  );
}
