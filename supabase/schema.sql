-- =====================================================================
-- Project Board - Supabase schema
-- Run via:  supabase db push        (after `supabase link`)
--      or:  paste into Dashboard -> SQL Editor -> Run
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / DROP IF EXISTS.
-- =====================================================================

-- ---------- helper: keep updated_at fresh ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- users ----------
-- id is text so both Supabase Auth UUIDs and Auth0 ids (the part after "|") work.
create table if not exists public.users (
  id             text primary key,
  first_name     text,
  last_name      text,
  username       text,
  email          text not null unique,
  password       text,                       -- unused with Supabase Auth; kept for the User model
  email_verified boolean not null default false,
  photo          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------- projects ----------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null,
  admin       text references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- members (user <-> project) ----------
create table if not exists public.members (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    text not null references public.users (id) on delete cascade,
  access     text not null default 'member' check (access in ('admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id)
);

-- ---------- tasks ----------
-- author_id / assignee_id reference MEMBERS (not users), matching the API.
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  order_index integer not null default 0,
  project_id  uuid not null references public.projects (id) on delete cascade,
  author_id   uuid references public.members (id) on delete set null,
  assignee_id uuid references public.members (id) on delete set null,
  title       text not null,
  description text not null default 'No Description',
  label       text not null default 'No Label'
              check (label in ('Bug', 'Feature', 'Improvement', 'No Label')),
  priority    text not null default 'no_priority'
              check (priority in ('no_priority', 'low', 'medium', 'high', 'urgent')),
  status      text not null default 'backlog'
              check (status in ('backlog', 'todo', 'in_progress', 'done', 'cancelled')),
  start_date  timestamptz not null default now(),
  due_date    timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- history (activity log) ----------
-- task_id has no FK on purpose: a 'delete' entry must outlive its task.
create table if not exists public.history (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid,
  project_id    uuid not null references public.projects (id) on delete cascade,
  user_id       text not null,
  action        text not null
                check (action in ('create', 'update', 'delete', 'change', 'assign', 'add-member', 'remove-member')),
  extra_details jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- comments ----------
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id    uuid not null references public.tasks (id) on delete cascade,
  user_id    text not null,
  comment    text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- indexes ----------
create index if not exists members_project_idx  on public.members (project_id);
create index if not exists members_user_idx     on public.members (user_id);
create index if not exists tasks_board_idx      on public.tasks (project_id, status, order_index);
create index if not exists history_project_idx  on public.history (project_id, created_at desc);
create index if not exists history_task_idx     on public.history (task_id);
create index if not exists comments_task_idx    on public.comments (task_id);
create index if not exists comments_project_idx on public.comments (project_id);

-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array['users', 'projects', 'members', 'tasks', 'history', 'comments']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------- sync Supabase Auth signups into public.users ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- phone-only / anonymous signups have no email; the API creates the row later if needed
  if new.email is null then
    return new;
  end if;

  insert into public.users (id, email, first_name, last_name, username, photo, email_verified)
  values (
    new.id::text,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'firstName', new.raw_user_meta_data ->> 'first_name'),
    coalesce(new.raw_user_meta_data ->> 'lastName',  new.raw_user_meta_data ->> 'last_name'),
    coalesce(new.raw_user_meta_data ->> 'username',  new.raw_user_meta_data ->> 'nickname'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'photo'),
    new.email_confirmed_at is not null
  )
  on conflict do nothing;   -- never block a signup because of a duplicate row

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row Level Security ----------
-- The Express API uses the service_role key (bypasses RLS) and enforces access itself.
-- RLS is ON with NO policies, so the public publishable/anon key can read or write NOTHING
-- directly. Add policies later only if the frontend should query tables itself.
alter table public.users    enable row level security;
alter table public.projects enable row level security;
alter table public.members  enable row level security;
alter table public.tasks    enable row level security;
alter table public.history  enable row level security;
alter table public.comments enable row level security;
