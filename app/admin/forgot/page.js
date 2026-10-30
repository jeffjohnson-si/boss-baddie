import AdminAuthShell from '@/components/admin/AdminAuthShell';
import AdminForgotForm from '@/components/admin/AdminForgotForm';

export const metadata = {
  title: 'Reset Owner Password',
  robots: { index: false, follow: false },
};

/** /admin/forgot — request a one-time reset link by email. */
export default function AdminForgotPage() {
  return (
    <AdminAuthShell
      title="Reset your password"
      subtitle="We will email a 30-minute link to the sign-in address and any verified recovery address."
    >
      <AdminForgotForm />
    </AdminAuthShell>
  );
}
