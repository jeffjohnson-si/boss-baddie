import Link from 'next/link';
import AdminAuthShell from '@/components/admin/AdminAuthShell';
import AdminLoginForm from '@/components/admin/AdminLoginForm';
import { hasAdmin } from '@/lib/admin-store';

export const metadata = {
  title: 'Owner Sign In',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * ADMIN LOGIN — /admin/login
 *
 * The one door into the admin side, and Patricia's alone. Credentials are checked
 * against the database account; while no account exists yet, the environment pair
 * is accepted as a bootstrap and the "create the owner account" link is shown.
 *
 * This is a SERVER component so it can decide whether to offer the development
 * shortcut: with DEV_LOGIN_ENABLED=1 a "Skip Admin Login" link appears, and the
 * route behind it refuses to run without that same flag. In production the flag is
 * unset, so neither the link nor the route exists.
 */
export default async function AdminLoginPage() {
  let adminExists = true;
  try {
    adminExists = await hasAdmin();
  } catch (err) {
    console.error('[admin/login] could not check for an owner account:', err.message);
  }

  return (
    <AdminAuthShell
      title="Owner sign in"
      subtitle="Patricia only. This page is not indexed and not linked from the site."
    >
      <AdminLoginForm />

      <div className="mt-6 flex flex-col gap-2 text-center text-xs">
        <Link href="/admin/forgot" className="bb-link">
          Forgot password?
        </Link>
        {!adminExists && (
          <Link href="/admin/register" className="bb-link">
            Create the owner account
          </Link>
        )}
      </div>

      {/* DEVELOPMENT ONLY. The route behind this link returns a plain 404
          unless DEV_LOGIN_ENABLED=1, so the shortcut cannot follow the app to
          production even if the link were somehow rendered. */}
      {process.env.DEV_LOGIN_ENABLED === '1' && (
        <a
          href="/api/dev/admin-login?next=/admin"
          className="bb-btn-outline mt-4 block w-full text-center"
        >
          Skip Admin Login (Development)
        </a>
      )}
    </AdminAuthShell>
  );
}
