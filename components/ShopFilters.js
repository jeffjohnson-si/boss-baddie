'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { CATEGORIES } from '@/lib/products';

/**
 * ShopFilters — the minimal sidebar filters.
 *
 * Filter state lives in the URL query string, not in React state. That choice
 * matters here:
 *   - the filtered page is server-rendered HTML, so a cheap phone does no work
 *   - a filtered view can be bookmarked, shared and linked to from the footer
 *   - the back button behaves the way people expect
 *
 * This component only writes to the URL; app/shop/page.js reads it and does the
 * filtering on the server.
 *
 * @param {{ resultCount: number, categoryCounts: Record<string, number> }} props
 *   categoryCounts is how many live products sit in each category, counted on the
 *   server. All five categories are always listed — they are part of what the shop
 *   says it sells — and the count simply tells the customer what is in stock right
 *   now, so a category showing 0 reads as an empty shelf rather than a dead filter.
 *
 * Category is a SINGLE choice: picking one replaces the last, the way a shop's
 * department list works. Radio inputs rather than checkboxes, so the control looks
 * like what it does and a screen reader announces "one of six" instead of implying
 * several can be combined.
 */
export default function ShopFilters({ resultCount, categoryCounts = {} }) {
  const router = useRouter();
  const params = useSearchParams();

  const activeCategories = params.get('category')?.split(',').filter(Boolean) ?? [];
  const sort = params.get('sort') ?? 'featured';
  const hasFilters = activeCategories.length > 0 || sort !== 'featured';

  // Exactly one row is ever ticked. Reading only the first value means an old link
  // carrying `?category=phone,journals` still renders sanely instead of lighting up
  // two radios in the same group.
  const selected = activeCategories[0] ?? '';

  // Everything in the shop, for the "All" row. Summed from the per-category counts
  // the server sent rather than passed separately, so the two can never disagree.
  const totalCount = Object.values(categoryCounts).reduce((sum, n) => sum + n, 0);

  /** Rewrite one query key and push the new URL. */
  function update(key, values) {
    const next = new URLSearchParams(params.toString());
    if (values.length === 0) next.delete(key);
    else next.set(key, values.join(','));

    const qs = next.toString();
    // scroll:false keeps the reader where they were in a long product list.
    router.push(qs ? `/shop?${qs}` : '/shop', { scroll: false });
  }

  /** Show one category only. An empty id means "All", i.e. no filter at all. */
  function selectCategory(id) {
    update('category', id ? [id] : []);
  }


  function changeSort(value) {
    const next = new URLSearchParams(params.toString());
    if (value === 'featured') next.delete('sort');
    else next.set('sort', value);
    const qs = next.toString();
    router.push(qs ? `/shop?${qs}` : '/shop', { scroll: false });
  }

  return (
    // Deliberately NOT sticky: the sidebar (filters and the payment note under
    // them) scrolls away with the page instead of following the viewport, which
    // read as a bug on a long grid.
    <div>
      {/* On mobile the whole sidebar collapses into a <details> so it never
          pushes the product grid below the fold. Open by default on desktop. */}
      <details open className="group">
        <summary className="flex min-h-[48px] cursor-pointer items-center justify-between border-b border-bbLine lg:pointer-events-none">
          <span className="bb-eyebrow">Filter</span>
          <span className="flex items-center gap-3 text-xs text-bbInk/45">
            {resultCount} item{resultCount === 1 ? '' : 's'}
            <span aria-hidden="true" className="transition-transform group-open:rotate-180 lg:hidden">
              &#9662;
            </span>
          </span>
        </summary>

        <div className="pt-6">
          {/* ---- Category ---- */}
          {/* Every category is always listed, so a customer can see the full range
              the shop covers and filter by it. The number beside each one is what
              is in stock today. */}
          <FilterGroup title="Category">
            {/* "All" is the unfiltered view, and it is the default. Naming it means
                the group always has something ticked, so the customer can see at a
                glance what she is looking at. */}
            <PickRow
              label="All"
              count={totalCount}
              checked={selected === ''}
              onChange={() => selectCategory('')}
            />

            {CATEGORIES.map((cat) => (
              <PickRow
                key={cat.id}
                label={cat.label}
                count={categoryCounts[cat.id] ?? 0}
                checked={selected === cat.id}
                onChange={() => selectCategory(cat.id)}
              />
            ))}
          </FilterGroup>

          {/* ---- Sort ---- */}

          <FilterGroup title="Sort">
            <label className="block">
              <span className="sr-only">Sort products</span>
              <select value={sort} onChange={(e) => changeSort(e.target.value)} className="bb-input !py-2.5 !text-sm">
                <option value="featured">Featured first</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="name">Name A-Z</option>
              </select>
            </label>
          </FilterGroup>

          {hasFilters && (
            <button
              type="button"
              onClick={() => router.push('/shop', { scroll: false })}
              className="mt-2 min-h-[44px] text-[11px] font-semibold uppercase tracking-[0.2em] text-bbRose underline-offset-4 hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      </details>
    </div>
  );
}

function FilterGroup({ title, children }) {
  return (
    <fieldset className="mb-7">
      <legend className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-bbInk/45">
        {title}
      </legend>
      <div className="space-y-0.5">{children}</div>
    </fieldset>
  );
}

/**
 * One choice in a single-select group, with a 44px tap target and how many items
 * sit behind it.
 *
 * A radio rather than a checkbox: only one category applies at a time, and the
 * shared `name` is what makes the browser and assistive tech treat the rows as one
 * group where picking a new one releases the last.
 */
function PickRow({ label, count, checked, onChange }) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm text-bbInk/75 hover:text-bbInk">
      <input
        type="radio"
        name="category"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 accent-bbRose"
      />
      <span className="flex-1">{label}</span>
      {/* Showing the count sets the expectation before she taps, so a category
          with one item does not feel like a filter that failed. */}
      <span className="text-xs text-bbInk/40">{count}</span>
    </label>
  );
}


