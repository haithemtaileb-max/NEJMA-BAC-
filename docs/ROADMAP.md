# Implementation roadmap

Phases are ordered by value to students. Each phase is shippable on its own.

## Phase 0 — Foundations ✅ (this repository)

- [x] Next.js 16 App Router, TypeScript strict, Tailwind 4, ESLint, Vitest, CI
- [x] Supabase schema: curriculum, QCM bank, exams, flashcards (FSRS), summaries, 3D models
- [x] RLS + column privileges + RPCs, tested on PostgreSQL (26 tests)
- [x] FR/EN routing and translations (next-intl), locale switcher
- [x] Demo mode: runs without Supabase on bundled sample content
- [x] Starter UMMTO curriculum (6 tracks, 54 modules) + 36 sample QCMs, generated `seed.sql`

## Phase 1 — MVP: practise and simulate ✅ (this repository)

- [x] E-mail/password auth, confirmation callback, protected routes
- [x] Onboarding wizard: major → year → confirm, changeable later
- [x] Personalised dashboard: stats, modules with progress, recent exams
- [x] Course QCM practice: instant feedback, per-option explanations, bookmarks, error reports, keyboard shortcuts
- [x] Exam simulator: module selection, balanced random draw, countdown, flags, navigator, autosave, auto hand-in, mark /20, per-module breakdown, full correction
- [x] 3D anatomy viewer: GLB loading, select / isolate / hide / X-ray, search, Sketchfab fallback

**Before launch**
- [ ] Validate the module lists in `src/content/curriculum.ts` with the faculty programme; add units/courses
- [ ] Import real QCM banks (see Phase 3 importer) — at least ~200 questions per module
- [ ] Configure Supabase Auth e-mails (French templates, custom SMTP), site URL, redirect URLs
- [ ] Add the first GLB model(s) to the `anatomy-models` bucket
- [ ] Deploy (Vercel + Supabase, EU region), set up uptime monitoring and error tracking (e.g. Sentry)

## Phase 2 — Flashcards & summaries

Database, RLS and the FSRS engine (`src/lib/srs/scheduler.ts`) already exist; these phases add screens and actions.

- [ ] **Review session** `/flashcards/review`: due queue (`flashcard_progress.due <= now()` + new cards/day limit), flip card, Again/Hard/Good/Easy with `previewIntervals()` shown under each button, `review()` → upsert progress + insert log
- [ ] **Deck library**: official decks per course, my decks, decks added via share code (`add_deck_to_library`)
- [ ] **Deck editor**: create/edit/reorder cards (Markdown + image upload), visibility private/unlisted/public, share link, fork a deck
- [ ] **Summaries** `/summaries`: filter by module/tag, full-text search (`summaries.search`), PDF viewer (pdf.js via `react-pdf`, signed URLs from the private bucket), Markdown reader (`react-markdown` + `remark-gfm`)
- [ ] **Upload flow**: students upload PDF → `pending_review` → moderator approves/rejects with a note
- [ ] Dashboard tiles become live: cards due today, streak

## Phase 3 — Content operations & quality

- [ ] **Admin area** (`role in ('moderator','admin')`): CRUD for modules/units/courses, QCM editor with preview, publish workflow
- [ ] **Bulk importer**: CSV/Excel of past exams (énoncé, A–E, key, explanation, source, year) → validation report → draft QCMs. Many banks circulate as spreadsheets; this is the fastest way to reach volume
- [ ] **Report triage**: queue of `qcm_reports`, accept → edit question, notify reporter
- [ ] Question statistics: success rate and discrimination per question (from `qcm_attempts`) to spot flawed items
- [ ] Tags & "annales" filters (source/year) in practice mode

## Phase 4 — Engagement

- [ ] Bookmarks page and "retry my mistakes" sets
- [ ] Weak-topic recommendations from `user_module_stats`
- [ ] Study streaks, weekly goals, optional anonymous leaderboard per promotion
- [ ] PWA: installable, offline cache of started sets (important with unstable mobile data)
- [ ] Push/e-mail reminders for due flashcards and exam dates

## Phase 5 — Scale & polish

- [ ] Generate `database.types.ts` (`supabase gen types`) and type the Supabase client end-to-end
- [ ] Caching of curriculum reads (`use cache` / Cache Components) and CDN for GLB files
- [ ] Per-student FSRS parameter optimisation from review logs
- [ ] Accessibility audit (WCAG 2.2 AA), RTL-ready layout if Arabic/Tamazight UI is added
- [ ] Native wrapper (Expo) reusing the domain/lib layer
