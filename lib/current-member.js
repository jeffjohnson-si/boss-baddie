import { OWNER_AUTHOR } from '@/lib/community';
import { currentAdmin } from '@/lib/current-admin';
import { currentCustomer } from '@/lib/current-customer';

/**
 * Who is in The Baddies Corner, on the server.
 *
 * THERE IS ONE ACCOUNT NOW. A shop account and a community account used to be two
 * different things — a member row in a JSON file with its own password and its
 * own cookie — which meant a woman could sign up in the shop and then be asked
 * to register again to join the conversation. She is now a `customers` row and
 * nothing else: registering (with the texted code) is what opens the room, and the
 * same phone number signs her in everywhere.
 *
 * Two kinds of viewer are accepted:
 *   - Patricia, on her admin session. She has no customer row, so without this she
 *     would be locked out of her own community.
 *   - Any signed-in customer.
 *
 * The admin session wins when both cookies exist, and the order matters: only
 * Patricia can hold an admin session (12 hours, password typed), while a customer
 * cookie lasts 60 days and may be a forgotten test account.
 *
 * @returns {Promise<{id:string,name:string,avatar:string|null,isOwner:boolean}|null>}
 */
export async function currentRoomViewer() {
  // The admin session wins when both cookies exist. currentAdmin() also checks
  // the database session version, so a reset signs the old cookie out.
  if (await currentAdmin()) {
    return { ...OWNER_AUTHOR, avatar: null, isOwner: true, profileComplete: true };
  }

  const customer = await currentCustomer();
  if (!customer) return null;

  return {
    id: customer.id,
    // Her community name if she chose one, otherwise the account name.
    name: customer.displayName ?? customer.name,
    avatar: customer.avatar ?? null,
    isOwner: false,
    profileComplete: Boolean(customer.communityProfileSetAt),
  };
}
