import Image from 'next/image';
import { Sparkle } from '@/components/Decor';

/**
 * IllustrationPlaceholder — a RESERVED slot for artwork Patricia supplies
 * herself: the illustrated founder characters, and the showcase photography.
 *
 * Brand image rule: the illustrated women are supplied as fixed assets. Nothing
 * in this codebase draws or generates a person. Until the files are dropped in,
 * this renders a labelled frame at the exact final aspect ratio, so the layout
 * never shifts when the real artwork arrives.
 *
 * ---------------------------------------------------------------
 * HOW TO PLUG IN THE REAL ARTWORK
 *   1. Save the file to  public/illustrations/<name>.jpg  — JPEG for
 *      photography, PNG only for illustration that needs a transparent
 *      background. At least 900px on the long edge.
 *   2. Set `src` on the matching slot in ILLUSTRATIONS below, and correct
 *      width/height to the real pixel dimensions
 *   3. Nothing else changes — every usage picks it up automatically
 * ---------------------------------------------------------------
 *
 * @param {{
 *   slot: keyof typeof ILLUSTRATIONS,
 *   priority?: boolean,
 *   sizes?: string,
 *   fit?: 'contain'|'cover',
 *   compact?: boolean,
 *   className?: string,
 *   frameClassName?: string
 * }} props
 */

/**
 * The registry of reserved illustration slots.
 *
 * `src: null` means "not uploaded yet" and renders the placeholder frame.
 * `alt` is written now, not later, so the descriptive text is already correct
 * for screen readers and for SEO the moment the image lands.
 */
export const ILLUSTRATIONS = {
  hero: {
    src: '/illustrations/patricia-hero.jpg',
    width: 1240,
    height: 1644, // 3:4 portrait — the hero frame trims under 1% of the width
    alt: 'Patricia, founder of BOSS BADDIE, in a white halter top and gold hibiscus earrings',
    label: 'Founder photograph',
    note: 'Portrait · Patricia',
    ratio: 'aspect-[3/4]',
  },
  story: {
    src: '/illustrations/our-story-patricia.jpg',
    width: 1240,
    height: 1240,
    alt: 'Patricia, founder of BOSS BADDIE, wearing gold hibiscus earrings',
    label: 'Our Story photograph',
    note: 'Square · Patricia',
    ratio: 'aspect-square',
  },

  /* ---- Homepage showcase row ----
     Five reserved slots for the lifestyle and product photography Patricia
     supplies. Same rule as the illustrations: nothing here is generated, and
     each slot already carries its own alt text so the row is accessible and
     indexable the moment the files land.

     `hint` is the one line shown inside an empty frame, and unlike `label` and
     `note` it is shown in production too. It is written TO Patricia, so she can
     see at a glance which photograph belongs where. */
  showcase1: {
    src: '/illustrations/showcase-1.jpg',
    width: 1446,
    height: 1928, // exactly 3:4 — crop-only from the supplied square photo
    alt: 'Hand holding a BOSS BADDIE phone case printed with pink and black florals',
    label: 'Showcase 1',
    note: 'Product in hand · phone case',
    hint: 'A picture of your product',
    ratio: 'aspect-[3/4]',
  },
  showcase2: {
    src: '/illustrations/showcase-phone-cases.jpg',
    width: 1240,
    height: 1664,
    alt: 'BOSS BADDIE phone cases and popsockets arranged on a white background',
    label: 'Showcase 2',
    note: 'Studio flat lay · phone cases',
    hint: 'A picture of your products',
    ratio: 'aspect-[3/4]',
  },
  showcase3: {
    src: '/illustrations/showcase-phone-detail.jpg',
    width: 750,
    height: 1000,
    alt: 'Close-up of pink and floral BOSS BADDIE phone cases',
    label: 'Showcase 3',
    note: 'Detail · phone cases and popsockets',
    ratio: 'aspect-[3/4]',
  },
  showcase4: {
    src: '/illustrations/showcase-earrings.jpg',
    width: 1240,
    height: 1672,
    alt: 'BOSS BADDIE gold hibiscus earrings in a black gift box',
    label: 'Showcase 4',
    note: 'Product · earrings and gift box',
    ratio: 'aspect-[3/4]',
  },
  showcase5: {
    src: '/illustrations/showcase-gym-bag.jpg',
    width: 1100,
    height: 1466,
    alt: 'BOSS BADDIE gym bag and water bottle',
    label: 'Showcase 5',
    note: 'Lifestyle · bag and bottle',
    ratio: 'aspect-[3/4]',
  },
};

