-- ┌──────────────────────────────────────────────────────────────────┐
-- │  Relax delete constraints — preserve history without blocking    │
-- │  deletes.                                                        │
-- │                                                                  │
-- │  Two FKs were RESTRICT, which blocked admins from deleting:      │
-- │   1. production_entries.machine_id → machines.id                 │
-- │      (any production record blocked the machine)                 │
-- │   2. quality_reviews.reviewer_id → profiles.id                   │
-- │      (any QC sign-off blocked the user)                          │
-- │                                                                  │
-- │  Switch both to SET NULL so historical rows survive but the      │
-- │  parent can be removed. Columns must become nullable first.      │
-- └──────────────────────────────────────────────────────────────────┘

-- production_entries.machine_id
alter table public.production_entries
  alter column machine_id drop not null;

alter table public.production_entries
  drop constraint if exists production_entries_machine_id_fkey;

alter table public.production_entries
  add constraint production_entries_machine_id_fkey
  foreign key (machine_id) references public.machines(id) on delete set null;

-- quality_reviews.reviewer_id
alter table public.quality_reviews
  alter column reviewer_id drop not null;

alter table public.quality_reviews
  drop constraint if exists quality_reviews_reviewer_id_fkey;

alter table public.quality_reviews
  add constraint quality_reviews_reviewer_id_fkey
  foreign key (reviewer_id) references public.profiles(id) on delete set null;
