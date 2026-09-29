-- =============================================================================
-- NEJMA MED — Initial schema
-- Faculty of Medicine, Mouloud Mammeri University of Tizi Ouzou (UMMTO)
-- Scope: L1 / L2 — Medicine, Dentistry (Chirurgie dentaire), Pharmacy
--
-- Layout
--   1. Types & domains
--   2. Reference data: majors
--   3. Users: profiles
--   4. Curriculum: modules → units → courses
--   5. QCM bank: qcms, qcm_options, attempts, bookmarks, reports
--   6. Exam simulator: exam_sessions, exam_session_questions
--   7. Flashcards (FSRS): decks, cards, progress, review logs, library
--   8. Summaries (résumés) + anatomy models
--   9. Helper functions, triggers
--  10. RPCs (the only way to see answers / score exams)
--  11. Row Level Security + column privileges
--  12. Storage buckets & policies
--
-- Security model in one paragraph: every table has RLS enabled. Correct
-- answers (`qcm_options.is_correct`, `qcm_options.explanation`,
-- `qcms.explanation`) are NOT selectable by API roles; they are only returned
-- by SECURITY DEFINER RPCs *after* the student has committed an answer
-- (`answer_qcm`) or submitted an exam (`submit_exam`). Exam scoring happens
-- in the database, so the client cannot forge a score.
-- =============================================================================

create schema if not exists private;

-- -----------------------------------------------------------------------------
-- 1. Types & domains
-- -----------------------------------------------------------------------------
create type public.major_code     as enum ('medicine', 'dentistry', 'pharmacy');
create type public.user_role      as enum ('student', 'contributor', 'moderator', 'admin');
create type public.app_locale     as enum ('fr', 'en');
create type public.content_status as enum ('draft', 'pending_review', 'published', 'rejected', 'archived');
create type public.qcm_type       as enum ('single', 'multiple');       -- QCS / QCM
create type public.scoring_mode   as enum ('all_or_nothing', 'partial');
create type public.exam_status    as enum ('in_progress', 'submitted', 'expired');
create type public.attempt_mode   as enum ('practice', 'exam');
create type public.report_reason  as enum ('wrong_answer', 'ambiguous', 'typo', 'outdated', 'other');
create type public.report_status  as enum ('open', 'accepted', 'rejected', 'resolved');
create type public.deck_visibility as enum ('private', 'unlisted', 'public');
create type public.srs_state      as enum ('new', 'learning', 'review', 'relearning');
create type public.summary_format as enum ('pdf', 'markdown');

-- The platform only covers the first two years (L1 / L2).
create domain public.study_year as smallint check (value in (1, 2));

-- A QCM proposition label: A, B, C, D, E (up to H for long items).
create domain public.option_label as text check (value ~ '^[A-H]$');

-- -----------------------------------------------------------------------------
-- 2. Reference data: majors
-- -----------------------------------------------------------------------------
create table public.majors (
  code        public.major_code primary key,
  name_fr     text not null,
  name_en     text not null,
  sort_order  smallint not null default 0
);

insert into public.majors (code, name_fr, name_en, sort_order) values
  ('medicine',  'Médecine',          'Medicine',  1),
  ('dentistry', 'Chirurgie dentaire', 'Dentistry', 2),
  ('pharmacy',  'Pharmacie',         'Pharmacy',  3);

-- -----------------------------------------------------------------------------
-- 3. Users: profiles (1:1 with auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text check (char_length(display_name) <= 80),
  avatar_url    text,
  major         public.major_code references public.majors (code),
  study_year    public.study_year,
  locale        public.app_locale not null default 'fr',
  role          public.user_role not null default 'student',
  onboarded_at  timestamptz,           -- stamped by trigger when major+year are first set
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Onboarding picks both at once: never one without the other.
  constraint profiles_major_year_together check ((major is null) = (study_year is null))
);

comment on table public.profiles is
  'Public profile of an auth user. major + study_year drive the whole dashboard.';

-- -----------------------------------------------------------------------------
-- 4. Curriculum: modules → units → courses
--
-- L1 example : Anatomie (module) → Ostéologie (unit) → Membre supérieur (course)
-- L2 example : Appareil cardio-respiratoire (integrated module / UEI)
--              → Anatomie (unit) → Le cœur (course)
-- -----------------------------------------------------------------------------
create table public.modules (
  id              uuid primary key default gen_random_uuid(),
  major           public.major_code not null references public.majors (code),
  study_year      public.study_year not null,
  code            text not null check (code ~ '^[a-z0-9-]{2,40}$'),
  title_fr        text not null,
  title_en        text not null,
  description_fr  text,
  description_en  text,
  is_integrated   boolean not null default false,  -- "Unité d'enseignement intégrée" (UEI)
  semester        smallint check (semester in (1, 2)), -- null = annual module
  coefficient     numeric(4, 1),
  icon            text,          -- lucide-react icon name, e.g. 'bone'
  color           text,          -- UI accent token, e.g. 'rose'
  sort_order      smallint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (major, study_year, code)
);
create index modules_curriculum_idx on public.modules (major, study_year, sort_order);

create table public.units (
  id          uuid primary key default gen_random_uuid(),
  module_id   uuid not null references public.modules (id) on delete cascade,
  title_fr    text not null,
  title_en    text not null,
  sort_order  smallint not null default 0,
  unique (id, module_id)          -- target of the composite FK below
);
create index units_module_idx on public.units (module_id, sort_order);

create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null,
  module_id   uuid not null,      -- denormalised for fast per-module queries
  slug        text not null check (slug ~ '^[a-z0-9-]{2,80}$'),
  title_fr    text not null,
  title_en    text not null,
  sort_order  smallint not null default 0,
  status      public.content_status not null default 'published',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- The composite FK guarantees course.module_id always matches its unit's module.
  foreign key (unit_id, module_id) references public.units (id, module_id) on delete cascade,
  unique (id, module_id),
  unique (module_id, slug)
);
create index courses_unit_idx on public.courses (unit_id, sort_order);

