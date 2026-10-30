import { redirect } from 'next/navigation';
import AdminAuthShell from '@/components/admin/AdminAuthShell';
import AdminRegisterForm from '@/components/admin/AdminRegisterForm';
import { hasAdmin } from '@/lib/admin-store';

export const metadata = {
  title: 'Create Owner Account',
  robots: { index: false, follow: false },
};

// Reads the admin table, so never prerender it.
export const dynamic = 'force-dynamic';

/**
 * /admin/register — the one-time owner account.
 *
 * Once admin_users has a row this page redirects to sign-in. The API enforces the
 * same rule, so a direct POST cannot create a second admin either.
 */
export default async function AdminRegisterPage() {
  if (await hasAdmin()) redirect('/admin/login');

  return (
    <AdminAuthShell
      title="Create the owner account"
      subtitle="This page closes as soon as the first account exists. Use an email you can open — reset links go there."
    >
      <AdminRegisterForm />
    </AdminAuthShell>
  );
}
