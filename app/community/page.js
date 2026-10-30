import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import Testimonials from '@/components/Testimonials';
import { Sparkle } from '@/components/Decor';
import { currentCustomer } from '@/lib/current-customer';

/**
 * COMMUNITY — what the sisterhood actually does, and the door into the room.
 *
 * THE DOOR IS THE SHOP ACCOUNT. There is no separate community membership any
 * more: no "join the community" form, no second password, no application. A woman
 * who has registered — and confirmed the code texted to her — is already a member,
 * so this page offers exactly two things to somebody signed out (create an account,
 * or sign in) and one to somebody signed in: enter the room.
 *
 * Instagram stays underneath, because that is where these women already are, and
 * the conversation should not be the only way in.
 */

const OFFERS = [
  {
    title: 'Monthly meet-ups',
    copy: 'A borrowed room in Honiara, a whiteboard, and whoever can make it. We work on one real problem each time — pricing, suppliers, or getting paid on time.',
  },
  {
    title: 'Accountability circles',
    copy: 'Small groups of four or five women who check in weekly. You say what you will do, and someone notices whether you did it.',
  },
  {
    title: 'Skill sessions',
    copy: 'Practical things: photographing your product on a phone, writing a caption that sells, keeping a simple record of money in and money out.',
  },
  {
    title: 'Supplier sharing',
    copy: 'Who is reliable, who is not, and what a fair landed price actually looks like. Information that is usually kept quiet.',
  },
];

// The door depends on whether she is signed in, so no static caching.
export const dynamic = 'force-dynamic';

export default async function CommunityPage() {
  const customer = await currentCustomer();

  return (
    <>
      <PageHeader
        eyebrow="Community"
        title="No woman builds it alone."
        intro="The sisterhood is the part of BOSS BADDIE that does not have a price. It is women in the Solomon Islands helping each other get a business off the ground, in public, without pretending it is easy."
      >
        {/* The door sits above the fold: a woman who already knows she wants in
            should not have to read the whole page to find it. */}
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          {customer ? (
            <Link href="/community/inside" className="bb-btn-solid w-full sm:w-auto">
              Enter The Baddies Corner
            </Link>
          ) : (
            <>
              <Link
                href="/account/register?next=/community/inside"
                className="bb-btn-solid w-full sm:w-auto"
              >
                Create An Account
              </Link>
              <Link
                href="/account/login?next=/community/inside"
                className="bb-btn-outline w-full sm:w-auto"
              >
                Sign In
              </Link>
            </>
          )}

          <a
            href="https://www.instagram.com/boss.baddieee"
            target="_blank"
            rel="noopener noreferrer"
            className="bb-btn-outline w-full sm:w-auto"
          >
            Follow On Instagram
          </a>
        </div>

        {customer ? (
          <p className="mt-5 text-xs text-bbInk/40">
            Signed in as {customer.name}. Your account is your way into the room — there is nothing
            else to join.
          </p>
        ) : (
          <p className="mt-5 text-xs leading-relaxed text-bbInk/40">
            One account, one password. The same sign-in you use in the shop opens the conversation —
            there is no separate community registration.
          </p>
        )}
      </PageHeader>

      {/* ---------------- What we do ---------------- */}
      <section className="bb-section">
        <div className="bb-container">
          <header className="max-w-2xl">
            <p className="bb-eyebrow">What Happens</p>
            <h2 className="bb-h2 mt-4">Four things we run, and keep running.</h2>
          </header>

          <div className="bb-rule mt-10" />

          <ul className="mt-10 grid gap-x-12 gap-y-10 sm:grid-cols-2 sm:gap-y-14">
            {OFFERS.map((offer) => (
              <li key={offer.title}>
                <Sparkle size={13} opacity={0.9} />
                <h3 className="bb-h3 mt-4">{offer.title}</h3>
                <p className="bb-prose mt-3 max-w-md">{offer.copy}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Testimonials />
    </>
  );
}