-- -----------------------------------------------------------------------------
-- 5. QCM bank
-- -----------------------------------------------------------------------------
create table public.qcms (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null,
  module_id    uuid not null,     -- denormalised: exam pools are drawn per module
  type         public.qcm_type not null default 'multiple',
  stem         text not null,     -- énoncé (Markdown)
  explanation  text,              -- correction; hidden until answered
  difficulty   smallint check (difficulty between 1 and 5),
  source       text,              -- e.g. 'EMD1 2023', 'Rattrapage 2022'
  exam_year    smallint check (exam_year between 1990 and 2100),
  tags         text[] not null default '{}',
  language     public.app_locale not null default 'fr',
  status       public.content_status not null default 'draft',
  author_id    uuid references public.profiles (id) on delete set null,
  search       tsvector generated always as (to_tsvector('french', stem)) stored,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (course_id, module_id) references public.courses (id, module_id) on delete cascade
);
create index qcms_course_idx on public.qcms (course_id) where status = 'published';
create index qcms_module_idx on public.qcms (module_id) where status = 'published';
create index qcms_search_idx on public.qcms using gin (search);
create index qcms_tags_idx   on public.qcms using gin (tags);

create table public.qcm_options (
  qcm_id       uuid not null references public.qcms (id) on delete cascade,
  label        public.option_label not null,
  body         text not null,
  is_correct   boolean not null default false,   -- never exposed to API roles
  explanation  text,                             -- never exposed to API roles
  primary key (qcm_id, label)
);

-- Every answer a student commits, in practice or exam mode. Feeds analytics.
create table public.qcm_attempts (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  qcm_id           uuid not null references public.qcms (id) on delete cascade,
  module_id        uuid not null references public.modules (id) on delete cascade,
  mode             public.attempt_mode not null,
  exam_session_id  uuid,          -- FK added after exam_sessions exists
  selected         text[] not null,
  is_correct       boolean not null,
  score            numeric(5, 4) not null check (score between 0 and 1),
  time_ms          integer check (time_ms >= 0),
  created_at       timestamptz not null default now()
);
create index qcm_attempts_user_time_idx   on public.qcm_attempts (user_id, created_at desc);
create index qcm_attempts_user_module_idx on public.qcm_attempts (user_id, module_id);
create index qcm_attempts_qcm_idx         on public.qcm_attempts (qcm_id);

