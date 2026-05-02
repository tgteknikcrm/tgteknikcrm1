-- ============================================================
-- 0036 — Product time fields → NUMERIC for sub-minute precision
-- ============================================================
--
-- Goal: support minute+second precision (e.g. 5 dk 30 sn = 5.5).
-- The user's complaint: "bağlama temizlik vs sürelerde 1 dakikanın
-- altında mesela dakika ve saniyede olmalı" — some setups and cycles
-- run in seconds, not whole minutes. INT columns silently truncated
-- 0.5 → 0, breaking the math.
--
-- cleanup_time_minutes is already NUMERIC (0029). This brings the
-- other two in line.
-- ============================================================

ALTER TABLE products
  ALTER COLUMN cycle_time_minutes TYPE numeric USING cycle_time_minutes::numeric;

ALTER TABLE products
  ALTER COLUMN setup_time_minutes TYPE numeric USING setup_time_minutes::numeric;

-- Sanity check constraints — same as cleanup got in 0029.
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_cycle_time_minutes_check;
ALTER TABLE products
  ADD CONSTRAINT products_cycle_time_minutes_check
    CHECK (cycle_time_minutes IS NULL OR cycle_time_minutes >= 0);

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_setup_time_minutes_check;
ALTER TABLE products
  ADD CONSTRAINT products_setup_time_minutes_check
    CHECK (setup_time_minutes IS NULL OR setup_time_minutes >= 0);
