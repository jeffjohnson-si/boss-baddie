import { Sparkle } from '@/components/Decor';
import { primaryImage } from '@/lib/products';

/**
 * ProductArt — the product image, or a placeholder when there is none.
 *
 * REAL PHOTOGRAPHY WINS. If the product has an uploaded photo, images[0] is
 * rendered and nothing else here runs. Patricia uploads from /admin/products.
 *
 * Photos are optional, so the fallback has to be presentable rather than
 * apologetic: a plain branded tile in the palette. It used to be a set of
 * generated SVG mockups picked per product with an `art` field, but that field
 * is gone — one more thing to choose for every item, for a drawing that a real
 * photo replaces anyway. One placeholder for everything now.
 *
 * It stays inline SVG (well under a kilobyte) rather than an image file, which
 * matters on a slow island connection.
 *
 * Anything that passes a product to this component must include `images`, or
 * every tile shows the placeholder.
 */

const ROSE = '#ff4b8b';
const GOLD = '#e3b873';
const BURGUNDY = '#701938';

export default function ProductArt({ product, className = '' }) {
  // Prefer real photography the moment it exists.
  const photo = primaryImage(product);
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={product.title}
        loading="lazy"
        decoding="async"
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 200 240"
      role="img"
      aria-label={`${product.title} — photo coming soon`}
      className={`h-full w-full ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* studio backdrop: near-black with a faint burgundy floor bounce */}
      <rect width="200" height="240" fill="#080406" />
      <ellipse cx="100" cy="222" rx="70" ry="12" fill={BURGUNDY} opacity="0.5" />

      {/* the mark, centred — nested <svg> anchors top-left, so shift by half */}
      <g transform="translate(100 106)">
        <g transform="translate(-17 -17)">
          <Sparkle size={34} color={ROSE} />
        </g>
        <text
          x="0"
          y="42"
          textAnchor="middle"
          fill="#f8f8f8"
          fontSize="7"
          letterSpacing="2.6"
          fontFamily="Georgia, serif"
        >
          BOSS BADDIE
        </text>
      </g>

      {/* two restrained gold sparkles — the brief asks not to over-decorate */}
      <g transform="translate(26 30)">
        <Sparkle size={11} color={GOLD} opacity={0.7} />
      </g>
      <g transform="translate(168 196)">
        <Sparkle size={8} color={GOLD} opacity={0.5} />
      </g>
    </svg>
  );
}
