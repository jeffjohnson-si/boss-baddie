import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import IllustrationPlaceholder from '@/components/IllustrationPlaceholder';
import { SparkleField } from '@/components/Decor';

/**
 * Hero — the editorial opener.
 *
 * Layout follows the approved reference:
 *   Desktop — LEFT is the brand lockup with the reserved portrait card sitting
 *             over its right edge; RIGHT is the "Become Her" headline stack
 *             with a single segmented CTA pill.
 *   Mobile  — the same blocks stacked: lockup, portrait, then the copy.
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
        {/* ---------- LEFT: brand lockup + reserved portrait ---------- */}
        <div className="relative flex flex-col items-center lg:block">
          {/* In flow on mobile; absolute and IN FRONT of the portrait from lg up,
              so the tail of the "BADDIE" wordmark crosses over her card exactly
              as in the reference. That overlap is why this instance uses the
              alpha-cut copy of the mark (`transparent`) — the supplied
              /logo.png has no alpha and would paint a black box over her.
              pointer-events-none so the transparent area cannot swallow clicks.

              The calc pins the lockup 8px inside the shell's LEFT EDGE at any
              width, which is as far left as it can go without the logo being
              cropped — and the mark must never be cropped.
                -32px            escapes the container's 40px padding to the shell edge
                max(0px, ...)    adds back the shell margin that only exists once
                                 the shell is wider than the 1240px container
              1304px = 1240px container + the shell's 2×32px outer margin. */}
          <div className="mb-8 lg:pointer-events-none lg:absolute lg:top-1/2 lg:z-20 lg:mb-0 lg:-translate-y-1/2 lg:left-[calc(-32px_-_max(0px,(100vw_-_1304px)/2))]">
            <BrandLogo
              size="2xl"
              priority
              transparent
              className="h-[120px] w-auto sm:h-[150px] lg:h-[300px]"
            />
          </div>

          {/* Patricia's own photograph. 1240x1644 is within 1% of the 3:4 frame,
              so `cover` trims a hair off each side and nothing else moves.
              priority + cover: this is the page's largest above-the-fold image. */}
          <div className="relative z-10 w-full max-w-[280px] sm:max-w-[320px] lg:ml-auto lg:mr-0 lg:max-w-[330px]">
            <IllustrationPlaceholder
              slot="hero"
              priority
              fit="cover"
              sizes="(max-width: 1024px) 70vw, 24vw"
              frameClassName="rounded-3xl"
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
