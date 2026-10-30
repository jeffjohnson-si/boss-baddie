import { redirect } from 'next/navigation';

/**
 * JOIN — retired.
 *
 * There is no separate community sign-up any more. An account created in the shop,
 * on the account pages or here is the same account, and confirming the texted code
 * is what opens the community. Old links and bookmarks (and anything in a WhatsApp
 * message from before the change) land on the one registration form there is, and
 * come back to the room afterwards.
 */
export const dynamic = 'force-dynamic';

export default function JoinPage() {
  redirect('/account/register?next=/community/inside');
}
