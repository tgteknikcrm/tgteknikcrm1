-- ┌──────────────────────────────────────────────────────────────────┐
-- │  Tasks RLS: relax UPDATE/DELETE so any authenticated user can    │
-- │  manage any task — small team (5-person CNC shop), everyone      │
-- │  drags everyone's cards on the kanban.                           │
-- │                                                                  │
-- │  Why this matters: Supabase JS does NOT raise an error when an   │
-- │  UPDATE matches 0 rows due to RLS — it returns success with no   │
-- │  data. Drag-and-drop on the kanban silently failed for tasks the │
-- │  current user didn't own; the optimistic UI moved the card, but  │
-- │  router.refresh() pulled the old status back, so the card        │
-- │  snapped to its previous column. Aligns with suppliers /         │
-- │  machines / products policies which are also `using (true)`.     │
-- └──────────────────────────────────────────────────────────────────┘

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (true)
  with check (true);

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated
  using (true);

-- Same idea for the related tables — checklist + comments — so any
-- shop member can tick / un-tick / comment on any task.
drop policy if exists task_checklist_update on public.task_checklist;
create policy task_checklist_update on public.task_checklist
  for update to authenticated
  using (true)
  with check (true);

drop policy if exists task_checklist_delete on public.task_checklist;
create policy task_checklist_delete on public.task_checklist
  for delete to authenticated
  using (true);

drop policy if exists task_comments_update on public.task_comments;
create policy task_comments_update on public.task_comments
  for update to authenticated
  using (true)
  with check (true);

drop policy if exists task_comments_delete on public.task_comments;
create policy task_comments_delete on public.task_comments
  for delete to authenticated
  using (true);
