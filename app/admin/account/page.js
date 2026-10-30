import Link from 'next/link';
import { redirect } from 'next/navigation';
import BrandLogo from '@/components/BrandLogo';
import AdminNav from '@/components/admin/AdminNav';
import AdminAccountForm from '@/components/admin/AdminAccountForm';
import { currentAdmin } from '@/lib/current-admin';
import { readRecoveryEmails } from '@/lib/admin-store';

export const metadata = {
  title: 'Owner Account',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * /admin/account — the owner's name, password and recovery addresses.
 *
 * Only a real database admin can use it. The env bootstrap has no row to attach
 * recovery addresses to, so it is sent to register instead.
 */
export default async function AdminAccountPage() {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login?next=/admin/account');

  if (admin.id === 'env') {
    return (
      <section className="bb-section !pt-10">
        <div className="bb-container">
          <header className="border-b border-bbLine pb-8">
            <BrandLogo size="md" />
            <h1 className="bb-h2 mt-5">Account</h1>
          </header>

          <p className="bb-prose mt-6">
            You are signed in with the bootstrap credentials. Create the owner account to choose
            your own password and add recovery emails.
          </p>

          <Link href="/admin/register" className="bb-btn-solid mt-6 inline-block">
            Create Owner Account
          </Link>
        </div>
      </section>
    );
  }

  const recoveryEmails = await readRecoveryEmails(admin.id);

  // Never pass password_hash to a client component.
  const safeAdmin = {
    id: admin.id,
    email: admin.email,
    displayName: admin.displayName,
  };

  return (
    <section className="bb-section !pt-10">
      <div className="bb-container">
        <header className="flex flex-col gap-6 border-b border-bbLine pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <BrandLogo size="md" />
            <h1 className="bb-h2 mt-5">Account</h1>
          </div>
          <AdminNav current="/admin/account" />
        </header>

        <p className="mt-4 max-w-xl text-sm leading-relaxed text-bbInk/50">
          This is the owner login. Reset links go to the sign-in address and every verified
          recovery address.
        </p>

        <div className="mx-auto mt-10 max-w-2xl">
          <AdminAccountForm admin={safeAdmin} recoveryEmails={recoveryEmails} />
        </div>
      </div>
    </section>
  );
}
