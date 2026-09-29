import { locale as localeParam } from 'next/root-params';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { routing } from './routing';

/**
 * Per-request i18n config for Server Components.
 *
 * The locale comes from the `[locale]` root segment via `next/root-params`,
 * unless a caller passes one explicitly (e.g. `getTranslations({ locale })`).
 * Server Actions cannot read root params, so they always pass the locale.
 */
export default getRequestConfig(async ({ locale }) => {
  const requested = locale ?? (await localeParam());
  const resolved = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale: resolved,
    messages: (await import(`../../messages/${resolved}.json`)).default,
    timeZone: 'Africa/Algiers',
  };
});