create table public.bookmarks (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  qcm_id      uuid not null references public.qcms (id) on delete cascade,
  note        text check (char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  primary key (user_id, qcm_id)
);

create table public.qcm_reports (
  id              uuid primary key default gen_random_uuid(),
  qcm_id          uuid not null references public.qcms (id) on delete cascade,
  reporter_id     uuid not null references public.profiles (id) on delete cascade,
  reason          public.report_reason not null,
  message         text check (char_length(message) <= 1000),
  status          public.report_status not null default 'open',
  moderator_note  text,
  resolved_by     uuid references public.profiles (id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);
-- One open report per student per question (re-reporting updates nothing).
create unique index qcm_reports_one_open_idx on public.qcm_reports (qcm_id, reporter_id) where status = 'open';
create index qcm_reports_triage_idx on public.qcm_reports (status, created_at);
create index qcm_reports_qcm_idx    on public.qcm_reports (qcm_id);
create index bookmarks_qcm_idx      on public.bookmarks (qcm_id);

-- -----------------------------------------------------------------------------
-- 6. Exam simulator
-- -----------------------------------------------------------------------------
create table public.exam_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  major             public.major_code not null,
  study_year        public.study_year not null,
  module_ids        uuid[] not null,
  question_count    smallint not null check (question_count between 1 and 200),
  duration_seconds  integer not null check (duration_seconds between 60 and 14400),
  scoring_mode      public.scoring_mode not null default 'all_or_nothing',
  status            public.exam_status not null default 'in_progress',
  started_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  submitted_at      timestamptz,
  score             numeric(6, 2),   -- raw points (1 per question)
  score_20          numeric(4, 2),   -- note sur 20 (Algerian grading scale)
  breakdown         jsonb,           -- per-module stats, see submit_exam()
  created_at        timestamptz not null default now()
);
create index exam_sessions_user_idx on public.exam_sessions (user_id, started_at desc);

create table public.exam_session_questions (
  session_id  uuid not null references public.exam_sessions (id) on delete cascade,
  position    smallint not null check (position >= 1),
  qcm_id      uuid not null references public.qcms (id) on delete cascade,
  module_id   uuid not null references public.modules (id) on delete cascade,
  selected    text[],                -- autosaved while the exam runs
  flagged     boolean not null default false,
  is_correct  boolean,               -- filled at submission
  score       numeric(5, 4),
  primary key (session_id, position),
  unique (session_id, qcm_id)
);

create index exam_session_questions_qcm_idx on public.exam_session_questions (qcm_id);

alter table public.qcm_attempts
  add constraint qcm_attempts_exam_session_fk
  foreign key (exam_session_id) references public.exam_sessions (id) on delete cascade;

-- -----------------------------------------------------------------------------
-- 7. Flashcards (FSRS spaced repetition)
-- -----------------------------------------------------------------------------
create table public.flashcard_decks (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references public.profiles (id) on delete cascade, -- null = official deck
  module_id    uuid references public.modules (id) on delete set null,
  course_id    uuid references public.courses (id) on delete set null,
  title        text not null check (char_length(title) between 1 and 120),
  description  text check (char_length(description) <= 1000),
  visibility   public.deck_visibility not null default 'private',
  is_official  boolean generated always as (owner_id is null) stored,
  share_code   text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  forked_from  uuid references public.flashcard_decks (id) on delete set null,
  card_count   integer not null default 0,  -- maintained by trigger
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index flashcard_decks_owner_idx  on public.flashcard_decks (owner_id);
create index flashcard_decks_module_idx on public.flashcard_decks (module_id) where visibility = 'public' or owner_id is null;

create table public.flashcards (
  id          uuid primary key default gen_random_uuid(),
  deck_id     uuid not null references public.flashcard_decks (id) on delete cascade,
  front       text not null check (char_length(front) between 1 and 4000), -- Markdown
  back        text not null check (char_length(back) between 1 and 8000),  -- Markdown
  image_path  text,
  tags        text[] not null default '{}',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index flashcards_deck_idx on public.flashcards (deck_id, sort_order);

-- Per-student scheduling state. Mirrors ts-fsrs `Card`.
create table public.flashcard_progress (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  card_id         uuid not null references public.flashcards (id) on delete cascade,
  state           public.srs_state not null default 'new',
  due             timestamptz not null default now(),
  stability       double precision not null default 0,
  difficulty      double precision not null default 0,
  scheduled_days  integer not null default 0,
  learning_steps  integer not null default 0,
  reps            integer not null default 0,
  lapses          integer not null default 0,
  last_review     timestamptz,
  primary key (user_id, card_id)
);
create index flashcard_progress_due_idx  on public.flashcard_progress (user_id, due);
create index flashcard_progress_card_idx on public.flashcard_progress (card_id);

-- Immutable review history (lets us optimise FSRS weights per student later).
create table public.flashcard_review_logs (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  card_id         uuid not null references public.flashcards (id) on delete cascade,
  rating          smallint not null check (rating between 1 and 4), -- Again, Hard, Good, Easy
  state           public.srs_state not null,                         -- state *before* review
  due             timestamptz not null,
  stability       double precision not null,
  difficulty      double precision not null,
  scheduled_days  integer not null,
  learning_steps  integer not null,
  duration_ms     integer check (duration_ms >= 0),
  reviewed_at     timestamptz not null default now()
);
create index flashcard_review_logs_user_idx on public.flashcard_review_logs (user_id, reviewed_at desc);

-- Decks a student added from others (own decks are implicitly in the library).
create table public.deck_library (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  deck_id   uuid not null references public.flashcard_decks (id) on delete cascade,
  added_at  timestamptz not null default now(),
  primary key (user_id, deck_id)
);

-- -----------------------------------------------------------------------------
-- 8. Summaries (résumés) + 3D anatomy models
-- -----------------------------------------------------------------------------
create table public.summaries (
  id               uuid primary key default gen_random_uuid(),
  module_id        uuid not null references public.modules (id) on delete cascade,
  course_id        uuid references public.courses (id) on delete set null,
  title            text not null check (char_length(title) between 3 and 160),
  description      text check (char_length(description) <= 2000),
  format           public.summary_format not null,
  storage_path     text,          -- object in the private 'summaries' bucket (PDF)
  content_md       text,          -- Markdown body
  tags             text[] not null default '{}',
  language         public.app_locale not null default 'fr',
  status           public.content_status not null default 'pending_review',
  uploaded_by      uuid references public.profiles (id) on delete set null,
  reviewed_by      uuid references public.profiles (id) on delete set null,
  reviewed_at      timestamptz,
  review_note      text,
  page_count       integer check (page_count > 0),
  file_size_bytes  bigint check (file_size_bytes between 1 and 52428800),
  view_count       integer not null default 0,
  search           tsvector generated always as (
                     setweight(to_tsvector('french', title), 'A') ||
                     setweight(to_tsvector('french', coalesce(description, '')), 'B') ||
                     setweight(to_tsvector('french', coalesce(content_md, '')), 'C')
                   ) stored,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint summaries_body_matches_format check (
    (format = 'pdf' and storage_path is not null) or
    (format = 'markdown' and content_md is not null)
  )
);
create index summaries_module_idx on public.summaries (module_id, status);
create index summaries_search_idx on public.summaries using gin (search);
create index summaries_tags_idx   on public.summaries using gin (tags);

create table public.anatomy_models (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  title_fr     text not null,
  title_en     text not null,
  system       text not null,    -- 'skeletal', 'muscular', 'cardiovascular', ...
  model_url    text not null,    -- public URL or path in the 'anatomy-models' bucket
  license      text not null,    -- e.g. 'CC BY-SA 4.0'
  attribution  text not null,    -- e.g. 'Z-Anatomy'
  module_id    uuid references public.modules (id) on delete set null,
  -- Mesh name → localised label: {"Femur_L": {"fr": "Fémur gauche", "en": "Left femur"}}
  structures   jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 9. Helper functions & triggers
-- -----------------------------------------------------------------------------

-- Role helpers are SECURITY DEFINER so RLS policies can call them without
-- recursing into profiles' own policies.
create function private.current_user_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create function private.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.current_user_role() in ('moderator', 'admin'), false)
$$;

create function private.is_contributor()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.current_user_role() in ('contributor', 'moderator', 'admin'), false)
$$;

create function private.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Create a profile row whenever someone signs up.
create function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_locale public.app_locale := case new.raw_user_meta_data ->> 'locale'
                                  when 'en' then 'en'::public.app_locale
                                  else 'fr'::public.app_locale
                                end;
begin
  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'display_name',
                  new.raw_user_meta_data ->> 'full_name',
                  split_part(new.email, '@', 1)), 80),
    v_locale
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Stamp onboarded_at the first time a student picks major + year.
create function private.stamp_onboarding()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.major is not null and new.study_year is not null and new.onboarded_at is null then
    new.onboarded_at := now();
  end if;
  return new;
end;
$$;

create trigger profiles_stamp_onboarding
  before update of major, study_year on public.profiles
  for each row execute function private.stamp_onboarding();