export default function IllustrationPlaceholder({
  slot,
  priority = false,
  sizes = '(max-width: 1024px) 90vw, 44vw',
  fit = 'contain',
  compact = false,
  className = '',
  frameClassName = '',
}) {
  const art = ILLUSTRATIONS[slot];

  // A bad slot name should be loud in development, not silently blank.
  if (!art) {
    throw new Error(`IllustrationPlaceholder: unknown slot "${slot}"`);
  }

  // ---- Real artwork present: render it optimised ----
  // overflow-hidden so a rounded frameClassName actually clips the image.
  if (art.src) {
    return (
      <div className={`relative overflow-hidden ${art.ratio} ${frameClassName}`}>
        <Image
          src={art.src}
          alt={art.alt}
          width={art.width}
          height={art.height}
          priority={priority}
          sizes={sizes}
          className={`h-full w-full ${fit === 'cover' ? 'object-cover object-center' : 'object-contain object-bottom'} ${className}`}
        />
      </div>
    );
  }

  // ---- Reserved frame ----
  // An empty slot shows ONE line, `art.hint`, written to Patricia so she can see
  // which photograph belongs where. That line is visible in production as well as
  // in development, because these frames are how she is asked for her pictures.
  //
  // The developer briefing — the slot label, the art direction note and the pixel
  // spec — stays development-only. Those are instructions for whoever is filling
  // the slot in code, and a customer should never read them.
  //
  // NOTE FOR LAUNCH: a frame asking for a photograph is scaffolding, not design.
  // It is right for showing Patricia where her pictures go; it should not still be
  // on the site the day it opens to customers. Either the photographs land, or the
  // empty slots come out.
  const showBriefing = process.env.NODE_ENV !== 'production';

  return (
    <div
      role="img"
      aria-label={art.hint ?? art.alt}
      className={`bb-frame flex ${art.ratio} flex-col items-center justify-center gap-3 px-4 text-center ${frameClassName}`}
    >
      {/* corner sparkles, so an empty slot still looks designed */}
      <Sparkle size={14} className="absolute left-4 top-4" opacity={0.7} />
      <Sparkle size={10} className="absolute bottom-5 right-5" opacity={0.5} />

      {/* compact slots (the small showcase cards) skip the illustration hint
          and the pixel line — there simply is not room for them */}
      {!compact && (
        <svg width="72" height="96" viewBox="0 0 72 96" fill="none" stroke="#ff4b8b" strokeWidth="0.9" aria-hidden="true" className="opacity-40">
          <path d="M36 6c9 0 15 7 15 16 0 6-3 10-3 14 0 5 12 9 15 22 3 12 2 22 2 32H7c0-10-1-20 2-32 3-13 15-17 15-22 0-4-3-8-3-14 0-9 6-16 15-16Z" strokeLinejoin="round" />
        </svg>
      )}

      {/* The ask. Small on a compact card, where the frame is only ~140px wide. */}
      {art.hint && (
        <p
          className={`max-w-[14rem] leading-relaxed text-bbInk/55 ${
            compact ? 'text-[11px]' : 'text-sm'
          }`}
        >
          {art.hint}
        </p>
      )}

      {showBriefing && (
        <>
          <p className="bb-eyebrow">{art.label}</p>
          <p className="max-w-[16rem] text-xs leading-relaxed text-bbInk/45">{art.note}</p>

          {!compact && (
            <p className="text-[10px] uppercase tracking-[0.18em] text-bbInk/25">
              {art.width}&times;{art.height} · transparent PNG
            </p>
          )}
        </>
      )}
    </div>
  );
}

