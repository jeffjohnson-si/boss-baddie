import Image from 'next/image';

/**
 * BrandLogo — the official BOSS BADDIE mark.
 *
 * The artwork is used UNCHANGED, exactly as supplied: feminine hands doing a
 * snap gesture with pink nails, a sun-burst sparkle behind the fingers, the
 * bold white "BOSS BADDIE" wordmark and the small gold crown by "BOSS".
 * Do not recolour, crop or redraw it.
 *
 * next/image handles the heavy lifting: the 868x538 source is served as a
 * width-appropriate AVIF (a few KB) instead of the full 254 KB PNG.
 */

const LOGO_SRC = '/logo.png';

/**
 * Alpha-cut copy of the SAME artwork — identical pixels, the flat near-black
 * backdrop knocked out. The supplied /logo.png has no alpha channel, so laying
 * it over another image would paint a black rectangle. Used only where the mark
 * must sit ON TOP of artwork (the hero lockup overlapping the portrait).
 */
const LOGO_SRC_TRANSPARENT = '/logo-mark.png';

const LOGO_RATIO = 868 / 538; // intrinsic aspect ratio of the supplied file

/** Rendered heights in px, keyed by the `size` prop. */
const HEIGHTS = {
  sm: 46, // header on mobile
  md: 60, // header on desktop
  lg: 78, // footer
  xl: 132, // login screen, mobile hero
  '2xl': 300, // desktop hero lockup
};

export default function BrandLogo({
  size = 'md',
  className = '',
  priority = false,
  transparent = false,
}) {
  const height = HEIGHTS[size] ?? HEIGHTS.md;

  return (
    <Image
      src={transparent ? LOGO_SRC_TRANSPARENT : LOGO_SRC}
      alt="BOSS BADDIE"
      width={Math.round(height * LOGO_RATIO)}
      height={height}
      priority={priority}
      className={className}
    />
  );
}