-- Non-staff may only create drafts or submit for review; publishing is a moderator action.
create function private.guard_moderated_status()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and not private.is_staff()
     and new.status not in ('draft', 'pending_review') then
    raise exception 'ONLY_MODERATORS_CAN_PUBLISH' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger qcms_guard_status
  before insert or update of status on public.qcms
  for each row execute function private.guard_moderated_status();

create trigger summaries_guard_status
  before insert or update of status on public.summaries
  for each row execute function private.guard_moderated_status();

-- A published QCM must be answerable: 2–8 options, ≥1 correct, exactly 1 if 'single'.
-- Deferred so a question and its options can be written in one transaction.
create function private.assert_qcm_valid()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_qcm_id  uuid;
  v_qcm     record;
  v_total   int;
  v_correct int;
begin
  -- IF (not CASE): PL/pgSQL only resolves record fields of the branch it runs.
  if tg_table_name = 'qcms' then
    v_qcm_id := new.id;
  elsif tg_op = 'DELETE' then
    v_qcm_id := old.qcm_id;
  else
    v_qcm_id := new.qcm_id;
  end if;

  select type, status into v_qcm from public.qcms where id = v_qcm_id;
  if not found or v_qcm.status <> 'published' then
    return null;
  end if;

  select count(*), count(*) filter (where is_correct)
    into v_total, v_correct
    from public.qcm_options where qcm_id = v_qcm_id;

  if v_total not between 2 and 8 then
    raise exception 'QCM % must have between 2 and 8 options (has %)', v_qcm_id, v_total;
  end if;
  if v_correct = 0 then
    raise exception 'QCM % has no correct option', v_qcm_id;
  end if;
  if v_qcm.type = 'single' and v_correct <> 1 then
    raise exception 'Single-answer QCM % must have exactly one correct option (has %)', v_qcm_id, v_correct;
  end if;
  return null;
end;
$$;

create constraint trigger qcms_valid
  after insert or update on public.qcms
  deferrable initially deferred
  for each row execute function private.assert_qcm_valid();

create constraint trigger qcm_options_valid
  after insert or update or delete on public.qcm_options
  deferrable initially deferred
  for each row execute function private.assert_qcm_valid();

-- Keep flashcard_decks.card_count in sync.
create function private.sync_deck_card_count()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    update public.flashcard_decks
       set card_count = (select count(*) from public.flashcards where deck_id = new.deck_id)
     where id = new.deck_id;
  end if;
  if tg_op in ('DELETE', 'UPDATE') then
    update public.flashcard_decks
       set card_count = (select count(*) from public.flashcards where deck_id = old.deck_id)
     where id = old.deck_id;
  end if;
  return null;
end;
$$;

create trigger flashcards_sync_count
  after insert or delete or update of deck_id on public.flashcards
  for each row execute function private.sync_deck_card_count();

-- updated_at bookkeeping
create trigger profiles_updated_at        before update on public.profiles        for each row execute function private.set_updated_at();
create trigger modules_updated_at         before update on public.modules         for each row execute function private.set_updated_at();
create trigger courses_updated_at         before update on public.courses         for each row execute function private.set_updated_at();
create trigger qcms_updated_at            before update on public.qcms            for each row execute function private.set_updated_at();
create trigger flashcard_decks_updated_at before update on public.flashcard_decks for each row execute function private.set_updated_at();
create trigger flashcards_updated_at      before update on public.flashcards      for each row execute function private.set_updated_at();
create trigger summaries_updated_at       before update on public.summaries       for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- 10. Scoring & RPCs
-- -----------------------------------------------------------------------------

-- Sorted, de-duplicated, upper-cased labels; anything that is not A–H is dropped.
create function private.normalize_labels(p_labels text[])
returns text[]
language sql immutable set search_path = ''
as $$
  select coalesce(array_agg(distinct upper(l) order by upper(l)), '{}')
  from unnest(coalesce(p_labels, '{}')) as l
  where l ~ '^[A-Ha-h]$'
$$;

-- Normalised labels restricted to the options that actually exist for a question.
create function private.existing_labels(p_qcm_id uuid, p_labels text[])
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(o.label::text order by o.label), '{}')
    from public.qcm_options o
   where o.qcm_id = p_qcm_id
     and o.label = any (private.normalize_labels(p_labels))
$$;

-- Score one question in [0, 1].
--   all_or_nothing : 1 if the selection matches the key exactly, else 0.
--   partial        : QCS behaves like all_or_nothing; for QCM, any wrong
--                    proposition cancels the question, otherwise the student
--                    earns (correct propositions ticked / correct propositions).
-- KEEP IN SYNC with src/lib/qcm/scoring.ts (unit-tested on both sides).
create function private.qcm_score(
  p_type     public.qcm_type,
  p_correct  text[],
  p_selected text[],
  p_mode     public.scoring_mode
)
returns numeric
language plpgsql immutable set search_path = ''
as $$
declare
  v_correct  text[] := private.normalize_labels(p_correct);
  v_selected text[] := private.normalize_labels(p_selected);
begin
  if cardinality(v_selected) = 0 or cardinality(v_correct) = 0 then
    return 0;
  end if;
  if v_selected = v_correct then
    return 1;
  end if;
  if p_mode = 'all_or_nothing' or p_type = 'single' then
    return 0;
  end if;
  if not (v_selected <@ v_correct) then
    return 0;
  end if;
  return round(cardinality(v_selected)::numeric / cardinality(v_correct), 4);
end;
$$;

create function private.require_user()
returns uuid
language plpgsql stable set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  return v_uid;
end;
$$;

