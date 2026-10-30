import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import IllustrationPlaceholder from '@/components/IllustrationPlaceholder';
import { Sparkle, FloralOverlay } from '@/components/Decor';

export const metadata = {
  title: 'Our Story',
  description:
    'BOSS BADDIE was founded by Patricia, a solo female entrepreneur in the Solomon Islands, to give Pacific women the tools and the sisterhood to build something of their own.',
};

/**
 * OUR STORY — the founder-led narrative page.
 *
 * The About Us illustration slot is reserved here for Patricia's uploaded
 * artwork (see components/IllustrationPlaceholder.js). Nothing on this page
 * generates a picture of a person.
 */

const MILESTONES = [
  {
    year: '2023',
    title: 'One phone, one notebook',
    copy: 'Patricia started reselling phone accessories from her own handset, keeping every order in a paper notebook and meeting customers around Honiara to hand each one over herself.',
  },
  {
    year: '2024',
    title: 'A name for it',
    copy: 'BOSS BADDIE became a brand rather than a side hustle — a name for the standard she wanted to hold, and for the women buying from her.',
  },
  {
    year: '2025',
    title: 'The sisterhood found each other',
    copy: 'The page turned into a room. Women swapped suppliers, pricing advice and encouragement, and the first workshops ran out of a borrowed space.',
  },
  {
    year: '2026',
    title: 'Online, on our own terms',
    copy: 'This site launched — built for island internet, with a manual order process that works with how money actually moves here.',
  },
];

export default function OurStoryPage() {
  return (
    <>
      <PageHeader
        eyebrow="Our Story"
        title="It started with one woman refusing to wait for permission."
        intro="BOSS BADDIE is founder-led and women-owned. Everything here is packed, checked and confirmed by Patricia herself — which is exactly why it is going to stay personal."
      />

      {/* ---------------- Founder section ---------------- */}
      <section className="bb-section relative overflow-hidden">
        <FloralOverlay corners="left" />

        <div className="bb-container relative grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* RESERVED for the uploaded About Us picture. Until it lands the frame
              carries the line "A picture of Patricia goes here", so the space is
              obviously waiting for something rather than looking broken. */}
          <div className="mx-auto w-full max-w-md lg:mx-0">
            <IllustrationPlaceholder slot="story" sizes="(max-width: 1024px) 88vw, 44vw" frameClassName="w-full" />
          </div>

          <div>
            <p className="bb-eyebrow">Meet Patricia</p>
            <h2 className="bb-h2 mt-4">Solo founder. Honiara. No investors, no shortcuts.</h2>

            <div className="mt-6 space-y-4">
              <p className="bb-prose">
                Patricia built BOSS BADDIE the slow way: reinvesting each small profit, learning to
                price properly, and answering every message herself. There was no launch budget and no
                team — just a decision that she was allowed to want more than what was on offer.
              </p>
              <p className="bb-prose">
                That is why the brand is not only a shop. The products fund the work, and the work is
                helping other Solomon Islands women get their own thing off the ground: how to source,
                how to price, how to keep records, and how to keep going on the weeks when nothing
                sells.
              </p>
            </div>

            <ul className="mt-8 space-y-3">
              {[
                '100% women-owned and island-operated',
                'Every order packed and confirmed personally',
                'Profits reinvested into community workshops',
              ].map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-bbInk/75">
                  <Sparkle size={11} className="mt-1 shrink-0" opacity={0.9} />
                  {point}
                </li>
              ))}
            </ul>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link href="/shop" className="bb-btn-solid w-full sm:w-auto">
                Explore Shop
              </Link>
              <Link href="/contact" className="bb-btn-outline w-full sm:w-auto">
                Work With Us
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Timeline ---------------- */}
      <section className="bb-section border-t border-bbLine">
        <div className="bb-container">
          <header className="max-w-2xl">
            <p className="bb-eyebrow">How It Grew</p>
            <h2 className="bb-h2 mt-4">Four years, one step at a time.</h2>
          </header>

          <ol className="mt-12 space-y-10 sm:space-y-12">
            {MILESTONES.map((item) => (
              <li key={item.year} className="grid gap-3 border-t border-bbLine pt-6 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-8">
                <p className="font-display text-2xl text-bbRose">{item.year}</p>
                <div>
                  <h3 className="bb-h3">{item.title}</h3>
                  <p className="bb-prose mt-2 max-w-2xl">{item.copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
