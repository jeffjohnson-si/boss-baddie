import AdminAuthShell from '@/components/admin/AdminAuthShell';
import AdminResetForm from '@/components/admin/AdminResetForm';

export const metadata = {
  title: 'Choose A New Password',
  robots: { index: false, follow: false },
};

/** /admin/reset?token=... — the landing page for a reset link. */
export default async function AdminResetPage({ searchParams }) {
  const { token } = await searchParams;

  return (
    <AdminAuthShell
      title="Choose a new password"
      subtitle="The link works once and expires 30 minutes after it was requested."
    >
      <AdminResetForm token={typeof token === 'string' ? token : ''} />
    </AdminAuthShell>
  );
}