-- Practice mode: commit an answer, get the correction back.
create function public.answer_qcm(
  p_qcm_id   uuid,
  p_selected text[],
  p_time_ms  integer default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid       uuid := private.require_user();
  v_qcm       public.qcms;
  v_selected  text[] := private.normalize_labels(p_selected);
  v_correct   text[];
  v_labels    text[];
  v_score     numeric;
  v_opt_expl  jsonb;
begin
  select * into v_qcm from public.qcms where id = p_qcm_id and status = 'published';
  if not found then
    raise exception 'QCM_NOT_FOUND' using errcode = 'P0002';
  end if;

  select array_agg(label::text order by label),
         coalesce(array_agg(label::text order by label) filter (where is_correct), '{}'),
         coalesce(jsonb_object_agg(label::text, explanation) filter (where explanation is not null), '{}')
    into v_labels, v_correct, v_opt_expl
    from public.qcm_options where qcm_id = p_qcm_id;

  if cardinality(v_selected) = 0 or not (v_selected <@ v_labels) then
    raise exception 'INVALID_SELECTION' using errcode = '22023';
  end if;
  if v_qcm.type = 'single' and cardinality(v_selected) > 1 then
    raise exception 'SINGLE_CHOICE_EXPECTED' using errcode = '22023';
  end if;

  v_score := private.qcm_score(v_qcm.type, v_correct, v_selected, 'partial');

  insert into public.qcm_attempts (user_id, qcm_id, module_id, mode, selected, is_correct, score, time_ms)
  values (v_uid, v_qcm.id, v_qcm.module_id, 'practice', v_selected, v_selected = v_correct, v_score,
          case when p_time_ms is not null then least(greatest(p_time_ms, 0), 3600000) end);

  return jsonb_build_object(
    'is_correct',          v_selected = v_correct,
    'score',               v_score,
    'correct',             to_jsonb(v_correct),
    'explanation',         v_qcm.explanation,
    'option_explanations', v_opt_expl
  );
end;
$$;

-- Exam simulator: draw a randomised, module-balanced paper for the caller's
-- major/year and open a timed session. Returns the session id.
create function public.start_exam(
  p_module_ids        uuid[],
  p_question_count    integer,
  p_duration_seconds  integer,
  p_scoring           public.scoring_mode default 'all_or_nothing'
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid      uuid := private.require_user();
  v_profile  public.profiles;
  v_modules  uuid[];
  v_session  uuid;
  v_count    integer;
begin
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.major is null then
    raise exception 'ONBOARDING_REQUIRED' using errcode = '55000';
  end if;
  if p_question_count not between 1 and 200 then
    raise exception 'INVALID_QUESTION_COUNT' using errcode = '22023';
  end if;
  if p_duration_seconds not between 60 and 14400 then
    raise exception 'INVALID_DURATION' using errcode = '22023';
  end if;

  -- Only modules of the student's own curriculum; empty = all of them.
  select array_agg(m.id order by m.sort_order) into v_modules
    from public.modules m
   where m.major = v_profile.major
     and m.study_year = v_profile.study_year
     and (coalesce(cardinality(p_module_ids), 0) = 0 or m.id = any (p_module_ids));

  if v_modules is null then
    raise exception 'INVALID_MODULES' using errcode = '22023';
  end if;

  insert into public.exam_sessions (user_id, major, study_year, module_ids, question_count,
                                    duration_seconds, scoring_mode, expires_at)
  values (v_uid, v_profile.major, v_profile.study_year, v_modules, p_question_count,
          p_duration_seconds, p_scoring, now() + make_interval(secs => p_duration_seconds))
  returning id into v_session;

  -- Round-robin across modules (rn = rank inside its module) so a 20-question
  -- paper over 4 modules gets ~5 each, then shuffle the final order.
  with pool as (
    select q.id, q.module_id,
           row_number() over (partition by q.module_id order by random()) as rn
      from public.qcms q
     where q.status = 'published'
       and q.module_id = any (v_modules)
  ), picked as (
    select id, module_id from pool order by rn, random() limit p_question_count
  )
  insert into public.exam_session_questions (session_id, position, qcm_id, module_id)
  select v_session, row_number() over (order by random()), id, module_id from picked;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'NO_QUESTIONS_AVAILABLE' using errcode = 'P0002';
  end if;

  if v_count < p_question_count then
    -- Smaller pool than requested: shrink the paper and keep the per-question pace.
    update public.exam_sessions
       set question_count   = v_count,
           duration_seconds = greatest(60, (p_duration_seconds * v_count) / p_question_count),
           expires_at       = started_at + make_interval(
                                secs => greatest(60, (p_duration_seconds * v_count) / p_question_count))
     where id = v_session;
  end if;

  return v_session;
end;
$$;

-- The exam paper: questions WITHOUT answers, plus autosaved state.
create function public.get_exam_paper(p_session_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid      uuid := private.require_user();
  v_session  public.exam_sessions;
begin
  select * into v_session from public.exam_sessions where id = p_session_id and user_id = v_uid;
  if not found then
    raise exception 'EXAM_NOT_FOUND' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'session_id',       v_session.id,
    'status',           v_session.status,
    'started_at',       v_session.started_at,
    'expires_at',       v_session.expires_at,
    'server_now',       now(),
    'duration_seconds', v_session.duration_seconds,
    'scoring_mode',     v_session.scoring_mode,
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'position',  esq.position,
               'qcm_id',    q.id,
               'module_id', q.module_id,
               'course_id', q.course_id,
               'type',      q.type,
               'stem',      q.stem,
               'selected',  coalesce(to_jsonb(esq.selected), '[]'::jsonb),
               'flagged',   esq.flagged,
               'options', (
                 select jsonb_agg(jsonb_build_object('label', o.label, 'body', o.body) order by o.label)
                   from public.qcm_options o where o.qcm_id = q.id
               )
             ) order by esq.position), '[]'::jsonb)
        from public.exam_session_questions esq
        join public.qcms q on q.id = esq.qcm_id
       where esq.session_id = v_session.id
    )
  );
