import Hero from '@/components/Hero';
import BrandPillars from '@/components/BrandPillars';
import ShowcaseRow from '@/components/ShowcaseRow';

/**
 * HOMEPAGE
 *
 * One screen, top to bottom, matching the approved reference:
 *   1. Hero         — brand lockup + reserved portrait, "Become Her", CTA pill
 *   2. BrandPillars — Confidence / Discipline / Faith / Sisterhood
 *   3. ShowcaseRow  — five reserved slots for uploaded photography
 *   4. Tagline band — "Empowered women empower women."
 *
 * The mantra block and the community testimonials deliberately live on
 * /community rather than here; the homepage stays a single screen so nothing
 * competes with the hero.
 *
 * Every block is a server component, so the homepage ships almost no
 * JavaScript — only the header's menu state is client-side.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <BrandPillars />
      <ShowcaseRow />

      {/* Closing line. Serif, centred, quiet — the last thing you read. */}
      <section className="pb-14 pt-4 text-center">
        <p className="bb-container font-display text-2xl font-normal text-bbInk sm:text-3xl lg:text-[34px]">
          Empowered women empower women.
        </p>
      </section>
    </>
  );
}
