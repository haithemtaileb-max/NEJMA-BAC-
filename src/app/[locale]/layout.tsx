import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { locale as localeParam } from 'next/root-params';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { DemoBanner } from '@/components/layout/demo-banner';
import { routing } from '@/i18n/routing';

import '../globals.css';

const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', display: 'swap' });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  return {
    title: { default: t('title'), template: '%s · Nejma Med' },
    description: t('description'),
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1016' },
  ],
};

/** Root layout: every route lives under /fr or /en. */
export default async function LocaleLayout({ children }: LayoutProps<'/[locale]'>) {
  const locale = await localeParam();
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html lang={locale} className={inter.variable}>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        {/* Messages and locale are inherited from i18n/request.ts. */}
        <NextIntlClientProvider>
          <DemoBanner />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