end;
$$;

-- Autosave one answer while the clock runs (survives refreshes / crashes).
create function public.save_exam_answer(
  p_session_id  uuid,
  p_position    integer,
  p_selected    text[],
  p_flagged     boolean default false
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  update public.exam_session_questions esq
     set selected = private.existing_labels(esq.qcm_id, p_selected),
         flagged  = coalesce(p_flagged, false)
    from public.exam_sessions s
   where s.id = esq.session_id
     and s.id = p_session_id
     and s.user_id = v_uid
     and s.status = 'in_progress'
     and now() <= s.expires_at
     and esq.position = p_position;

  if not found then
    raise exception 'EXAM_NOT_WRITABLE' using errcode = '55000';
  end if;
end;
$$;

-- Full correction for a finished exam.
create function private.build_exam_result(p_session_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'session_id',       s.id,
    'status',           s.status,
    'scoring_mode',     s.scoring_mode,
    'started_at',       s.started_at,
    'submitted_at',     s.submitted_at,
    'duration_seconds', s.duration_seconds,
    'question_count',   s.question_count,
    'score',            s.score,
    'score_20',         s.score_20,
    'modules',          coalesce(s.breakdown, '[]'::jsonb),
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'position',    esq.position,
               'qcm_id',      q.id,
               'module_id',   q.module_id,
               'type',        q.type,
               'stem',        q.stem,
               'explanation', q.explanation,
               'selected',    coalesce(to_jsonb(esq.selected), '[]'::jsonb),
               'is_correct',  coalesce(esq.is_correct, false),
               'score',       coalesce(esq.score, 0),
               'options', (
                 select jsonb_agg(jsonb_build_object(
                          'label', o.label, 'body', o.body,
                          'is_correct', o.is_correct, 'explanation', o.explanation
                        ) order by o.label)
                   from public.qcm_options o where o.qcm_id = q.id
               )
             ) order by esq.position), '[]'::jsonb)
        from public.exam_session_questions esq
        join public.qcms q on q.id = esq.qcm_id
       where esq.session_id = s.id
    )
  )
  from public.exam_sessions s
  where s.id = p_session_id
$$;

