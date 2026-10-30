/**
 * BrandPillars — the four things BOSS BADDIE stands for.
 *
 * Four rounded cards in one row on desktop, per the reference: a small rose
 * line icon, the pillar name, one short paragraph. Two columns at tablet and
 * one on a phone, so nothing is ever squeezed.
 *
 * Icons are inline SVG line-art, so there is no icon font and no image request.
 */

const PILLARS = [
  {
    title: 'Confidence',
    copy: 'Speak up, price your worth, take the space. Confidence is a habit you practise, not a personality you are born with.',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 12.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    title: 'Discipline',
    copy: 'Show up on the days it is boring. Routines, records and small promises kept are what compound into a business.',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" strokeLinecap="round" />
      </>
    ),
  },
  {
    title: 'Faith',
    copy: 'Pray over it, plan for it, then move. Manifesting is belief with a to-do list attached.',
    icon: (
      <>
        <path d="M12 3v18" strokeLinecap="round" />
        <path d="M7 8.5h10" strokeLinecap="round" />
        <path d="M12 21c3.6-2.6 5.5-5.6 5.5-9" strokeLinecap="round" opacity="0.5" />
      </>
    ),
  },
  {
    title: 'Sisterhood',
    copy: 'No woman builds alone. We share suppliers, customers and hard-won lessons instead of hoarding them.',
    icon: (
      <>
        <circle cx="9" cy="9" r="3.4" />
        <circle cx="16.5" cy="10.5" r="2.6" />
        <path d="M3.5 20c0-3.3 2.5-5.6 5.5-5.6s5.5 2.3 5.5 5.6" strokeLinecap="round" />
        <path d="M15.5 15c2.6.2 4.6 2.2 4.8 5" strokeLinecap="round" />
      </>
    ),
  },
];

export default function BrandPillars() {
  return (
    <section className="relative pb-4" id="pillars" aria-labelledby="pillars-heading">
      <div className="bb-container">
        {/* A real heading rather than an aria-label, and visually hidden because the
            design has no room for one. Without it the four cards below are h3s
            following the hero's h1 with no h2 between them, which reads to a
            screen reader as a level skipped and a section with no name. */}
        <h2 id="pillars-heading" className="sr-only">
          What BOSS BADDIE stands for
        </h2>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((pillar) => (
            <li key={pillar.title} className="bb-pillar-card">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ff4b8b"
                strokeWidth="1.2"
                aria-hidden="true"
                className="opacity-80"
              >
                {pillar.icon}
              </svg>

              <h3 className="mt-6 text-lg font-semibold text-bbInk">{pillar.title}</h3>
              <p className="mt-3 text-[13px] leading-[1.7] text-bbInk/55">{pillar.copy}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
