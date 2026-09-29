'use client';

import { CircleAlert, Eye, EyeOff, Focus, Info, Layers, RotateCcw, ScanEye, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import { localized } from '@/lib/utils/localized';
import type { LocalizedText } from '@/types/domain';

import { AnatomyCanvas, type AnatomyViewState } from './anatomy-canvas';
import { DEMO_STRUCTURES } from './demo-skeleton';

export interface AnatomyViewerProps {
  /** null → built-in demo skeleton. */
  model: { url: string; attribution: string; license: string; structures: Record<string, LocalizedText> } | null;
}

/** "Femur_L.001" → "Femur L" when a mesh has no translated label. */
const prettify = (name: string) => name.replace(/\.\d+$/, '').replace(/[_-]+/g, ' ').trim();

/**
 * 3D anatomy atlas: rotate / zoom / pan (OrbitControls), click to select,
 * isolate or hide structures, X-ray mode. Works with any GLB whose meshes are
 * named after structures.
 */
export default function AnatomyViewer({ model }: AnatomyViewerProps) {
  const t = useTranslations('anatomy');
  const locale = useLocale();
  const labels = model?.structures ?? DEMO_STRUCTURES;

  const [structures, setStructures] = useState<string[]>([]);
  const [view, setView] = useState<AnatomyViewState>({ selected: null, hidden: new Set(), isolate: false, xray: false });
  const [resetKey, setResetKey] = useState(0);
  const [query, setQuery] = useState('');
  const [failed, setFailed] = useState(false);

  const labelOf = (key: string) => (labels[key] ? localized(labels[key], locale) : prettify(key));
  const collator = useMemo(() => new Intl.Collator(locale), [locale]);
  const visibleList = structures
    .map((key) => ({ key, label: labelOf(key) }))
    .filter(({ label }) => label.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => collator.compare(a.label, b.label));

  const select = (selected: string | null) => setView((v) => ({ ...v, selected, isolate: selected ? v.isolate : false }));
  const toggleHidden = (key: string) =>
    setView((v) => {
      const hidden = new Set(v.hidden);
      if (hidden.has(key)) hidden.delete(key);
      else hidden.add(key);
      return { ...v, hidden, selected: hidden.has(key) && v.selected === key ? null : v.selected };
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card className="relative h-[62vh] min-h-[420px] overflow-hidden bg-gradient-to-b from-card to-muted/60 lg:h-[72vh]">
        {failed ? (
          <p className="flex h-full items-center justify-center gap-2 p-6 text-center text-sm text-danger">
            <CircleAlert className="h-4 w-4" aria-hidden="true" />
            {t('loadError')}
          </p>
        ) : (
          <AnatomyCanvas
            modelUrl={model?.url ?? null}
            view={view}
            resetKey={resetKey}
            onSelect={select}
            onStructures={setStructures}
            onError={() => setFailed(true)}
            loadingLabel={t('loading')}
          />
        )}

        {/* Toolbar */}
        <div className="absolute inset-x-3 top-3 flex flex-wrap gap-2">
          <ToolbarButton active={view.isolate} disabled={!view.selected} onClick={() => setView((v) => ({ ...v, isolate: !v.isolate }))} icon={Focus} label={t('isolate')} />
          <ToolbarButton disabled={!view.selected} onClick={() => view.selected && toggleHidden(view.selected)} icon={EyeOff} label={t('hide')} />
          <ToolbarButton active={view.xray} onClick={() => setView((v) => ({ ...v, xray: !v.xray }))} icon={ScanEye} label={t('xray')} />
          <ToolbarButton
            disabled={!view.hidden.size && !view.isolate}
            onClick={() => setView((v) => ({ ...v, hidden: new Set(), isolate: false }))}
            icon={Eye}
            label={t('showAll')}
          />
          <ToolbarButton onClick={() => setResetKey((k) => k + 1)} icon={RotateCcw} label={t('reset')} />
        </div>

        {/* Selection chip */}
        <div className="absolute inset-x-3 bottom-3 flex justify-center">
          <p className="rounded-full bg-card/90 px-4 py-1.5 text-sm shadow backdrop-blur">
            {view.selected ? (
              <>
                <span className="text-muted-foreground">{t('selected')} </span>
                <span className="font-semibold text-primary">{labelOf(view.selected)}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{t('noSelection')}</span>
            )}
          </p>
        </div>
      </Card>

      <Card className="flex max-h-[72vh] flex-col p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
          {t('structures')}
          <span className="ml-auto text-xs font-normal text-muted-foreground">{structures.length}</span>
        </h2>
        <label className="relative mt-3 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search')}
            aria-label={t('search')}
            className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <ul className="-mx-1 mt-3 flex-1 space-y-0.5 overflow-y-auto">
          {visibleList.map(({ key, label }) => {
            const hidden = view.hidden.has(key);
            return (
              <li key={key} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => select(view.selected === key ? null : key)}
                  aria-pressed={view.selected === key}
                  className={cn(
                    'flex-1 truncate rounded-lg px-2.5 py-1.5 text-left text-sm transition',
                    view.selected === key ? 'bg-primary-soft font-medium text-primary' : 'hover:bg-muted',
                    hidden && 'text-muted-foreground line-through',
                  )}
                >
                  {label}
                </button>
                <button
                  type="button"
                  onClick={() => toggleHidden(key)}
                  aria-label={`${hidden ? t('showAll') : t('hide')} — ${label}`}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  {hidden ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 flex gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {model ? t('credits', { attribution: model.attribution, license: model.license }) : t('demoModel')}
        </p>
      </Card>
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  active,
  ...props
}: { icon: React.ComponentType<{ className?: string }>; label: string; active?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      size="sm"
      variant="secondary"
      aria-pressed={active}
      className={cn('bg-card/90 backdrop-blur', active && 'border-primary bg-primary-soft text-primary')}
      {...props}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
