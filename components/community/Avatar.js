/**
 * AVATAR — a member's picture, or her initials when she has not uploaded one.
 *
 * Shared by the chat, the member list, the profile card and the profile form, so
 * a woman looks the same everywhere she appears.
 *
 * A plain <img> rather than next/image: these are user uploads served straight
 * from /uploads, and next/image would add an optimisation round-trip we do not
 * want on an island connection. `loading="lazy"` keeps a long member list from
 * fetching every picture at once.
 */

function initials(name) {
  return (
    String(name ?? '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

/**
 * @param {{
 *   name: string,
 *   src?: string|null,
 *   size?: number,
 *   tone?: 'default'|'rose'|'hidden',
 *   fit?: 'cover'|'contain',
 *   className?: string,
 * }} props
 *
 * `fit` is 'cover' for photographs — a face should fill the square rather than
 * float in it. Patricia's picture is the BOSS BADDIE logo, which is 868×538, so
 * cropping it to a square would cut a third of the mark off; she gets 'contain',
 * which fits the whole mark inside the box with a little room around it.
 */
export default function Avatar({
  name,
  src = null,
  size = 32,
  tone = 'default',
  fit = 'cover',
  className = '',
}) {
  // Founder rows and your own messages get the rose treatment; everyone else the
  // quiet outline.
  const tones = {
    default: 'border-bbLine text-bbInk/55',
    rose: 'border-bbRose/50 bg-bbRose/15 text-bbBlush',
    hidden: 'border-transparent text-transparent',
  };

  const box = { width: size, height: size };

  if (src && tone !== 'hidden') {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        style={box}
        className={`shrink-0 border border-bbLine ${
          fit === 'contain' ? 'bg-bbCoal object-contain p-1' : 'object-cover'
        } ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={box}
      className={`flex shrink-0 items-center justify-center border text-[10px] font-semibold ${
        tones[tone] ?? tones.default
      } ${className}`}
    >
      {initials(name)}
    </span>
  );
}
