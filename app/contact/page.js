import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import PaymentNote from '@/components/PaymentNote';
import { Sparkle } from '@/components/Decor';

export const metadata = {
  title: 'Contact',
  description:
    'Message BOSS BADDIE — Instagram, TikTok, Facebook, WhatsApp or email. Based in Honiara, Solomon Islands. Orders are placed through the order form, not by card.',
};

/**
 * CONTACT
 *
 * No contact form here, deliberately. Patricia already lives in her Instagram
 * and WhatsApp inboxes, and a form would only create a second place to check
 * that customers then wait on. The one form on this site is the order form.
 *
 * Instagram and TikTok are hardcoded because those handles are hers and are not
 * going to change. FACEBOOK AND EMAIL COME FROM THE ENVIRONMENT and are only
 * rendered when set, because I do not know her real page or address — inventing
 * a plausible-looking one would put a dead link, or worse someone else's inbox,
 * in front of a customer. Set NEXT_PUBLIC_FACEBOOK and NEXT_PUBLIC_CONTACT_EMAIL
 * and each row appears; leave one blank and it simply does not exist.
 */

const CHANNELS = [
  {
    name: 'Instagram',
    handle: '@boss.baddieee',
    href: 'https://www.instagram.com/boss.baddieee',
    detail: 'Fastest reply. New stock is posted here first.',
    external: true,
  },
  {
    name: 'TikTok',
    handle: '@boss.baddieee',
    href: 'https://www.tiktok.com/@boss.baddieee',
    detail: 'Product videos, packing days and workshop clips.',
    external: true,
  },
];

const FAQS = [
  {
    q: 'Can I pay by card?',
    a: 'No. There is no card checkout anywhere on this site, and there is nothing to transfer beforehand either. You send the order form, we tell you where and when to collect, and you pay cash then. We will never ask you for card or bank details — if anyone claiming to be us does, it is not us.',
  },
  {
    q: 'How long does an order take?',
    a: 'Stocked items are usually ready within a day or two in Honiara. Made-to-order pieces take longer, and we will tell you honestly when you order rather than guessing.',
  },
  {
    q: 'Do you deliver?',
    a: 'No — there is no courier or postal delivery service here to hand an order to, so every order is collected in person in Honiara. Nothing is added to your total for it.',
  },
  {
    q: 'Where is my invoice?',
    a: 'You get your own private link the moment you order. It says your invoice is being prepared until we have confirmed where and when you collect — once we have, the invoice appears at that same link and you can print it or save it as a PDF. We send the link to you again when we message you, so keep it or bookmark it.',
  },
  {
    q: 'I am in another province. Can I still order?',
    a: 'Yes. Order as normal, then tell us who will collect it in Honiara for you — a relative, a friend, or you yourself on your next trip in. Message us first if you are not sure and we will work it out with you.',
  },
  {
    q: 'What if it is not right for me?',
    a: 'Tell us exactly what you need in the note when you order and we will check it before anything is packed. If we get it wrong, we replace it.',
  },
];


export default function ContactPage() {
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP || '';
  const pickup = process.env.NEXT_PUBLIC_PICKUP_LOCATION || 'Honiara, Solomon Islands';
  const facebook = process.env.NEXT_PUBLIC_FACEBOOK || '';
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL || '';

  // Facebook after the two she posts to most, email last: it is the slowest of
  // the four and the one she is least likely to be sitting in.
  const channels = [...CHANNELS];

  if (facebook) {
    channels.push({
      name: 'Facebook',
      // Show the page name rather than the whole URL — "facebook.com/..." reads
      // as noise next to an @handle.
      handle: facebook.replace(/^https?:\/\/(www\.)?facebook\.com\//i, '').replace(/\/$/, ''),
      href: facebook,
      detail: 'Photos, stock updates and messages.',
      external: true,
    });
  }

  if (email) {
    channels.push({
      name: 'Email',
      handle: email,
      href: `mailto:${email}`,
      detail: 'For anything long, or if you need it in writing.',
      // A mailto: must not open in a new tab — that leaves an empty window behind.
      external: false,
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Message us. A real person answers."
        intro="Patricia reads and replies to messages herself, which means it is personal but not instant. If you have not heard back within a day, send it again — it happens."
      />

      <section className="bb-section">
        <div className="bb-container grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
          {/* ---------------- Channels + FAQ ---------------- */}
          <div>
            <h2 className="bb-h3">Where to find us</h2>

            <ul className="mt-6 divide-y divide-bbLine border-y border-bbLine">
              {channels.map((channel) => (
                <li key={channel.name}>
                  <a
                    href={channel.href}
                    target={channel.external ? '_blank' : undefined}
                    rel={channel.external ? 'noopener noreferrer' : undefined}
                    className="group flex min-h-[76px] items-center justify-between gap-4 py-5"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-bbInk">{channel.name}</span>
                      <span className="mt-0.5 block break-all text-sm text-bbRose">{channel.handle}</span>
                      <span className="mt-1 block text-xs text-bbInk/45">{channel.detail}</span>
                    </span>
                    <span aria-hidden="true" className="text-bbRose transition-transform group-hover:translate-x-1">
                      &rarr;
                    </span>
                  </a>
                </li>
              ))}

              {whatsapp && (
                <li className="flex min-h-[76px] items-center justify-between gap-4 py-5">
                  <span>
                    <span className="block text-sm font-semibold text-bbInk">WhatsApp</span>
                    <span className="mt-0.5 block text-sm text-bbRose">{whatsapp}</span>
                    <span className="mt-1 block text-xs text-bbInk/45">
                      Best for order questions and pickup times.
                    </span>
                  </span>
                </li>
              )}

              <li className="flex min-h-[76px] items-center justify-between gap-4 py-5">
                <span>
                  <span className="block text-sm font-semibold text-bbInk">Pickup</span>
                  <span className="mt-0.5 block text-sm text-bbInk/70">{pickup}</span>
                  <span className="mt-1 block text-xs text-bbInk/45">
                    By arrangement — we message you a time.
                  </span>
                </span>
              </li>
            </ul>

            {/* ---- FAQ ---- */}
            <h2 className="bb-h3 mt-14">Questions we get a lot</h2>

            <dl className="mt-6 space-y-6">
              {FAQS.map((item) => (
                <div key={item.q} className="border-t border-bbLine pt-5">
                  <dt className="flex items-start gap-2.5 font-display text-base text-bbInk">
                    <Sparkle size={11} className="mt-1.5 shrink-0" opacity={0.85} />
                    {item.q}
                  </dt>
                  <dd className="bb-prose mt-2 max-w-2xl pl-6">{item.a}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-12 text-sm text-bbInk/55">
              Ready to order?{' '}
              <Link href="/shop" className="text-bbRose underline-offset-4 hover:underline">
                Start in the shop
              </Link>
              .
            </p>
          </div>

          {/* ---------------- Payment explainer ---------------- */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <PaymentNote />
          </aside>
        </div>
      </section>
    </>
  );
}
