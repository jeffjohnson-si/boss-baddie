import { redirect } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import CommunitySetupForm from '@/components/community/CommunitySetupForm';
import { currentCustomer } from '@/lib/current-customer';
import { isCommunityProfileComplete } from '@/lib/customers';

/**
 * COMMUNITY SETUP — /community/setup
 *
 * The one step between having an account and sitting in the room: the name she
 * wants the sisterhood to see, and a picture. Her phone number was set when she
 * registered and is simply shown here, not asked for again — and it appears beside
 * her name in the chat.
 *
 * Anyone who has already done this goes straight in, so a bookmarked link cannot
 * trap someone in a form they finished months ago.
 */

export const metadata = {
  title: 'Set Up Your Community Profile',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function CommunitySetupPage() {
  const customer = await currentCustomer();
  if (!customer) redirect('/account/login?next=/community/setup');
  if (isCommunityProfileComplete(customer)) redirect('/community/inside');

  return (
    <>
      <PageHeader
        eyebrow="The Baddies Corner"
        title="One thing before you go in."
        intro="Choose the name the room sees, and add a picture if you want one. Your phone number is already on your account — you do not need to type it again."
      />

      <section className="bb-section">
        <div className="bb-container">
          <div className="mx-auto max-w-lg">
            <CommunitySetupForm
              defaultName={customer.communityName || customer.name}
              phoneDisplay={customer.phoneDisplay}
              currentAvatar={customer.avatar}
            />
          </div>
        </div>
      </section>
    </>
  );
}
