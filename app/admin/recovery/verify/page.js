import Link from 'next/link';
import AdminAuthShell from '@/components/admin/AdminAuthShell';
import { verifyRecoveryEmail } from '@/lib/admin-store';

export const metadata = {
  title: 'Confirm Recovery Email',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * /admin/recovery/verify?token=... — the landing page for a recovery-email
 * confirmation. The token is the authorisation, so this works even if she opens
 * the email on a phone where she is not signed in.
 */
export default async function RecoveryVerifyPage({ searchParams }) {
  const { token } = await searchParams;
  const verified = typeof token === 'string' && token
    ? await verifyRecoveryEmail(token)
    : null;

  return (
    <AdminAuthShell
      title={verified ? 'Recovery email confirmed' : 'This link did not work'}
      subtitle={
        verified
          ? 'It will now receive password-reset links.'
          : 'It is invalid, already used, or older than 24 hours.'
      }
    >
      <div className="mt-10 space-y-5 text-center">
        {verified ? (
          <p className="border border-green-500/40 bg-green-500/10 p-4 text-sm text-green-300">
            {verified.email} is verified.
          </p>
        ) : (
          <p className="border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-300">
            Ask for a new confirmation from the Account page.
          </p>
        )}

        <Link href="/admin/account" className="bb-btn-solid block w-full text-center">
          Go To Account
        </Link>

        {!verified && (
          <Link href="/admin/forgot" className="bb-btn-outline block w-full text-center">
            Reset Password Instead
          </Link>
        )}
      </div>
    </AdminAuthShell>
  );
}
