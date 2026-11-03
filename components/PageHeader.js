import { SparkleField, FloralOverlay } from '@/components/Decor';

/**
 * PageHeader — the shared banner for inner pages.
 *
 * Keeps spacing, type scale and atmosphere identical across Our Story, Shop and
 * Contact, so the site reads as one magazine rather than separate templates.
 *
 * @param {{
 *   eyebrow?: string,
 *   title: string,
 *   intro?: string,
 *   children?: React.ReactNode
 * }} props
 */
export default function PageHeader({ eyebrow, title, intro, children }) {
  return (
    <section className="relative overflow-hidden border-b border-bbLine">
      <SparkleField density="sm" />
      <FloralOverlay corners="right" />

      <div className="bb-container relative py-14 sm:py-20">
        {eyebrow && <p className="bb-eyebrow">{eyebrow}</p>}

        <h1 className="mt-4 max-w-3xl font-display text-[32px] font-normal leading-[1.08] tracking-tight text-bbInk sm:text-[52px]">
          {title}
        </h1>

        {intro && <p className="bb-prose mt-6 max-w-2xl">{intro}</p>}

        {children}
      </div>
    </section>
  );
}
