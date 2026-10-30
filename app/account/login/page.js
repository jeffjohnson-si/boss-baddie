import { redirect } from 'next/navigation';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import { SparkleField } from '@/components/Decor';
import LoginForm from '@/components/account/LoginForm';
import { currentCustomer } from '@/lib/current-customer';

/**
 * SIGN IN — /account/login
 *
 * Server component shell; only the form is client-side. Already signed in? There
 * is nothing to do here, so she is sent straight on to wherever she was headed.
 *
 * `next` comes from the URL and is passed through untouched to the client form,
 * which is the component that validates it before navigating. It only ever ends up
 * as a router destination, never in a fetch.
 */

export const metadata = {
  title: 'Sign In',
  description: 'Sign in to your BOSS BADDIE account to see your orders and invoices.',
  robots: { index: false, follow: false },
};

function safeNext(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/account';
}

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const next = safeNext(params?.next);

  const customer = await currentCustomer();
  if (customer) redirect(next);

  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-center overflow-hidden py-14">
      <SparkleField density="sm" />

      <div className="bb-container relative">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="flex justify-center">
            <BrandLogo size="xl" priority />
          </Link>

          <p className="bb-eyebrow mt-9 text-center">Your Account</p>
          <h1 className="mt-3 text-center font-display text-3xl text-bbInk">Welcome back.</h1>
          <p className="mt-2 text-center text-sm leading-relaxed text-bbInk/50">
            Your orders, invoices and collection details — on any phone you sign in from.
          </p>

          <LoginForm next={next} />

          {/* DEVELOPMENT ONLY. Rendered only when the env flag is set, and the
              route behind it refuses to run without the same flag. */}
          {process.env.DEV_LOGIN_ENABLED === '1' && (
            <a
              href={`/api/dev/login?next=${encodeURIComponent(next)}`}
              className="bb-btn-outline mt-4 w-full text-center"
            >
              Skip Sign-In (Development)
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
