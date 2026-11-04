import BrandLogo from '@/components/BrandLogo';

/**
 * LOADING — what the browser shows while the server renders the next page.
 *
 * There was no loading state at all, which made every navigation feel slower
 * than it was: the page sat on the old content, unchanged, until the new HTML
 * arrived. This gives an immediate response so a slow render reads as "working"
 * rather than "broken".
 *
 * Deliberately small and server-rendered — no spinner library, no client
 * JavaScript, nothing that would itself need loading.
 */
export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-[55vh] items-center justify-center py-20"
    >
      <div className="flex flex-col items-center gap-6">
        <BrandLogo size="md" className="animate-pulse opacity-60" />
        <span className="h-px w-24 animate-pulse bg-bbRose/50" />
        <span className="sr-only">Loading</span>
      </div>
    </section>
  );
}
