'use client';

/**
 * PrintButton — hands the page to the browser's own print dialog.
 *
 * The only reason this is a client component: `window.print()` cannot be called
 * from a server component. Everything it prints is server-rendered.
 *
 * There is deliberately no PDF library anywhere in this project. Every phone and
 * laptop browser can already "Save as PDF" from this dialog, and a PDF generator
 * would be a large download on an island connection for a document the browser
 * makes for free. The `@media print` rules in app/globals.css hide the rest of the
 * page so only the `.bb-doc` document reaches the paper.
 */
export default function PrintButton({ children = 'Print Or Save', className = '' }) {
  return (
    <button type="button" onClick={() => window.print()} className={`bb-no-print ${className}`}>
      {children}
    </button>
  );
}
