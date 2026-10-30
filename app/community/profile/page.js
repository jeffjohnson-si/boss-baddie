import { redirect } from 'next/navigation';

/**
 * COMMUNITY PROFILE — retired in favour of the account profile.
 *
 * A member and a customer are the same person now, so there is one place to change
 * a name, a village, a contact email or a password: /account/profile. Keeping a
 * second form here would mean the same details in two places, and eventually two
 * different answers.
 */
export const dynamic = 'force-dynamic';

export default function CommunityProfilePage() {
  redirect('/account/profile');
}
