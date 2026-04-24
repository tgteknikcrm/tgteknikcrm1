-- TG Teknik CRM - Suppliers + Purchase Orders
-- Adds:
--   suppliers              — vendor directory
--   purchase_orders        — outgoing orders (procurement, distinct from
--                             jobs which are incoming customer manufacturing)
--   purchase_order_items   — line items with category presets for fast entry

-- ============================================================
-- Enums
-- ============================================================
do $$ begin
  create type po_status as enum (
    'taslak', 'siparis_verildi', 'yolda', 'teslim_alindi', 'iptal'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type po_item_category as enum (
    'takim', 'eldiven', 'kece', 'yag', 'kesici',
    'asindirici', 'bakim_malzemesi', 'diger'
  );
exception when duplicate_object then null; end $$;

-- ============================================================
-- suppliers
-- ============================================================
create table if not exists public.suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_suppliers_name on public.suppliers(name);

-- ============================================================
-- purchase_orders
-- ============================================================
create table if not exists public.purchase_orders (
  id uuid primary key default uuid_generate_v4(),
  order_no text unique,
  supplier_id uuid references public.suppliers(id) on delete set null,
  status po_status not null default 'taslak',
  order_date date not null default current_date,
  expected_date date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_purchase_orders_supplier on public.purchase_orders(supplier_id);
create index if not exists idx_purchase_orders_created_by on public.purchase_orders(created_by);
create index if not exists idx_purchase_orders_status on public.purchase_orders(status);

-- ============================================================
-- purchase_order_items
-- ============================================================
create table if not exists public.purchase_order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.purchase_orders(id) on delete cascade,
  category po_item_category not null default 'diger',
  description text not null,
  tool_id uuid references public.tools(id) on delete set null,
  quantity numeric(12,2) not null default 1,
  unit text not null default 'adet',
  unit_price numeric(12,2),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_po_items_order on public.purchase_order_items(order_id);
create index if not exists idx_po_items_tool on public.purchase_order_items(tool_id);

-- ============================================================
-- updated_at triggers
-- ============================================================
do $$ declare t text;
begin
  for t in select unnest(array['suppliers','purchase_orders']) loop
    execute format('drop trigger if exists trg_%1$s_touch on public.%1$s', t);
    execute format(
      'create trigger trg_%1$s_touch before update on public.%1$s for each row execute function public.touch_updated_at()',
      t);
  end loop;
end $$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

do $$ declare t text;
begin
  for t in select unnest(array['suppliers','purchase_orders','purchase_order_items']) loop
    execute format('drop policy if exists "%1$s_read_auth" on public.%1$s', t);
    execute format(
      'create policy "%1$s_read_auth" on public.%1$s for select using ((select auth.uid()) is not null)',
      t);

    execute format('drop policy if exists "%1$s_insert_auth" on public.%1$s', t);
    execute format(
      'create policy "%1$s_insert_auth" on public.%1$s for insert with check ((select auth.uid()) is not null)',
      t);

    execute format('drop policy if exists "%1$s_update_auth" on public.%1$s', t);
    execute format(
      'create policy "%1$s_update_auth" on public.%1$s for update using ((select auth.uid()) is not null)',
      t);

    execute format('drop policy if exists "%1$s_delete_admin" on public.%1$s', t);
    execute format(
      'create policy "%1$s_delete_admin" on public.%1$s for delete using ((select public.is_admin()))',
      t);
  end loop;
end $$;
