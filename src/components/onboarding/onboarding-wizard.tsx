'use client';

import { ArrowLeft, ArrowRight, Check, CircleAlert, Pill, Stethoscope } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { ToothIcon } from '@/components/ui/tooth-icon';
import { cn } from '@/lib/utils/cn';
import { completeOnboarding } from '@/server/actions/onboarding';
import type { DataErrorCode } from '@/server/data/repository';
import { MAJORS, STUDY_YEARS, type Major, type StudyYear } from '@/types/domain';

const MAJOR_ICONS = { medicine: Stethoscope, dentistry: ToothIcon, pharmacy: Pill } as const;
const STEPS = 3;

interface OnboardingWizardProps {
  initialMajor: Major | null;
  initialYear: StudyYear | null;
}

/**
 * Step 1: major → step 2: year → step 3: confirm.
 * The choice drives every dashboard query, so it is saved server-side
 * (profiles.major / profiles.study_year) before entering the app.
 */
export function OnboardingWizard({ initialMajor, initialYear }: OnboardingWizardProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [major, setMajor] = useState<Major | null>(initialMajor);
  const [year, setYear] = useState<StudyYear | null>(initialYear);
  const [error, setError] = useState<DataErrorCode | null>(null);
  const [isPending, startTransition] = useTransition();

  const go = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const canContinue = (step === 0 && major) || (step === 1 && year);

  function submit() {
    if (!major || !year) return;
    setError(null);
    startTransition(async () => {
      // Redirects to the dashboard on success; only returns on failure.
      const result = await completeOnboarding({ locale, major, studyYear: year });
      if (!result.ok) setError(result.error);
    });
  }

  const MajorIcon = major ? MAJOR_ICONS[major] : Stethoscope;

  return (
    <div className="w-full max-w-2xl">
      {/* Step indicator */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-muted-foreground">{t('onboarding.step', { current: step + 1, total: STEPS })}</p>
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={cn('h-1.5 rounded-full transition-all', i <= step ? 'w-8 bg-primary' : 'w-4 bg-border')} />
          ))}
        </div>
      </div>

      <div className="relative min-h-[380px]">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.section
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {step === 0 && (
              <>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('onboarding.majorTitle')}</h1>
                <p className="mt-2 text-muted-foreground">{t('onboarding.majorSubtitle')}</p>
                <div role="radiogroup" aria-label={t('onboarding.majorTitle')} className="mt-6 grid gap-3">
                  {MAJORS.map((m) => {
                    const Icon = MAJOR_ICONS[m];
                    return (
                      <ChoiceCard key={m} selected={major === m} onSelect={() => setMajor(m)}>
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
                          <Icon className="h-6 w-6" />
                        </span>
                        <span>
                          <span className="block font-semibold">{t(`majors.${m}`)}</span>
                          <span className="mt-0.5 block text-sm text-muted-foreground">{t(`majorDescriptions.${m}`)}</span>
                        </span>
                      </ChoiceCard>
                    );
                  })}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('onboarding.yearTitle')}</h1>
                <p className="mt-2 text-muted-foreground">{t('onboarding.yearSubtitle')}</p>
                <div role="radiogroup" aria-label={t('onboarding.yearTitle')} className="mt-6 grid gap-3 sm:grid-cols-2">
                  {STUDY_YEARS.map((y) => (
                    <ChoiceCard key={y} selected={year === y} onSelect={() => setYear(y)} className="flex-col items-start">
                      <span className="text-4xl font-bold text-primary">{t(`yearsShort.${y}`)}</span>
                      <span>
                        <span className="block font-semibold">{t(`years.${y}`)}</span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">{t(`onboarding.yearHint.${y}`)}</span>
                      </span>
                    </ChoiceCard>
                  ))}
                </div>
              </>
            )}

            {step === 2 && major && year && (
              <div className="text-center">
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-lg"
                >
                  <MajorIcon className="h-10 w-10" />
                </motion.span>
                <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">{t('onboarding.confirmTitle')}</h1>
                <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 font-medium text-primary">
                  {t(`majors.${major}`)} · {t(`years.${year}`)}
                </p>
                <p className="mx-auto mt-4 max-w-sm text-sm text-muted-foreground">{t('onboarding.confirmSubtitle')}</p>
                {error && (
                  <p role="alert" className="mx-auto mt-4 flex max-w-sm items-center justify-center gap-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
                    <CircleAlert className="h-4 w-4" aria-hidden="true" />
                    {t(`errors.${error}`)}
                  </p>
                )}
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0 || isPending} className={cn(step === 0 && 'invisible')}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('common.back')}
        </Button>
        {step < STEPS - 1 ? (
          <Button onClick={() => go(step + 1)} disabled={!canContinue}>
            {t('onboarding.next')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button size="lg" onClick={submit} disabled={isPending}>
            {t('onboarding.confirm')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}

function ChoiceCard({
  selected,
  onSelect,
  className,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'relative flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left shadow-sm transition sm:p-5',
        selected ? 'border-primary ring-2 ring-primary/25' : 'border-border hover:border-primary/40 hover:bg-muted/40',
        className,
      )}
    >
      {children}
      <span
        aria-hidden="true"
        className={cn(
          'absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full border transition',
          selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
        )}
      >
        {selected && <Check className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}
