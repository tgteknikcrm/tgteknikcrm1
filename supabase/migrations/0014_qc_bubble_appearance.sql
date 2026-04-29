-- Bubble appearance: size + shape per QC spec.
-- Lets users style markers on the technical drawing (small/medium/large/xl
-- and circle/square/diamond/triangle/hexagon/star).

alter table public.quality_specs
  add column if not exists bubble_size text not null default 'md',
  add column if not exists bubble_shape text not null default 'circle';

-- Constrain to known values; drop-and-recreate guards re-runs.
alter table public.quality_specs
  drop constraint if exists quality_specs_bubble_size_check;
alter table public.quality_specs
  add constraint quality_specs_bubble_size_check
  check (bubble_size in ('sm', 'md', 'lg', 'xl'));

alter table public.quality_specs
  drop constraint if exists quality_specs_bubble_shape_check;
alter table public.quality_specs
  add constraint quality_specs_bubble_shape_check
  check (bubble_shape in ('circle', 'square', 'diamond', 'triangle', 'hexagon', 'star'));
