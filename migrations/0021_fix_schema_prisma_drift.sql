-- ============================================================================
-- Migration 0021: Fix Prisma <-> raw-SQL schema drift found in project audit
-- ============================================================================
-- 1. PermissionModule.TRANSPORT and MessageType.TRANSPORT_ALERT are declared
--    in prisma/schema.prisma but were never added to the Postgres enum types
--    (the transport migration 0016 predates this and was never updated).
-- 2. school_subscriptions.startDate/endDate were declared unquoted in 0002,
--    so Postgres folded them to `startdate`/`enddate`, but Prisma maps the
--    model fields to `start_date`/`end_date` (matching every sibling table,
--    e.g. subscription_periods.start_date/end_date already use this form).
-- 3. promotion_items.source_class_id/source_section_id were declared
--    VARCHAR(50) in 0004 while target_class_id/target_section_id (and the
--    Prisma schema) correctly use UUID -- the app always writes real class/
--    section UUIDs into these columns (see src/app/api/school/enrollments/
--    promotion/route.ts), so this was a plain typo, not a deliberate choice.
-- 4. route_stops.pickup_time/dropoff_time and transport_trips.
--    scheduled_start_time/scheduled_end_time were declared as native TIME
--    in 0016, but the app (Zod validation, <input type="time"> forms,
--    TypeScript types) has always treated them as "HH:MM" strings, matching
--    the Prisma schema's `String @db.VarChar(20)`. Converting the columns to
--    match the app's actual usage, not the other way around.
-- ============================================================================

-- 1. Missing enum values
DO $$ BEGIN
  ALTER TYPE "PermissionModule" ADD VALUE IF NOT EXISTS 'TRANSPORT';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'TRANSPORT_ALERT';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. school_subscriptions column name drift
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'school_subscriptions' AND column_name = 'startdate'
  ) THEN
    ALTER TABLE school_subscriptions RENAME COLUMN startdate TO start_date;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'school_subscriptions' AND column_name = 'enddate'
  ) THEN
    ALTER TABLE school_subscriptions RENAME COLUMN enddate TO end_date;
  END IF;
END $$;

-- 3. promotion_items source_class_id/source_section_id type drift (VARCHAR -> UUID)
ALTER TABLE promotion_items
  ALTER COLUMN source_class_id TYPE UUID USING source_class_id::uuid,
  ALTER COLUMN source_section_id TYPE UUID USING source_section_id::uuid;

-- 4. route_stops / transport_trips time column type drift (TIME -> VARCHAR(20))
ALTER TABLE route_stops
  ALTER COLUMN pickup_time TYPE VARCHAR(20) USING to_char(pickup_time, 'HH24:MI'),
  ALTER COLUMN dropoff_time TYPE VARCHAR(20) USING to_char(dropoff_time, 'HH24:MI');

ALTER TABLE transport_trips
  ALTER COLUMN scheduled_start_time TYPE VARCHAR(20) USING to_char(scheduled_start_time, 'HH24:MI'),
  ALTER COLUMN scheduled_end_time TYPE VARCHAR(20) USING to_char(scheduled_end_time, 'HH24:MI');