-- Submit (idempotent). Optional p_answers = {"<position>": ["A","C"], ...}
-- overrides autosaved answers when received within the grace period.
create function public.submit_exam(p_session_id uuid, p_answers jsonb default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid      uuid := private.require_user();
  v_session  public.exam_sessions;
  v_grace    constant interval := interval '30 seconds';
  v_late     boolean;
  v_score    numeric;
begin
  select * into v_session
    from public.exam_sessions
   where id = p_session_id and user_id = v_uid
     for update;
  if not found then
    raise exception 'EXAM_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_session.status <> 'in_progress' then
    return private.build_exam_result(v_session.id);   -- already scored
  end if;

  v_late := now() > v_session.expires_at + v_grace;

  if p_answers is not null and not v_late then
    update public.exam_session_questions esq
       set selected = private.existing_labels(
                        esq.qcm_id,
                        array(select jsonb_array_elements_text(p_answers -> esq.position::text)))
     where esq.session_id = v_session.id
       and p_answers ? esq.position::text
       and jsonb_typeof(p_answers -> esq.position::text) = 'array';
  end if;

  -- Score every question against the key (only labels that exist can match).
  update public.exam_session_questions esq
     set score      = private.qcm_score(q.type, k.correct, esq.selected, v_session.scoring_mode),
         is_correct = private.normalize_labels(esq.selected) = k.correct
    from public.qcms q,
         lateral (
           select coalesce(array_agg(o.label::text order by o.label) filter (where o.is_correct), '{}') as correct
             from public.qcm_options o where o.qcm_id = q.id
         ) k
   where esq.session_id = v_session.id
     and q.id = esq.qcm_id;

  -- Log answered questions for analytics.
  insert into public.qcm_attempts (user_id, qcm_id, module_id, mode, exam_session_id, selected, is_correct, score)
  select v_uid, esq.qcm_id, esq.module_id, 'exam', v_session.id, esq.selected, esq.is_correct, esq.score
    from public.exam_session_questions esq
   where esq.session_id = v_session.id
     and coalesce(cardinality(esq.selected), 0) > 0;

  select coalesce(sum(score), 0) into v_score
    from public.exam_session_questions where session_id = v_session.id;

  update public.exam_sessions s
     set status       = case when v_late then 'expired'::public.exam_status else 'submitted'::public.exam_status end,
         submitted_at = now(),
         score        = round(v_score, 2),
         score_20     = round(v_score * 20 / s.question_count, 2),
         breakdown    = (
           select coalesce(jsonb_agg(jsonb_build_object(
                    'module_id', m.id,
                    'title_fr',  m.title_fr,
                    'title_en',  m.title_en,
                    'total',     agg.total,
                    'answered',  agg.answered,
                    'correct',   agg.correct,
                    'score',     round(agg.score, 2)
                  ) order by m.sort_order), '[]'::jsonb)
             from (
               select module_id,
                      count(*)                                                      as total,
                      count(*) filter (where coalesce(cardinality(selected), 0) > 0) as answered,
                      count(*) filter (where is_correct)                            as correct,
                      coalesce(sum(score), 0)                                       as score
                 from public.exam_session_questions
                where session_id = v_session.id
                group by module_id
             ) agg
             join public.modules m on m.id = agg.module_id
         )
   where s.id = v_session.id;

  return private.build_exam_result(v_session.id);
end;
$$;

create function public.get_exam_result(p_session_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid     uuid := private.require_user();
  v_status  public.exam_status;
begin
  select status into v_status from public.exam_sessions where id = p_session_id and user_id = v_uid;
  if not found then
    raise exception 'EXAM_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_status = 'in_progress' then
    raise exception 'EXAM_IN_PROGRESS' using errcode = '55000';
  end if;
  return private.build_exam_result(p_session_id);
end;
$$;

-- Add an unlisted/public deck to one's library via its share code.
create function public.add_deck_to_library(p_share_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid      uuid := private.require_user();
  v_deck_id  uuid;
begin
  select id into v_deck_id
    from public.flashcard_decks
   where share_code = p_share_code
     and (visibility in ('public', 'unlisted') or owner_id is null);
  if v_deck_id is null then
    raise exception 'DECK_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.deck_library (user_id, deck_id) values (v_uid, v_deck_id)
  on conflict do nothing;
  return v_deck_id;
end;
$$;

-- Dashboard analytics (security_invoker → RLS on the base tables applies).
create view public.user_module_stats
with (security_invoker = true) as
select a.user_id,
       a.module_id,
       count(*)                                    as attempts,
       count(*) filter (where a.is_correct)        as correct,
       round(avg(a.score) * 100, 1)                as accuracy_pct,
       max(a.created_at)                           as last_attempt_at
  from public.qcm_attempts a
 group by a.user_id, a.module_id;

create view public.course_question_counts
with (security_invoker = true) as
select q.course_id, q.module_id, count(*) as question_count
  from public.qcms q
 where q.status = 'published'
 group by q.course_id, q.module_id;

-- -----------------------------------------------------------------------------
-- 11. Row Level Security & privileges
-- -----------------------------------------------------------------------------
alter table public.majors                  enable row level security;
alter table public.profiles                enable row level security;
alter table public.modules                 enable row level security;
alter table public.units                   enable row level security;
alter table public.courses                 enable row level security;
alter table public.qcms                    enable row level security;
alter table public.qcm_options             enable row level security;
alter table public.qcm_attempts            enable row level security;
alter table public.bookmarks               enable row level security;
alter table public.qcm_reports             enable row level security;
alter table public.exam_sessions           enable row level security;
alter table public.exam_session_questions  enable row level security;
alter table public.flashcard_decks         enable row level security;
alter table public.flashcards              enable row level security;
alter table public.flashcard_progress      enable row level security;
alter table public.flashcard_review_logs   enable row level security;
alter table public.deck_library            enable row level security;
alter table public.summaries               enable row level security;
alter table public.anatomy_models          enable row level security;

-- Curriculum & reference data: world-readable, staff-writable.
create policy "majors: read"          on public.majors         for select to anon, authenticated using (true);
create policy "modules: read"         on public.modules        for select to anon, authenticated using (true);
create policy "modules: staff write"  on public.modules        for all    to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "units: read"           on public.units          for select to anon, authenticated using (true);
create policy "units: staff write"    on public.units          for all    to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "courses: read published" on public.courses      for select to anon, authenticated using (status = 'published' or (select private.is_staff()));
create policy "courses: staff write"  on public.courses        for all    to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "anatomy: read"         on public.anatomy_models for select to anon, authenticated using (true);
create policy "anatomy: staff write"  on public.anatomy_models for all    to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));

-- Profiles: a student sees and edits only their own row (column grants below
-- prevent editing `role`).
create policy "profiles: read own"   on public.profiles for select to authenticated using (id = (select auth.uid()) or (select private.is_staff()));
create policy "profiles: update own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- QCMs: published ones for every student; drafts for their author and staff.
create policy "qcms: read" on public.qcms for select to authenticated
  using (status = 'published' or author_id = (select auth.uid()) or (select private.is_staff()));
create policy "qcms: contributors insert" on public.qcms for insert to authenticated
  with check ((select private.is_contributor()) and author_id = (select auth.uid()));
create policy "qcms: author edits unpublished" on public.qcms for update to authenticated
  using ((author_id = (select auth.uid()) and status in ('draft', 'pending_review', 'rejected')) or (select private.is_staff()))
  with check (author_id = (select auth.uid()) or (select private.is_staff()));
create policy "qcms: staff delete" on public.qcms for delete to authenticated using ((select private.is_staff()));

create policy "qcm_options: read" on public.qcm_options for select to authenticated
  using (exists (select 1 from public.qcms q where q.id = qcm_id));   -- qcms RLS applies
create policy "qcm_options: author/staff write" on public.qcm_options for all to authenticated
  using (exists (select 1 from public.qcms q where q.id = qcm_id
                  and ((q.author_id = (select auth.uid()) and q.status <> 'published') or (select private.is_staff()))))
  with check (exists (select 1 from public.qcms q where q.id = qcm_id
                  and ((q.author_id = (select auth.uid()) and q.status <> 'published') or (select private.is_staff()))));

-- Personal learning data: owner only (writes go through RPCs where scoring matters).
create policy "attempts: read own"       on public.qcm_attempts           for select to authenticated using (user_id = (select auth.uid()) or (select private.is_staff()));
create policy "exam_sessions: read own"  on public.exam_sessions          for select to authenticated using (user_id = (select auth.uid()));
create policy "exam_questions: read own" on public.exam_session_questions for select to authenticated
  using (exists (select 1 from public.exam_sessions s where s.id = session_id and s.user_id = (select auth.uid())));

create policy "bookmarks: own" on public.bookmarks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "reports: create own" on public.qcm_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open');
create policy "reports: read own or staff" on public.qcm_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select private.is_staff()));
create policy "reports: staff triage" on public.qcm_reports for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- Flashcards
create policy "decks: read" on public.flashcard_decks for select to authenticated
  using (
    owner_id = (select auth.uid())
    or owner_id is null
    or visibility = 'public'
    or exists (select 1 from public.deck_library l where l.deck_id = id and l.user_id = (select auth.uid()))
    or (select private.is_staff())
  );
create policy "decks: insert own" on public.flashcard_decks for insert to authenticated
  with check (owner_id = (select auth.uid()) or (owner_id is null and (select private.is_staff())));
