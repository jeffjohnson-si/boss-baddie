import Hero from '@/components/Hero';
import BrandPillars from '@/components/BrandPillars';
import ShowcaseRow from '@/components/ShowcaseRow';

/**
 * HOMEPAGE
 *
 * One screen, top to bottom, matching the approved reference:
 *   1. Hero         — brand lockup + "Become Her", CTA pill
 *   2. BrandPillars — Confidence / Discipline / Faith / Sisterhood
 *   3. ShowcaseRow  — five images
 *   4. Tagline band — "Empowered women empower women."
 *
 * On a phone the look comes first: the showcase row sits directly under the
 * hero, and the four pillars follow it. The DOM keeps the desktop order
 * (pillars, then look) so the reading order stays the same everywhere;
 * `flex-col-reverse` only flips the visual order below `lg`.
 *
 * The mantra block lives on /our-story rather than here; the homepage stays a
 * single screen so nothing competes with the hero.
 *
 * Every block is a server component, so the homepage ships almost no
 * JavaScript — only the header's menu state is client-side.
 */
export default function HomePage() {
  return (
    <>
      <Hero />

      <div className="flex flex-col-reverse lg:flex-col">
        <BrandPillars />
        <ShowcaseRow />
      </div>

      {/* Closing line. Serif, centred, quiet — the last thing you read. */}
      <section className="pb-14 pt-4 text-center">
        <p className="bb-container font-display text-2xl font-normal text-bbInk sm:text-3xl lg:text-[34px]">
          Empowered women empower women.
        </p>
      </section>
    </>
  );
}
