import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { AnatomyViewerLazy } from '@/components/anatomy/anatomy-viewer-lazy';
import { SketchfabEmbed } from '@/components/anatomy/sketchfab-embed';
import { PageHeader } from '@/components/layout/page-header';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/utils/cn';
import { localized } from '@/lib/utils/localized';
import { getRepository } from '@/server/data';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('anatomy'))('title') };
}

export default async function AnatomyPage({ params, searchParams }: PageProps<'/[locale]/anatomy'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [t, models, query] = await Promise.all([getTranslations('anatomy'), getRepository().listAnatomyModels(), searchParams]);
  const current = models.find((m) => m.slug === query.model) ?? models[0] ?? null;
  const sketchfabId = current?.modelUrl.startsWith('sketchfab:') ? current.modelUrl.slice('sketchfab:'.length) : null;

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {models.length > 1 && (
        <nav className="mb-4 flex flex-wrap gap-2">
          {models.map((m) => (
            <Link
              key={m.id}
              href={{ pathname: '/anatomy', query: { model: m.slug } }}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition',
                m.id === current?.id ? 'border-primary bg-primary-soft text-primary' : 'border-border hover:bg-muted',
              )}
            >
              {localized(m.title, locale)}
            </Link>
          ))}
        </nav>
      )}

      {sketchfabId && current ? (
        <SketchfabEmbed modelId={sketchfabId} title={localized(current.title, locale)} />
      ) : (
        <AnatomyViewerLazy
          model={current ? { url: current.modelUrl, attribution: current.attribution, license: current.license, structures: current.structures } : null}
        />
      )}
    </>
  );
}
