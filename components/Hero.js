import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import { SparkleField } from '@/components/Decor';

/**
 * Hero — the editorial opener.
 *
 * Layout:
 *   Desktop — LEFT is the brand lockup on its own; RIGHT is the "Become Her"
 *             headline stack with a single segmented CTA pill.
 *   Mobile  — the same blocks stacked: lockup, then the copy.
 *
 * There is deliberately no hero photograph. The mark and the headline carry the
 * opening screen, which keeps the page light for slow connections and leaves
 * the photography to the showcase row below.
 *
 * The logo is rendered ONCE and repositioned with CSS rather than duplicated
 * per breakpoint — two <Image> instances would mean two downloads, and a
 * hidden one still costs bandwidth on a slow connection.
 *
 * Server component: the largest above-the-fold block ships zero JavaScript.
 */
export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <SparkleField density="sm" />

      <div className="bb-container relative grid items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10 lg:py-14">
        {/* ---------- LEFT: brand lockup ---------- */}
        <div className="relative flex flex-col items-center lg:block">
          {/* In flow on mobile; absolute from lg up. From xl the lockup is
              centred in the left half, so the mark and the headline read as a
              balanced pair. Between lg and xl it stays pinned to the shell's
              left edge: a 484px lockup will not centre inside that narrower
              column without crowding the headline.
              pointer-events-none so the transparent area cannot swallow clicks.

              `w-max` is load-bearing, not decoration: without it the absolute
              box shrink-to-fits the space from `left` to the column's right
              edge, and the global `img { max-width: 100% }` then clamps the
              width while the fixed height stays — which squashes the mark.

              The calc pins the lockup 8px inside the shell's LEFT EDGE:
                -32px            escapes the container's 40px padding to the shell edge
                max(0px, ...)    adds back the shell margin that only exists once
                                 the shell is wider than the 1240px container
              1304px = 1240px container + the shell's 2×32px outer margin. */}
          <div className="mb-8 lg:pointer-events-none lg:absolute lg:top-1/2 lg:z-20 lg:mb-0 lg:w-max lg:left-[calc(-32px_-_max(0px,(100vw_-_1304px)/2))] lg:-translate-y-1/2 xl:left-1/2 xl:-translate-x-1/2">
            <BrandLogo
              size="2xl"
              priority
              transparent
              className="h-[120px] w-auto sm:h-[150px] lg:h-[300px]"
            />
          </div>
        </div>

        {/* ---------- RIGHT: headline stack ---------- */}
        <div className="animate-riseIn text-center lg:text-left">
          <h1 className="font-display text-[52px] font-normal leading-[0.92] tracking-tight text-bbInk sm:text-[76px] lg:text-[84px] xl:text-[100px]">
            Become Her
          </h1>

          <p className="mx-auto mt-6 max-w-[34ch] text-base leading-[1.65] text-bbInk/75 sm:text-lg lg:mx-0 lg:text-xl">
            Boss Baddie is a space for women to build confidence, start small businesses, and grow
            mentally, physically and spiritually.
          </p>

          {/* One pill, two destinations — the reference treats the CTAs as a
              single object rather than two competing buttons. */}
          <div className="mt-9 flex justify-center lg:justify-start">
            <div className="bb-segment">
              <Link href="/our-story">
                Discover Our Story
                <svg width="7" height="11" viewBox="0 0 7 11" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                  <path d="M1 1l4.5 4.5L1 10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link href="/shop">Shop Essentials</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
