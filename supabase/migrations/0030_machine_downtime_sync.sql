-- ============================================================
-- 0030 — Machine status → job downtime auto-sync
-- ============================================================
--
-- Goal: when an operator flips a machine to durus / bakim / ariza
-- mid-run, we want the elapsed minutes to land on the active job's
-- production_entry as `downtime_minutes` automatically — no manual
-- "+ Üretim" form filling.
--
-- Approach: a session table that opens on aktif → not-aktif transition
-- and closes on not-aktif → aktif (or when the next non-aktif state
-- starts). On close we compute elapsed minutes and credit them to the
-- production_entry that was active when the session opened.
--
-- The trigger runs SECURITY DEFINER so RLS doesn't get in the way of
-- the cross-table accounting; the policy on the session table is
-- still gated by auth.
-- ============================================================

CREATE TABLE IF NOT EXISTS machine_downtime_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  status machine_status NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  production_entry_id UUID REFERENCES production_entries(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mds_machine_open_idx
  ON machine_downtime_sessions(machine_id) WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS mds_started_at_idx
  ON machine_downtime_sessions(started_at DESC);

ALTER TABLE machine_downtime_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mds_select ON machine_downtime_sessions;
CREATE POLICY mds_select ON machine_downtime_sessions
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS mds_insert ON machine_downtime_sessions;
CREATE POLICY mds_insert ON machine_downtime_sessions
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS mds_update ON machine_downtime_sessions;
CREATE POLICY mds_update ON machine_downtime_sessions
  FOR UPDATE USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS mds_delete ON machine_downtime_sessions;
CREATE POLICY mds_delete ON machine_downtime_sessions
  FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- Helper: find the machine's currently-active job + today's open entry
CREATE OR REPLACE FUNCTION _active_job_entry_for_machine(p_machine UUID)
RETURNS TABLE (job_id UUID, entry_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job UUID;
  v_entry UUID;
BEGIN
  SELECT id INTO v_job
  FROM jobs
  WHERE machine_id = p_machine
    AND status IN ('ayar', 'uretimde')
  ORDER BY priority DESC, created_at ASC
  LIMIT 1;

  IF v_job IS NOT NULL THEN
    SELECT pe.id INTO v_entry
    FROM production_entries pe
    WHERE pe.machine_id = p_machine
      AND pe.job_id = v_job
      AND pe.end_time IS NULL
      AND pe.entry_date = (CURRENT_DATE AT TIME ZONE 'Europe/Istanbul')::date
    ORDER BY pe.created_at DESC
    LIMIT 1;
  END IF;

  RETURN QUERY SELECT v_job, v_entry;
END;
$$;

-- Close any open session and credit minutes to its entry. Returns the
-- session id closed (or NULL if none was open).
CREATE OR REPLACE FUNCTION _close_open_downtime_session(p_machine UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_elapsed INT;
BEGIN
  SELECT * INTO v_session
  FROM machine_downtime_sessions
  WHERE machine_id = p_machine AND ended_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_session.id IS NULL THEN
    RETURN NULL;
  END IF;

  v_elapsed := GREATEST(
    0,
    FLOOR(EXTRACT(EPOCH FROM (NOW() - v_session.started_at)) / 60)::int
  );

  UPDATE machine_downtime_sessions
  SET ended_at = NOW()
  WHERE id = v_session.id;

  IF v_session.production_entry_id IS NOT NULL AND v_elapsed > 0 THEN
    UPDATE production_entries
    SET downtime_minutes = COALESCE(downtime_minutes, 0) + v_elapsed
    WHERE id = v_session.production_entry_id;
  END IF;

  RETURN v_session.id;
END;
$$;

-- Trigger function: react to machine.status changes
CREATE OR REPLACE FUNCTION sync_machine_downtime()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active RECORD;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Going INTO a non-aktif state: close any leftover, then open fresh.
  IF NEW.status <> 'aktif' THEN
    PERFORM _close_open_downtime_session(NEW.id);
    SELECT * INTO v_active FROM _active_job_entry_for_machine(NEW.id);
    INSERT INTO machine_downtime_sessions
      (machine_id, status, job_id, production_entry_id)
    VALUES
      (NEW.id, NEW.status, v_active.job_id, v_active.entry_id);
    RETURN NEW;
  END IF;

  -- Going BACK to aktif: just close the open session.
  IF NEW.status = 'aktif' THEN
    PERFORM _close_open_downtime_session(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS machine_status_downtime_sync ON machines;
CREATE TRIGGER machine_status_downtime_sync
  AFTER UPDATE OF status ON machines
  FOR EACH ROW
  EXECUTE FUNCTION sync_machine_downtime();

-- Convenience view for UI: open downtime sessions per machine
CREATE OR REPLACE VIEW v_machine_active_downtime AS
SELECT
  s.machine_id,
  s.status,
  s.started_at,
  s.job_id,
  s.production_entry_id,
  FLOOR(EXTRACT(EPOCH FROM (NOW() - s.started_at)) / 60)::int AS elapsed_minutes
FROM machine_downtime_sessions s
WHERE s.ended_at IS NULL;

ALTER VIEW v_machine_active_downtime SET (security_invoker = true);
