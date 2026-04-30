-- ┌──────────────────────────────────────────────────────────────────┐
-- │  Product master — reusable part definitions.                     │
-- │                                                                  │
-- │  When a customer keeps re-ordering the same part, we don't want  │
-- │  to re-attach drawings, tools and CAD/CAM files every time.      │
-- │  A `product` row binds them once; new jobs just pick the         │
-- │  product and inherit the metadata.                               │
-- │                                                                  │
-- │  Wiring:                                                         │
-- │   - jobs.product_id            (optional FK)                     │
-- │   - drawings.product_id        (optional FK — drawings can be    │
-- │                                  attached to a product directly  │
-- │                                  OR to a single job)             │
-- │   - cad_programs.product_id    (same idea)                       │
-- │   - product_tools (junction)   (default tool list per product;   │
-- │                                  copied into job_tools when a    │
-- │                                  job picks the product)          │
-- │   - production_entries.notes   (operator can leave a note per    │
-- │                                  shift entry — multi-entry form) │
-- └──────────────────────────────────────────────────────────────────┘

-- products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  customer text,
  default_quantity int,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_code_idx on public.products(code);
create index if not exists products_customer_idx on public.products(customer);

-- default tool list per product
create table if not exists public.product_tools (
  product_id uuid not null references public.products(id) on delete cascade,
  tool_id uuid not null references public.tools(id) on delete cascade,
  quantity_used int not null default 1 check (quantity_used > 0),
  notes text,
  primary key (product_id, tool_id)
);
create index if not exists product_tools_tool_idx on public.product_tools(tool_id);

-- Touch trigger
create or replace function public.products_touch()
returns trigger language plpgsql security definer set search_path = public
as $$ begin NEW.updated_at = now(); return NEW; end; $$;

drop trigger if exists trg_products_touch on public.products;
create trigger trg_products_touch before update on public.products
for each row execute function public.products_touch();

-- Foreign keys on existing tables (all optional / SET NULL)
alter table public.jobs
  add column if not exists product_id uuid references public.products(id) on delete set null;
create index if not exists jobs_product_id_idx on public.jobs(product_id);

alter table public.drawings
  add column if not exists product_id uuid references public.products(id) on delete set null;
create index if not exists drawings_product_id_idx on public.drawings(product_id);

alter table public.cad_programs
  add column if not exists product_id uuid references public.products(id) on delete set null;
create index if not exists cad_programs_product_id_idx on public.cad_programs(product_id);

-- Free-form notes per production entry (multi-entry shift form)
alter table public.production_entries
  add column if not exists notes text;

-- ─── RLS ──────────────────────────────────────────────────────────
alter table public.products enable row level security;
alter table public.product_tools enable row level security;

-- All authenticated users can read; only authenticated users can
-- modify (small team, generous policy mirrors the rest of the app).
drop policy if exists products_select on public.products;
create policy products_select on public.products for select to authenticated using (true);

drop policy if exists products_modify on public.products;
create policy products_modify on public.products for all to authenticated
using (true) with check (true);

drop policy if exists product_tools_select on public.product_tools;
create policy product_tools_select on public.product_tools for select to authenticated using (true);

drop policy if exists product_tools_modify on public.product_tools;
create policy product_tools_modify on public.product_tools for all to authenticated
using (true) with check (true);

-- Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.products;
    exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.product_tools;
    exception when duplicate_object then null; end;
  end if;
end $$;
