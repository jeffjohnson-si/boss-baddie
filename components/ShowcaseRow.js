import Link from 'next/link';
import IllustrationPlaceholder from '@/components/IllustrationPlaceholder';

/**
 * ShowcaseRow — the row of five images under the brand pillars.
 *
 * These slots are reserved for Patricia's own lifestyle and product photography:
 * nothing here is generated. Until the files land, each empty slot renders as a
 * frame at the final 3:4 ratio carrying the line that says what belongs in it
 * ("A picture of your products", "A picture of a customer with her order"), so
 * uploading a photograph shifts nothing on the page and Patricia can see exactly
 * what is being asked of her.
 *
 * A grid, not a carousel: on a slow connection every card is visible without
 * a tap, and the row ships no JavaScript at all. Two columns on a phone, three
 * at tablet, all five on desktop.
 *
 * To fill it in, set `src` on showcase1…showcase5 in
 * components/IllustrationPlaceholder.js.
 */

const SLOTS = ['showcase1', 'showcase2', 'showcase3', 'showcase4', 'showcase5'];

export default function ShowcaseRow() {
  return (
    <section className="relative py-8" aria-labelledby="showcase-heading">
      <div className="bb-container">
        <div className="mb-5 flex items-end justify-between gap-6">
          <div>
            <p className="bb-eyebrow">The Look</p>
            <h2 id="showcase-heading" className="mt-2 font-display text-2xl font-normal text-bbInk">
              Real women, real orders
            </h2>
          </div>

          <Link href="/shop" className="bb-pill shrink-0">
            Shop all
            <svg width="7" height="11" viewBox="0 0 7 11" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path d="M1 1l4.5 4.5L1 10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {SLOTS.map((slot) => (
            <li key={slot}>
              <IllustrationPlaceholder
                slot={slot}
                compact
                fit="cover"
                sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 18vw"
                frameClassName="rounded-2xl"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
