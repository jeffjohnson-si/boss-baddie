import Link from 'next/link';
import { SparkleField } from '@/components/Decor';

/**
 * 404 — kept on-brand and short. A dead end should still offer a way forward.
 */
export default function NotFound() {
  return (
    <section className="relative flex min-h-[60vh] items-center overflow-hidden">
      <SparkleField density="sm" />

      <div className="bb-container relative text-center">
        <p className="bb-eyebrow">404</p>

        <h1 className="mt-4 font-display text-[32px] leading-tight text-bbInk sm:text-[52px]">
          That page has moved on. So should we.
        </h1>

        <p className="bb-prose mx-auto mt-5 max-w-lg">
          The link is broken or the page no longer exists. Try the shop, or start again from the top.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/shop" className="bb-btn-solid w-full sm:w-auto">
            Explore Shop
          </Link>
          <Link href="/" className="bb-btn-outline w-full sm:w-auto">
            Back Home
          </Link>
        </div>
      </div>
    </section>
  );
}
