-- ┌──────────────────────────────────────────────────────────────────┐
-- │  Products: full manufacturing master record                      │
-- │                                                                  │
-- │  Extends the basic products table (0025) with the metadata a CNC │
-- │  shop actually tracks: classification, material/surface/heat     │
-- │  treatment, dimensions, tolerances, manufacturing process,       │
-- │  commercial pricing, revision tracking, status, and a separate   │
-- │  product_images table for the photo gallery.                     │
-- │                                                                  │
-- │  Drawings + CAD programs already link via product_id (0025) so   │
-- │  the detail page can show those without schema changes.          │
-- └──────────────────────────────────────────────────────────────────┘

-- ── Enums ──
do $$ begin
  create type public.product_status as enum ('aktif', 'taslak', 'pasif');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.product_process as enum (
    'tornalama',
    'frezeleme',
    'tornalama_frezeleme',
    'taslama',
    'erozyon',
    'lazer',
    'diger'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.product_currency as enum ('TRY', 'USD', 'EUR');
exception when duplicate_object then null;
end $$;

-- ── Extended fields on products ──
alter table public.products
  add column if not exists category text,
  add column if not exists material text,
  add column if not exists surface_treatment text,
  add column if not exists heat_treatment text,
  add column if not exists weight_kg numeric,
  add column if not exists length_mm numeric,
  add column if not exists width_mm numeric,
  add column if not exists height_mm numeric,
  add column if not exists diameter_mm numeric,
  add column if not exists tolerance_class text,
  add column if not exists surface_finish_ra numeric,
  add column if not exists hardness text,
  add column if not exists process_type product_process,
  add column if not exists cycle_time_minutes int,
  add column if not exists setup_time_minutes int,
  add column if not exists default_machine_id uuid references public.machines(id) on delete set null,
  add column if not exists min_order_qty int,
  add column if not exists unit_price numeric,
  add column if not exists currency product_currency default 'TRY',
  add column if not exists customer_part_no text,
  add column if not exists customer_drawing_ref text,
  add column if not exists status product_status default 'aktif',
  add column if not exists revision text,
  add column if not exists revision_date date,
  add column if not exists tags text[] default '{}';

create index if not exists products_category_idx on public.products(category);
create index if not exists products_status_idx on public.products(status);
create index if not exists products_default_machine_idx on public.products(default_machine_id);
create index if not exists products_customer_part_idx on public.products(customer_part_no);

-- ── product_images: gallery (multiple per product) ──
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_path text not null,
  caption text,
  sort_order int not null default 0,
  is_primary boolean not null default false,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_idx
  on public.product_images(product_id, sort_order);
-- Only one primary image per product
create unique index if not exists product_images_one_primary_per_product
  on public.product_images(product_id) where is_primary;

alter table public.product_images enable row level security;

drop policy if exists product_images_select on public.product_images;
create policy product_images_select on public.product_images
  for select to authenticated using (true);

drop policy if exists product_images_modify on public.product_images;
create policy product_images_modify on public.product_images
  for all to authenticated using (true) with check (true);

-- ── Storage bucket: product-images (public, like tool-images) ──
insert into storage.buckets (id, name, public)
  values ('product-images', 'product-images', true)
  on conflict (id) do nothing;

drop policy if exists product_images_storage_select on storage.objects;
create policy product_images_storage_select on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists product_images_storage_insert on storage.objects;
create policy product_images_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists product_images_storage_update on storage.objects;
create policy product_images_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

drop policy if exists product_images_storage_delete on storage.objects;
create policy product_images_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images');

-- ── Realtime ──
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.product_images;
    exception when duplicate_object then null; end;
  end if;
end $$;
