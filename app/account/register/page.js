import { redirect } from 'next/navigation';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import { SparkleField } from '@/components/Decor';
import RegisterForm from '@/components/account/RegisterForm';
import { currentCustomer } from '@/lib/current-customer';

/**
 * CREATE ACCOUNT — /account/register
 *
 * The phone number is the handle; a texted code proves it. Signing up signs her in,
 * because there is no email to verify and nothing to wait for. There is no password.
 *
 * WHY AN ACCOUNT IS REQUIRED TO ORDER NOW: it is what makes her orders follow her
 * to a new phone. Before this, an invoice lived only in the browser that placed
 * the order.
 */

export const metadata = {
  title: 'Create Account',
  description: 'Create a BOSS BADDIE account to order, and to keep your invoices with you.',
  robots: { index: false, follow: false },
};

function safeNext(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/account';
}

export default async function RegisterPage({ searchParams }) {
  const params = await searchParams;
  const next = safeNext(params?.next);

  const customer = await currentCustomer();
  if (customer) redirect(next);

  return (
    <section className="relative overflow-hidden py-14 sm:py-20">
      <SparkleField density="sm" />

      <div className="bb-container relative">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="flex justify-center">
            <BrandLogo size="xl" priority />
          </Link>

          <p className="bb-eyebrow mt-9 text-center">Join The Shop</p>
          <h1 className="mt-3 text-center font-display text-3xl text-bbInk">
            Create your account.
          </h1>
          <p className="mt-2 text-center text-sm leading-relaxed text-bbInk/50">
            One account keeps your orders, invoices and collection details together — and follows
            you to a new phone.
          </p>

          <RegisterForm next={next} />

          {/* DEVELOPMENT ONLY — see the same block on the sign-in page. */}
          {process.env.DEV_LOGIN_ENABLED === '1' && (
            <a
              href={`/api/dev/login?next=${encodeURIComponent(next)}`}
              className="bb-btn-outline mt-4 w-full text-center"
            >
              Skip Sign-Up (Development)
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
