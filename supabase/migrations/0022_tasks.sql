-- ┌──────────────────────────────────────────────────────────────────┐
-- │  Tasks — CRM-style task tracking with assignee, due date,        │
-- │  priority, status, and a checklist sub-item list.                │
-- │                                                                  │
-- │  Modeled after the common pattern in HubSpot / Pipedrive:        │
-- │  - One task can be assigned to one user (assignee)               │
-- │  - Optional links to a job, machine, or job-customer             │
-- │  - 4-step Kanban: todo / in_progress / done / cancelled          │
-- │  - Priority enum: low / medium / high / urgent                   │
-- │  - Subtasks (checklist) for granular tracking                    │
-- │  - Comments for discussion (created_by + body)                   │
-- └──────────────────────────────────────────────────────────────────┘

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum (
      'todo', 'in_progress', 'done', 'cancelled'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type public.task_priority as enum (
      'low', 'medium', 'high', 'urgent'
    );
  end if;
end $$;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  due_date date,
  assigned_to uuid references auth.users(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  machine_id uuid references public.machines(id) on delete set null,
  -- Free-form labels (similar to messaging tags). Comma-free list of
  -- short keys; UI renders colored chips.
  tags text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_assigned_to_idx on public.tasks(assigned_to);
create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists tasks_due_date_idx on public.tasks(due_date);
create index if not exists tasks_created_by_idx on public.tasks(created_by);

-- Subtasks (a flat checklist; no nesting needed for our scale).
create table if not exists public.task_checklist (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  body text not null,
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists task_checklist_task_idx on public.task_checklist(task_id, position);

-- Comments
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists task_comments_task_idx on public.task_comments(task_id, created_at);

-- Touch trigger
create or replace function public.tasks_touch()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  NEW.updated_at = now();
  if NEW.status = 'done' and (OLD.status is distinct from 'done') then
    NEW.completed_at = now();
  elsif NEW.status <> 'done' and (OLD.status = 'done') then
    NEW.completed_at = null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_tasks_touch on public.tasks;
create trigger trg_tasks_touch before update on public.tasks
for each row execute function public.tasks_touch();

-- ─── RLS ──────────────────────────────────────────────────────────
alter table public.tasks enable row level security;
alter table public.task_checklist enable row level security;
alter table public.task_comments enable row level security;

-- Anyone authenticated can see all tasks (small team, lots of cross-
-- visibility needed). Only the creator or assignee can modify.
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated using (true);

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
using (
  created_by = (select auth.uid())
  or assigned_to = (select auth.uid())
)
with check (
  created_by = (select auth.uid())
  or assigned_to = (select auth.uid())
);

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete to authenticated
using (created_by = (select auth.uid()));

-- Checklist + comments: anyone can read; creator/assignee of the parent
-- task can mutate.
drop policy if exists task_checklist_select on public.task_checklist;
create policy task_checklist_select on public.task_checklist
for select to authenticated using (true);

drop policy if exists task_checklist_modify on public.task_checklist;
create policy task_checklist_modify on public.task_checklist
for all to authenticated
using (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
    and (t.created_by = (select auth.uid()) or t.assigned_to = (select auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
    and (t.created_by = (select auth.uid()) or t.assigned_to = (select auth.uid()))
  )
);

drop policy if exists task_comments_select on public.task_comments;
create policy task_comments_select on public.task_comments
for select to authenticated using (true);

drop policy if exists task_comments_insert on public.task_comments;
create policy task_comments_insert on public.task_comments
for insert to authenticated
with check (author_id = (select auth.uid()));

drop policy if exists task_comments_modify on public.task_comments;
create policy task_comments_modify on public.task_comments
for update to authenticated
using (author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));

drop policy if exists task_comments_delete on public.task_comments;
create policy task_comments_delete on public.task_comments
for delete to authenticated
using (author_id = (select auth.uid()));

-- Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.tasks;
    exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.task_checklist;
    exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.task_comments;
    exception when duplicate_object then null; end;
  end if;
end $$;
