import type messages from '../messages/fr.json';
import type { routing } from './i18n/routing';

// Type-safe translation keys and locales across the app.
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
