/**
 * The public origin of the site, used to build absolute links in emails.
 *
 * NEXT_PUBLIC_SITE_URL is the source of truth on a deployed host. During local
 * development it is usually unset, so the request's own origin is used instead.
 */
export function siteOrigin(request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      console.error(
        `[site-url] NEXT_PUBLIC_SITE_URL is not a valid URL: "${configured}".`,
      );
    }
  }

  try {
    return new URL(request.url).origin;
  } catch {
    return 'http://localhost:3000';
  }
}
