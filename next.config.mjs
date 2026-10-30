/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Pacific-island bandwidth optimisation:
  //  - compress: gzip HTML/JSON responses
  //  - poweredByHeader off: a few bytes saved on every response
  compress: true,
  poweredByHeader: false,

  images: {
    // AVIF first — roughly 30-50% smaller than JPEG at the same quality.
    formats: ['image/avif', 'image/webp'],
    // Only the widths we actually render, so Next never generates unused variants.
    deviceSizes: [360, 480, 640, 828, 1080, 1280, 1920],
    imageSizes: [96, 160, 240, 320, 480],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  async headers() {
    return [
      {
        // Brand assets never change under the same filename — cache hard.
        source: '/:all*(svg|png|jpg|jpeg|webp|avif|woff2)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // The service worker itself must never be cached, or a new VERSION in
        // public/sw.js would never reach the browser that needs it.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        // Some static hosts serve .webmanifest as octet-stream; say what it is.
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ];
  },
};

export default nextConfig;
