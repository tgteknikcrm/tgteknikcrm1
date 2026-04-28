-- TG Teknik CRM - QC Spec bubble image coordinates
-- Allows specs to be visually placed on a linked technical drawing.
-- Coordinates are NORMALIZED (0..1) so they survive image resize.

alter table public.quality_specs
  add column if not exists bubble_x numeric(8,6),
  add column if not exists bubble_y numeric(8,6);

create index if not exists idx_qc_specs_drawing_with_coords
  on public.quality_specs(drawing_id)
  where drawing_id is not null and bubble_x is not null;
