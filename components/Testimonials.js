import { QuoteMark, ArcShape } from '@/components/Decor';

/**
 * Testimonials — the community block.
 *
 * Quote cards with soft rose accents.
 *
 * QUOTES is intentionally empty: the section renders NOTHING until Patricia has
 * real, permissioned quotes. Never invent a customer, and never publish someone's
 * words or town without asking them first.
 *
 * To publish testimonials, add entries shaped like:
 *   { quote: 'What she said.', name: 'First name + initial', detail: 'Town' }
 * The layout below already handles one, two or three of them.
 */

const QUOTES = [];

export default function Testimonials() {
  // Nothing to show yet — render no markup at all rather than an empty heading.
  if (QUOTES.length === 0) return null;

  return (
    <section className="relative overflow-hidden border-t border-bbLine" id="community">
      <ArcShape size={360} className="pointer-events-none absolute -left-24 top-8" opacity={0.3} />

      <div className="bb-container relative bb-section">
        <header className="max-w-2xl">
          <p className="bb-eyebrow">The Sisterhood</p>
          <h2 className="bb-h2 mt-4">Women who ordered, and told us what happened next.</h2>
        </header>

        <ul className="mt-12 grid gap-5 md:grid-cols-3 lg:gap-6">
          {QUOTES.map((item) => (
            <li key={item.name} className="bb-panel-burgundy flex flex-col p-6 sm:p-7">
              <QuoteMark opacity={0.45} />

              <blockquote className="mt-5 flex-1">
                <p className="font-display text-base leading-[1.6] text-bbInk/90 sm:text-lg">
                  {item.quote}
                </p>
              </blockquote>

              <footer className="mt-6 border-t border-bbRose/20 pt-4">
                <p className="text-sm font-semibold text-bbBlush">{item.name}</p>
                <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-bbInk/40">{item.detail}</p>
              </footer>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
