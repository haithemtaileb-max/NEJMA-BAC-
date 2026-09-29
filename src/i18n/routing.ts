import { defineRouting } from 'next-intl/routing';

/**
 * UI languages. French is the default: it is the teaching language of the
 * faculty and the language of the QCM content.
 */
export const routing = defineRouting({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'always',
});

export type AppLocale = (typeof routing.locales)[number];
