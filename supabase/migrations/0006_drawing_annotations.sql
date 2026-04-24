-- TG Teknik CRM - Drawing annotations
-- Stores client-side Fabric.js canvas state on top of an image drawing.
-- Original file in storage is never modified — annotations live in DB.

alter table public.drawings
  add column if not exists annotations jsonb,
  add column if not exists annotated_at timestamptz,
  add column if not exists annotated_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_drawings_annotated_by on public.drawings(annotated_by);
