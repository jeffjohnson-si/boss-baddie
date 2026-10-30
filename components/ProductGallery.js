'use client';

import { useState } from 'react';
import ProductArt from '@/components/ProductArt';

/**
 * ProductGallery — the pictures on a product page.
 *
 * One large frame with a row of thumbnails beneath it. With fewer than two
 * photos there is nothing to switch between, so the thumbnail strip is not
 * rendered at all rather than shown as a single dead button.
 *
 * When a product has no photos yet this falls through to ProductArt, which draws
 * the plain BOSS BADDIE placeholder tile — so a product page never looks broken
 * while Patricia is still shooting the range.

 *
 * A client component only because selecting a thumbnail is state. The photos
 * themselves are plain <img>: they are already sized for the web on upload, and
 * a gallery of next/image instances would queue several optimiser requests on a
 * connection that cannot spare them.
 *
 * @param {{ product: object }} props
 */
export default function ProductGallery({ product }) {
  const images = product.images ?? [];
  const [active, setActive] = useState(0);

  // Guard the index rather than trusting it: the product could be edited to have
  // fewer photos while someone has the page open.
  const current = images[active] ?? images[0] ?? null;

  return (
    <div>
      <div className="relative aspect-[5/6] overflow-hidden border border-bbLine bg-[#080406]">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current}
            alt={`${product.title} — photo ${active + 1} of ${images.length}`}
            // The first photo is the largest thing above the fold on this page,
            // so it loads eagerly; the thumbnails are tiny either way.
            loading="eager"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <ProductArt product={product} />
        )}

        {product.badge && (
          <span className="absolute left-0 top-4 bg-bbRose px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-black">
            {product.badge}
          </span>
        )}
      </div>

      {images.length > 1 && (
        <ul className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-5">
          {images.map((src, index) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Show photo ${index + 1}`}
                aria-current={index === active}
                className={`block aspect-square w-full overflow-hidden border transition-colors ${
                  index === active ? 'border-bbRose' : 'border-bbLine hover:border-bbRose/50'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
