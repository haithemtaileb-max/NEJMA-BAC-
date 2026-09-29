'use client';

import { CircleCheck, Flag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { reportQcmAction } from '@/server/actions/qcm';
import type { DataErrorCode } from '@/server/data/repository';
import type { ReportReason } from '@/types/domain';

const REASONS: ReportReason[] = ['wrong_answer', 'ambiguous', 'typo', 'outdated', 'other'];

/** "Report a flawed question" — native <dialog>, so focus trapping and Esc come for free. */
export function ReportDialog({ qcmId }: { qcmId: string }) {
  const t = useTranslations();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<'idle' | 'sent' | DataErrorCode>('idle');
  const [isPending, startTransition] = useTransition();

  function open() {
    setStatus('idle');
    dialogRef.current?.showModal();
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await reportQcmAction({
        qcmId,
        reason: formData.get('reason') as ReportReason,
        message: String(formData.get('message') ?? ''),
      });
      setStatus(result.ok ? 'sent' : result.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        title={t('qcm.report')}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <Flag className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">{t('qcm.report')}</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`report-${qcmId}`}
        className="m-auto w-[min(100%-2rem,28rem)] rounded-2xl border border-border bg-card p-0 text-foreground shadow-xl"
      >
        <div className="p-6">
          <h2 id={`report-${qcmId}`} className="text-lg font-semibold">
            {t('report.title')}
          </h2>

          {status === 'sent' ? (
            <div className="mt-4 space-y-4">
              <p className="flex items-start gap-2 rounded-xl bg-success-soft p-3 text-sm text-success">
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {t('report.thanks')}
              </p>
              <Button variant="secondary" className="w-full" onClick={() => dialogRef.current?.close()}>
                {t('common.close')}
              </Button>
            </div>
          ) : (
            <form action={submit} className="mt-4 space-y-4">
              <fieldset>
                <legend className="text-sm font-medium">{t('report.reason')}</legend>
                <div className="mt-2 grid gap-1.5">
                  {REASONS.map((reason, i) => (
                    <label key={reason} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                      <input type="radio" name="reason" value={reason} defaultChecked={i === 0} className="accent-[var(--primary)]" />
                      {t(`report.reasons.${reason}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="block text-sm font-medium">
                {t('report.message')}
                <textarea
                  name="message"
                  rows={3}
                  maxLength={1000}
                  placeholder={t('report.messagePlaceholder')}
                  className="mt-1.5 block w-full rounded-xl border border-border bg-background p-3 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              {status !== 'idle' && <p className="text-sm text-danger">{t(`errors.${status}`)}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => dialogRef.current?.close()}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {t('report.submit')}
                </Button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
