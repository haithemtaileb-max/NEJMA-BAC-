# Importing "QCM UMMTO classés par cours" PDFs

`parse_ummto_pdf.py` turns the Word-exported PDFs (Embryologie, Anatomie S2,
Histologie, Physiologie — 1re année médecine 2023-2024) into
`src/content/imported/ummto-2023-24/*.json`, which feed `supabase/seed.sql`
and demo mode.

```bash
python3 -m venv .venv && .venv/bin/pip install pypdf
.venv/bin/python scripts/import-qcm/parse_ummto_pdf.py ~/Downloads/qcm-pdfs/
npm run db:seed:generate        # rewrite supabase/seed.sql
npm test                        # checks ids, keys, drafts, seed drift
```

## What gets published

A question is **published** only if it has a corrigé-type key, at least two
propositions labelled A, B, C… in order, a key that only cites existing
propositions, and no dependency on a picture or on another question.

Everything else is imported as a **draft**. Drafts go to the database but
students never see them. Each one carries:

- tags `a-revoir:<reason>`: `no_key`, `needs_image`, `ambiguous_key`,
  `open_question`, `too_few_options`, `bad_option_labels`, `key_not_in_options`;
- a note in `explanation` with the reasons, the original key and the PDF page.

A moderator fixes the draft (adds the key or the picture, rewrites the
explanation) and sets `status = 'published'`.

Keys are copied as printed in the PDF (CT). Students can report a wrong key
with the "Signaler" button.

## Adding a module

1. Add a `Source(...)` entry in `SOURCES`, with the page where each course
   starts (the PDF's "Les Cours / Which page?" table).
2. Add the same course slugs to the module in `src/content/curriculum.ts`
   (new course numbers only, never reuse one).
3. Import the JSON in `src/content/imported/index.ts`.
4. Run the three commands above.

Question ids are derived from the module, course, exam label, number, stem
and propositions. Re-importing a new version of a PDF keeps the ids of
unchanged questions, so students' history is preserved.
