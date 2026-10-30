import BrandLogo from '@/components/BrandLogo';
import { SparkleField } from '@/components/Decor';

/**
 * The shared frame for the owner-only auth screens: logo, title, subtitle, form.
 * Keeps /admin/login, /admin/register, /admin/forgot and /admin/reset from
 * drifting apart visually.
 */
export default function AdminAuthShell({ title, subtitle, children }) {
  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-center overflow-hidden">
      <SparkleField density="sm" />

      <div className="bb-container relative">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex justify-center">
            <BrandLogo size="xl" priority />
          </div>

          <h1 className="mt-8 text-center font-display text-2xl text-bbInk">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-center text-xs leading-relaxed text-bbInk/45">{subtitle}</p>
          )}

          {children}
        </div>
      </div>
    </section>
  );
}