create policy "decks: update own" on public.flashcard_decks for update to authenticated
  using (owner_id = (select auth.uid()) or (owner_id is null and (select private.is_staff())))
  with check (owner_id = (select auth.uid()) or (owner_id is null and (select private.is_staff())));
create policy "decks: delete own" on public.flashcard_decks for delete to authenticated
  using (owner_id = (select auth.uid()) or (owner_id is null and (select private.is_staff())));

create policy "cards: read" on public.flashcards for select to authenticated
  using (exists (select 1 from public.flashcard_decks d where d.id = deck_id));  -- decks RLS applies
create policy "cards: write own deck" on public.flashcards for all to authenticated
  using (exists (select 1 from public.flashcard_decks d where d.id = deck_id
                  and (d.owner_id = (select auth.uid()) or (d.owner_id is null and (select private.is_staff())))))
  with check (exists (select 1 from public.flashcard_decks d where d.id = deck_id
                  and (d.owner_id = (select auth.uid()) or (d.owner_id is null and (select private.is_staff())))));

create policy "progress: own"    on public.flashcard_progress    for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "review_logs: own" on public.flashcard_review_logs for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "library: own"     on public.deck_library          for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.flashcard_decks d where d.id = deck_id and d.visibility = 'public'));

-- Summaries: published for all students; uploads go to review first.
create policy "summaries: read" on public.summaries for select to authenticated
  using (status = 'published' or uploaded_by = (select auth.uid()) or (select private.is_staff()));
create policy "summaries: upload" on public.summaries for insert to authenticated
  with check (uploaded_by = (select auth.uid()));
create policy "summaries: edit own unpublished" on public.summaries for update to authenticated
  using ((uploaded_by = (select auth.uid()) and status <> 'published') or (select private.is_staff()))
  with check (uploaded_by = (select auth.uid()) or (select private.is_staff()));
create policy "summaries: delete own unpublished" on public.summaries for delete to authenticated
  using ((uploaded_by = (select auth.uid()) and status <> 'published') or (select private.is_staff()));

-- Column privileges. RLS decides *which rows*; grants decide *which columns*.
-- Answer keys are only reachable through the SECURITY DEFINER RPCs above.
revoke all on public.qcm_options from anon, authenticated;
grant select (qcm_id, label, body) on public.qcm_options to authenticated;
grant insert, update, delete on public.qcm_options to authenticated;   -- still gated by RLS

revoke select on public.qcms from anon, authenticated;
grant select (id, course_id, module_id, type, stem, difficulty, source, exam_year, tags,
              language, status, author_id, search, created_at, updated_at)
  on public.qcms to authenticated;

-- Students may edit their profile, but never their role.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, avatar_url, major, study_year, locale) on public.profiles to authenticated;

-- Reporters fill in the report; triage fields belong to moderators.
revoke insert on public.qcm_reports from anon, authenticated;
grant insert (qcm_id, reporter_id, reason, message) on public.qcm_reports to authenticated;

-- Reviewer fields are set by moderators only.
revoke update on public.summaries from authenticated;
grant update (module_id, course_id, title, description, format, storage_path, content_md, tags,
              language, status, page_count, file_size_bytes)
  on public.summaries to authenticated;

-- Scores are written exclusively by RPCs.
revoke insert, update, delete on public.qcm_attempts, public.exam_sessions, public.exam_session_questions
  from anon, authenticated;

-- Function privileges: nothing is callable unless granted.
revoke all on all functions in schema private from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.current_user_role(), private.is_staff(), private.is_contributor()
  to anon, authenticated;

revoke all on function public.answer_qcm(uuid, text[], integer)                           from public, anon;
revoke all on function public.start_exam(uuid[], integer, integer, public.scoring_mode)  from public, anon;
revoke all on function public.get_exam_paper(uuid)                                        from public, anon;
revoke all on function public.save_exam_answer(uuid, integer, text[], boolean)            from public, anon;
revoke all on function public.submit_exam(uuid, jsonb)                                    from public, anon;
revoke all on function public.get_exam_result(uuid)                                       from public, anon;
revoke all on function public.add_deck_to_library(text)                                   from public, anon;
grant execute on function public.answer_qcm(uuid, text[], integer)                          to authenticated;
grant execute on function public.start_exam(uuid[], integer, integer, public.scoring_mode) to authenticated;
grant execute on function public.get_exam_paper(uuid)                                       to authenticated;
grant execute on function public.save_exam_answer(uuid, integer, text[], boolean)           to authenticated;
grant execute on function public.submit_exam(uuid, jsonb)                                   to authenticated;
grant execute on function public.get_exam_result(uuid)                                      to authenticated;
grant execute on function public.add_deck_to_library(text)                                  to authenticated;

-- -----------------------------------------------------------------------------
-- 12. Storage
--   summaries       (private) : <uploader uid>/<uuid>.pdf, served via signed URLs
--   anatomy-models  (public)  : GLB/GLTF files, staff-managed
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('summaries',      'summaries',      false, 52428800,  array['application/pdf']),
  ('anatomy-models', 'anatomy-models', true,  104857600, array['model/gltf-binary', 'model/gltf+json', 'application/octet-stream'])
on conflict (id) do nothing;

create policy "summaries bucket: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'summaries' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "summaries bucket: read own, published or staff" on storage.objects for select to authenticated
  using (
    bucket_id = 'summaries' and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.summaries s where s.storage_path = name and s.status = 'published')
      or (select private.is_staff())
    )
  );

create policy "summaries bucket: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'summaries' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "anatomy bucket: staff write" on storage.objects for all to authenticated
  using (bucket_id = 'anatomy-models' and (select private.is_staff()))
  with check (bucket_id = 'anatomy-models' and (select private.is_staff()));
