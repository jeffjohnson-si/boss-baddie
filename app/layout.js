import './globals.css';
import AdminBar from '@/components/AdminBar';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import InstallBanner from '@/components/InstallBanner';
import SessionKeeper from '@/components/SessionKeeper';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import { CartProvider } from '@/components/CartProvider';
import { FrondLine, HibiscusLine } from '@/components/Decor';
import { currentAdmin } from '@/lib/current-admin';
import { readCartCatalogue } from '@/lib/product-store';
import { cookies } from 'next/headers';
import { CUSTOMER_COOKIE } from '@/lib/customer-auth';


/**
 * Root layout — wraps every route in the brand chrome.
 *
 * The whole site sits inside .bb-shell: a rounded near-black panel floating on
 * a hot-pink frame (see body in globals.css). The pink margin only exists from
 * `lg` up; on a phone the shell is full-bleed so no screen space is wasted.
 *
 * CartProvider is the only client boundary at this level; Header and Footer sit
 * inside it so they can read the bag count, but the page content passed as
 * `children` stays server-rendered.
 *
 * The catalogue is now editable from /admin/products, so it lives on the server
 * and is handed to the cart as a lean id/title/price list. Sending it with the
 * page costs a few hundred bytes and saves an extra round trip, which is the
 * right trade on a slow connection. Prices here are for DISPLAY ONLY — the
 * server re-prices every order in buildOrder() regardless.
 */

/**
 * The public address of the site, used to turn relative paths into the absolute
 * URLs that share cards and canonical tags need.
 *
 * It is an env var because the domain is Patricia's decision and is not settled
 * yet, and because it differs between the server she tests on and the real one.
 *
 * Guarded rather than trusted: `new URL()` throws on a typo, and this runs on
 * every request in a force-dynamic layout, so an unparseable value would take the
 * whole site down instead of just spoiling a share card. A bad value falls back
 * and complains in the server log.
 */
function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      return new URL(configured);
    } catch {
      console.error(
        `NEXT_PUBLIC_SITE_URL is not a valid URL: "${configured}". ` +
          'It needs the scheme too, e.g. https://bossbaddie.sb',
      );
    }
  }
  // A placeholder, not a real domain. Share cards will point at nothing until the
  // real address is set — which is better than the site refusing to render.
  return new URL('https://bossbaddie.example');
}

export const metadata = {
  metadataBase: siteUrl(),
  title: {
    default: 'BOSS BADDIE | Step Into Your Power',
    template: '%s | BOSS BADDIE',
  },
  description:
    'BOSS BADDIE — a women-empowerment lifestyle and e-commerce brand from the Solomon Islands. Phone cases, tempered glass and lifestyle pieces, founded by Patricia.',
  keywords: [
    'BOSS BADDIE',
    'Solomon Islands',
    'phone cases Honiara',
    'tempered glass Solomon Islands',
    'women empowerment Pacific',
    'female entrepreneurship Solomon Islands',
  ],
  openGraph: {
    title: 'BOSS BADDIE | Step Into Your Power',
    description:
      'Step into your power. Manifest the version of you you’ve always wanted to be. Women-owned, island-built.',
    type: 'website',
    locale: 'en_SB',
    siteName: 'BOSS BADDIE',
  },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/logo.png', apple: '/icons/apple-touch-icon.png' },
  // Installable app: the manifest is what makes "Add to Home Screen" open without
  // browser chrome, and appleWebApp covers iOS, which ignores most of it.
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BOSS BADDIE',
  },
};

export const viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
};

/**
 * Rendered per request, not baked at build time. Two reasons, both correctness
 * rather than preference:
 *
 *   1. The catalogue below is read from the store. Prerendered once at build, a
 *      product Patricia adds afterwards would be missing from the bag's catalogue,
 *      and adding it to a bag would silently fail.
 *   2. The admin bar depends on her session cookie, which does not exist at build.
 *
 * The cost is a server render per request. That is a few milliseconds against a
 * local JSON store, and the thing that actually decides how this site feels in
 * Honiara is payload size, not render time.
 */
export const dynamic = 'force-dynamic';


export default async function RootLayout({ children }) {
  // Only the fields the bag renders, cached across requests: the bag needs the
  // catalogue on every page, but re-reading the table on every navigation cost a
  // database round trip for a list that changes a few times a month. See
  // readCartCatalogue() — admin edits invalidate it.
  const catalogue = (await readCartCatalogue()).map(({ id, title, price, images }) => ({
    id,
    title,
    price,
    images: images.slice(0, 1),
  }));

  // Decided on the server. AdminBar only renders the strip; it never decides who
  // is signed in, because a client component cannot be trusted with that.
  const isAdmin = Boolean(await currentAdmin());


  // The header only needs a yes/no to choose between "Account" and "Sign In", so
  // it reads the cookie rather than the customer row. Every account page and
  // route still verifies the session against the database before showing or
  // returning anything — this is a label, not an authorisation decision. It saves
  // one query on every navigation.
  const signedIn = Boolean((await cookies()).get(CUSTOMER_COOKIE)?.value);

  return (
    // data-scroll-behavior tells Next.js this page opts into the smooth scrolling
    // declared on <html> in globals.css, so route transitions still reset scroll.
    <html lang="en" data-scroll-behavior="smooth">
      <body className="min-h-screen antialiased">
        {/* Accessibility: lets keyboard users jump straight past the navigation */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:bg-bbRose focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-black"
        >
          Skip to content
        </a>

        {/* Pacific floral line-art on the pink margin. Fixed, behind the shell,
            and only drawn from `lg` up where there is a margin to draw on. */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 hidden lg:block">
          <FrondLine size={520} color="#5c1230" opacity={0.32} leaflets={15} className="absolute -left-40 top-10" />
          <HibiscusLine size={300} color="#5c1230" opacity={0.34} className="absolute -left-24 bottom-16" />
          <HibiscusLine size={420} color="#5c1230" opacity={0.3} className="absolute -right-32 top-8" />
          <FrondLine size={460} color="#5c1230" opacity={0.28} leaflets={13} className="absolute -right-36 bottom-0" />
        </div>

        <CartProvider catalogue={catalogue}>
          {/* pb-[68px] on phones leaves the fixed tab bar its own space, so the
              footer is still reachable when the bar is on screen. */}
          <div className="bb-shell pb-[68px] lg:pb-0">
            <AdminBar active={isAdmin} />
            <Header signedIn={signedIn} />

            {/* relative + z-10 keeps content above the fixed grain overlay */}
            <main id="main" className="relative z-10">
              {children}
            </main>
            <Footer />
          </div>
        </CartProvider>

        {/* The app shell: tab bar on phones, the first-visit install invitation,
            and the offline cache installer. SessionKeeper only exists for a
            signed-in customer — it slides her 400-day cookie forward once a day. */}
        <BottomNav />
        <InstallBanner />
        {signedIn && <SessionKeeper />}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
