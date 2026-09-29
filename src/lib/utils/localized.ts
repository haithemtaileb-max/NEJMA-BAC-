import type { LocalizedText } from '@/types/domain';

/** Pick the UI-language variant of a bilingual field, falling back to French. */
export function localized(text: LocalizedText, locale: string): string {
  return (locale === 'en' ? text.en : text.fr) || text.fr;
}
