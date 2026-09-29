import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';

import { routing } from '@/i18n/routing';
import { refreshSession } from '@/lib/supabase/proxy';

const handleI18nRouting = createIntlMiddleware(routing);

/** Pages reachable without an account (after the locale prefix). */
const PUBLIC_PATHS = new Set(['', '/login', '/register']);

/**
 * Runs before every page request:
 *   1. next-intl picks the locale (`/fr/...`, `/en/...`) and redirects if missing;
 *   2. the Supabase session is refreshed;
 *   3. signed-out visitors are sent to the login page for app routes.
 * Onboarding (major/year) is enforced in the app layout, which has the profile.
 */
export async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);
  if (response.headers.has('location')) return response; // locale redirect: nothing else to do

  const { signedIn } = await refreshSession(request, response);

  const [, locale, ...rest] = request.nextUrl.pathname.split('/');
  const path = rest.length ? `/${rest.join('/')}` : '';
  if (!signedIn && !PUBLIC_PATHS.has(path)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  // Everything except Next internals, route handlers (/api, /auth) and files with an extension.
  matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)'],
};
