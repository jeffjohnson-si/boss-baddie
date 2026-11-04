/** @type {import('next').NextConfig} */

/**
 * SECURITY HEADERS
 * ================
 * These are the cheap, non-breaking ones. The application layer already does the
 * important work — server-side session checks, httpOnly cookies, parameterised
 * SQL, magic-byte upload validation — and headers cannot substitute for any of
 * that. What they add is defence against a class of browser-side attacks:
 *
 *   nosniff            stops the browser guessing a file's type (an uploaded
 *                      image served with the wrong type cannot become script)
 *   frame-ancestors    nobody can embed the shop in an iframe and trick a
 *                      signed-in customer into clicking through it
 *   referrer-policy    a customer opening an invoice link does not leak the
 *                      private token to whatever site they click through to
 *   permissions-policy nothing here needs camera, microphone or location
 *   HSTS               once served over HTTPS, the browser refuses to downgrade
 *
 * DELIBERATELY NOT A CSP YET: Next injects inline bootstrap scripts, so a strict
 * Content-Security-Policy needs a per-request nonce threaded through the app. A
 * policy loose enough to work without one ('unsafe-inline') mostly looks like
 * protection without being it. Worth doing properly once the site is on a domain
 * and the script surface is stable.
 */

const nextConfig = {
  // Do not advertise the framework version in every response.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
