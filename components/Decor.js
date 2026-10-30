/**
 * Decor — every decorative mark on the site, as inline SVG.
 *
 * Why inline SVG rather than image files: each of these is 200-800 bytes of
 * markup that ships inside the HTML the browser is already downloading. On a
 * slow Solomon Islands connection, avoiding a dozen extra image requests is
 * worth far more than the few bytes saved by an optimised PNG.
 *
 * IMPORTANT — brand image rule: nothing in this file draws a person. The
 * illustrated women are supplied by Patricia as fixed assets and rendered by
 * IllustrationPlaceholder / next/image only. Everything here is sparkles,
 * botanical line-art and abstract shapes.
 *
 * All coordinates are hard-coded (never Math.random) so the server and client
 * renders match exactly and React never reports a hydration mismatch.
 */

/* ------------------------------------------------------------------ */
/* Sparkles                                                            */
/* ------------------------------------------------------------------ */

/**
 * A single four-point sparkle. Gold by default, per the brand palette.
 * Rendered as one path so it stays sharp at any size.
 */
export function Sparkle({ size = 12, color = '#e3b873', className = '', opacity = 1 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-16 -16 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
      style={{ opacity }}
    >
      <path d="M0-15 2.4-2.4 15 0 2.4 2.4 0 15-2.4 2.4-15 0-2.4-2.4Z" fill={color} />
    </svg>
  );
}

/* Fixed positions as [left%, top%, size, opacity]. Hand-placed so the
   scatter looks intentional rather than evenly spaced. */
const SPARKLES = [
  [6, 14, 13, 0.75],
  [17, 62, 8, 0.5],
  [27, 26, 10, 0.62],
  [39, 78, 7, 0.45],
  [48, 10, 15, 0.8],
  [58, 46, 9, 0.55],
  [69, 20, 12, 0.7],
  [76, 70, 8, 0.5],
  [86, 34, 14, 0.75],
  [94, 58, 9, 0.55],
];

/**
 * A field of gold sparkles positioned absolutely across the parent.
 * The parent must be `relative`.
 *
 * @param {{ density?: 'sm'|'md', className?: string }} props
 */
export function SparkleField({ density = 'md', className = '' }) {
  const marks = density === 'sm' ? SPARKLES.filter((_, i) => i % 2 === 0) : SPARKLES;

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {marks.map(([left, top, size, opacity]) => (
        <span
          key={`${left}-${top}`}
          className="absolute animate-twinkle"
          style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${(left % 7) * 0.4}s` }}
        >
          <Sparkle size={size} opacity={opacity} />
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pacific tropical floral line-art                                    */
/* ------------------------------------------------------------------ */

/**
 * Hibiscus drawn as thin line-art (stroke only, no fill) — the "faint
 * botanical overlay" in the brand direction. Five petals, notched edges,
 * with stamen lines from the centre.
 */
export function HibiscusLine({ size = 120, color = '#ff4b8b', opacity = 0.22, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-50 -50 100 100"
      fill="none"
      stroke={color}
      strokeWidth="1"
      aria-hidden="true"
      className={className}
      style={{ opacity }}
    >
      {[0, 72, 144, 216, 288].map((angle) => (
        <path
          key={angle}
          // one petal, drawn upward from the centre then mirrored back down
          d="M0 0C-9-10-13-22-8-31c4-7 12-7 16 0 5 9 1 21-8 31Z"
          transform={`rotate(${angle})`}
        />
      ))}
      {/* stamen: a stalk with three anthers */}
      <path d="M0 0 14-16" strokeLinecap="round" />
      <circle cx="14" cy="-16" r="1.6" />
      <circle cx="10.5" cy="-13" r="1.2" />
      <circle cx="12" cy="-19" r="1.2" />
      <circle cx="0" cy="0" r="3" />
    </svg>
  );
}

/**
 * Monstera / palm frond in line-art. Leaflets are generated symmetrically
 * either side of a central rib and taper toward the tip.
 */
export function FrondLine({ size = 150, color = '#ff4b8b', opacity = 0.2, leaflets = 11, className = '' }) {
  const ribs = [];

  for (let i = 0; i < leaflets; i += 1) {
    // t runs 0 -> 1 from base to tip
    const t = i / (leaflets - 1);
    const y = -46 + t * 88; // position along the rib
    const len = 30 * (1 - Math.abs(t - 0.32) * 0.9); // widest a third of the way up
    if (len <= 4) continue;
    ribs.push(
      <g key={i}>
        <path d={`M0 ${y.toFixed(1)} ${(-len).toFixed(1)} ${(y - len * 0.42).toFixed(1)}`} strokeLinecap="round" />
        <path d={`M0 ${y.toFixed(1)} ${len.toFixed(1)} ${(y - len * 0.42).toFixed(1)}`} strokeLinecap="round" />
      </g>,
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="-50 -50 100 100"
      fill="none"
      stroke={color}
      strokeWidth="1"
      aria-hidden="true"
      className={className}
      style={{ opacity }}
    >
      <path d="M0 48 0-48" strokeLinecap="round" />
      {ribs}
    </svg>
  );
}

/**
 * FloralOverlay — botanical line-art tucked into the corners of a section.
 * Purely atmospheric, so it is hidden from assistive tech and, on the right
 * hand side, hidden on small screens where it would crowd the text.
 *
 * @param {{ corners?: 'both'|'left'|'right', className?: string }} props
 */
export function FloralOverlay({ corners = 'both', className = '' }) {
  const showLeft = corners === 'both' || corners === 'left';
  const showRight = corners === 'both' || corners === 'right';

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {showLeft && (
        <div className="absolute -left-12 -top-10 rotate-[18deg]">
          <FrondLine size={190} opacity={0.16} />
          <HibiscusLine size={82} opacity={0.18} className="absolute left-24 top-28" />
        </div>
      )}

      {showRight && (
        <div className="absolute -bottom-14 -right-14 hidden rotate-[-24deg] sm:block">
          <FrondLine size={210} opacity={0.14} leaflets={13} />
          <HibiscusLine size={70} opacity={0.16} className="absolute bottom-24 right-24" />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Abstract feminine shapes                                            */
/* ------------------------------------------------------------------ */

/**
 * ArcShape — a soft open curve used behind headings and product tiles.
 * Abstract on purpose: the brand rule forbids drawing figures here.
 */
export function ArcShape({ size = 220, color = '#701938', opacity = 0.5, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      stroke={color}
      strokeWidth="0.8"
      aria-hidden="true"
      className={className}
      style={{ opacity }}
    >
      <path d="M4 96C4 46 30 12 74 4" strokeLinecap="round" />
      <path d="M18 96C18 54 40 24 78 16" strokeLinecap="round" />
      <path d="M32 96C32 62 50 38 82 30" strokeLinecap="round" />
    </svg>
  );
}

/** A thin rose bracket used to frame editorial pull-quotes. */
export function QuoteMark({ className = '', color = '#ff4b8b', opacity = 0.5 }) {
  return (
    <svg
      width="46"
      height="34"
      viewBox="0 0 46 34"
      fill="none"
      stroke={color}
      strokeWidth="1.2"
      aria-hidden="true"
      className={className}
      style={{ opacity }}
    >
      <path d="M18 2C8 6 2 14 2 24c0 5 3 8 7 8s7-3 7-7-3-7-7-7c0-6 4-11 11-14Z" />
      <path d="M42 2c-10 4-16 12-16 22 0 5 3 8 7 8s7-3 7-7-3-7-7-7c0-6 4-11 11-14Z" />
    </svg>
  );
}
