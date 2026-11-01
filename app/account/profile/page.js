import { redirect } from 'next/navigation';
import Link from 'next/link';
import ProfileForm from '@/components/account/ProfileForm';
import SignOutButton from '@/components/account/SignOutButton';
import { currentCustomer } from '@/lib/current-customer';

/**
 * PROFILE & SETTINGS — /account/profile
 *
 * Gated in the server component, and again in every route the forms post to.
 * If she is signed out, she goes to sign in and comes straight back here.
 */

export const metadata = {
  title: 'Profile & Settings',
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const customer = await currentCustomer();
  if (!customer) redirect('/account/login?next=/account/profile');

  return (
    <section className="bb-section !pt-10">
      <div className="bb-container">
        <nav aria-label="Breadcrumb" className="text-xs text-bbInk/40">
          <Link href="/account" className="hover:text-bbRose">
            Your Account
          </Link>{' '}
          <span aria-hidden="true">/</span> Profile &amp; Settings
        </nav>

        <header className="mt-5 border-b border-bbLine pb-8">
          <p className="bb-eyebrow">Your Account</p>
          <h1 className="bb-h2 mt-3">Profile &amp; settings</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-bbInk/50">
            Change what we use to reach you. Sign-in is a texted code, so there is no password here.
          </p>
        </header>

        <div className="mx-auto mt-10 max-w-2xl">
          <ProfileForm customer={customer} />

          <div className="mt-10 flex flex-col gap-3 border-t border-bbLine pt-8 sm:flex-row">
            <Link href="/account" className="bb-btn-outline w-full text-center sm:w-auto">
              Back To Your Orders
            </Link>
            <SignOutButton />
          </div>
        </div>
      </div>
    </section>
  );
}
