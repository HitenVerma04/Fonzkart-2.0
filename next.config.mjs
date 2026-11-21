/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'fdn2.gsmarena.com' },
      { protocol: 'https', hostname: '**.gsmarena.com' },
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
      { protocol: 'https', hostname: 'cdn.simpleicons.org' },
      { protocol: 'https', hostname: '1000logos.net' },
      { protocol: 'https', hostname: 'cms-assets.xboxservices.com' },
      { protocol: 'https', hostname: 'assets.nintendo.com' },
      { protocol: 'https', hostname: 'gmedia.playstation.com' },
      { protocol: 'https', hostname: 'www.sony.co.in' },
      { protocol: 'https', hostname: 'www.lg.com' },
      { protocol: 'https', hostname: '**.appmifile.com' },
      { protocol: 'https', hostname: '**.samsung.com' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 's3n.cashify.in' },
      { protocol: 'https', hostname: 'www.boat-lifestyle.com' },
      { protocol: 'https', hostname: '**.cashify.in' },
      { protocol: 'https', hostname: '**.boat-lifestyle.com' },
      { protocol: 'https', hostname: 'static.digit.in' },
      { protocol: 'https', hostname: 'rukminim2.flixcart.com' },
      { protocol: 'https', hostname: 'images.firstpost.com' },
      { protocol: 'https', hostname: 'images.livemint.com' },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  output: 'standalone',
  // Basic protection on every page: no MIME sniffing, no framing by other sites (clickjacking), no full URLs leaked to
  // other sites, and browsers keep to HTTPS for a year. (No Content-Security-Policy yet: Google Ads, maps and
  // Supabase scripts would need listing first.)
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
      ],
    }];
  },
};

export default nextConfig;
