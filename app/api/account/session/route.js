import { NextResponse } from 'next/server';
import {
  CUSTOMER_COOKIE,
  customerCookieOptions,
  isSecureRequest,
} from '@/lib/customer-auth';

/**
 * DELETE /api/account/session — sign out.
 *
 * Signing IN is now the passwordless two-step flow at
 * /api/account/login/request and /api/account/login/verify.
 */
export async function DELETE(request) {
  const response = NextResponse.json({ ok: true });
  // Same attributes as when it was set, or some browsers keep the old cookie.
  response.cookies.set(CUSTOMER_COOKIE, '', {
    ...customerCookieOptions({ secure: isSecureRequest(request) }),
    maxAge: 0,
  });
  return response;
}
