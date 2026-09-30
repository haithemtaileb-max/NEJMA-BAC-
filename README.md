# Nejma Med

Plateforme d'entraînement pour les étudiants de **1re et 2e année** en **Médecine, Chirurgie dentaire
et Pharmacie** de la Faculté de Médecine de l'**Université Mouloud Mammeri de Tizi Ouzou (UMMTO)**.

Study platform for 1st/2nd-year Medicine, Dentistry and Pharmacy students at UMMTO — French & English UI.

| | |
| --- | --- |
| 🎯 **Onboarding** | Pick major (Médecine / Dentaire / Pharmacie) and year (L1 / L2) → tailored dashboard |
| ✅ **QCM par cours** | Module → unit → course, instant correction, explanation per proposition, bookmarks, error reports, keyboard shortcuts — **793 real UMMTO QCMs** (Embryologie, Anatomie S2, Histologie, Physiologie) with AI explanations that follow the corrigé type and flag doubtful keys |
| ⏱️ **Examen blanc** | Timed, module-balanced random paper, autosave, flags, auto hand-in, mark /20, per-module analytics, full correction |
| 🧠 **Flashcards (FSRS)** | Schema + Anki-grade scheduler ready (`src/lib/srs`); review UI in the next phase |
| 📄 **Résumés** | Schema, moderation flow and private storage ready; reader/upload UI in the next phase |
| 🦴 **Anatomie 3D** | React Three Fiber viewer: rotate, zoom, select, isolate, hide, X-ray; GLB/Draco or Sketchfab |

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Motion · lucide-react ·
Supabase (Postgres + RLS + Auth + Storage) · next-intl · React Three Fiber / drei · ts-fsrs · zod · Vitest.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000 — runs in demo mode without any configuration
```

Connect Supabase, create an admin, deploy: **[docs/SETUP.md](docs/SETUP.md)**.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — stack rationale, directory layout, data model (ERD), security model, flows
- [Roadmap](docs/ROADMAP.md) — what is done, what comes next
- [Setup](docs/SETUP.md) — step-by-step local and production setup
- [Déploiement Firebase](docs/DEPLOY-FIREBASE.md) — mise en ligne avec Firebase App Hosting (en français)
- [3D models](public/models/README.md) — free anatomy models and how to prepare them

## Scripts

| Command | |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript (with generated route types) |
| `npm test` | Unit tests (+ database tests when `TEST_DATABASE_URL` is set) |
| `npm run db:start` · `db:reset` · `db:stop` | Local Supabase (Docker) |
| `npm run db:seed:generate` | Regenerate `supabase/seed.sql` from `src/content` |

> ⚠️ The starter module lists in `src/content/curriculum.ts` are indicative. Check them against the
> official UMMTO programme for the current academic year before going live.
