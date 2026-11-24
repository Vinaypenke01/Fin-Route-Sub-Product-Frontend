-- ==============================================================================
-- FINROUTE TENANT UPDATE 003: change history (audit trail)
-- Run in EACH tenant's own Supabase project (SQL Editor). Safe to run twice.
-- Requires updates 001 and 002.
--
-- The database itself records every change to the ledger: which record, the
-- old and new values, who made it and when. The app cannot skip or edit these
-- records; operators can only read them. Entries older than 2 years are pruned.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.change_log (
    id               BIGSERIAL PRIMARY KEY,
    table_name       TEXT NOT NULL,
    record_id        TEXT,
    action           TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
    old_values       JSONB,
    new_values       JSONB,
    changed_by       UUID,
    changed_by_email TEXT,
    changed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_log_changed_at ON public.change_log (changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_log_record ON public.change_log (table_name, record_id, changed_at DESC);

ALTER TABLE public.change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators read change log" ON public.change_log;
CREATE POLICY "Operators read change log"
ON public.change_log FOR SELECT TO authenticated
USING (public.is_finroute_operator());

-- Read-only for everyone except the trigger below (and the server)
REVOKE ALL ON public.change_log FROM anon, authenticated;
GRANT SELECT ON public.change_log TO authenticated;
REVOKE ALL ON SEQUENCE public.change_log_id_seq FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.finroute_log_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old JSONB := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
    v_new JSONB := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
    v_row JSONB := COALESCE(v_new, v_old);
    v_record_id TEXT;
    v_old_diff JSONB := '{}'::jsonb;
    v_new_diff JSONB := '{}'::jsonb;
    v_key TEXT;
BEGIN
    -- Payments removed only because their customer/week was deleted are noise:
    -- the customer/week deletion itself is recorded.
    IF TG_TABLE_NAME = 'payments' AND TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
        RETURN NULL;
    END IF;

    v_record_id := CASE TG_TABLE_NAME
        WHEN 'payments' THEN (v_row ->> 'customer_id') || ':' || (v_row ->> 'week_id')
        WHEN 'weekly_reconciliation' THEN v_row ->> 'week_id'
        ELSE v_row ->> 'id'
    END;

    IF TG_OP = 'UPDATE' THEN
        -- Keep only the fields that actually changed (ignore timestamps)
        FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
            IF v_key NOT IN ('updated_at', 'created_at')
               AND (v_old -> v_key) IS DISTINCT FROM (v_new -> v_key) THEN
                v_old_diff := v_old_diff || jsonb_build_object(v_key, v_old -> v_key);
                v_new_diff := v_new_diff || jsonb_build_object(v_key, v_new -> v_key);
            END IF;
        END LOOP;
        IF v_new_diff = '{}'::jsonb THEN
            RETURN NULL; -- nothing meaningful changed
        END IF;
        v_old := v_old_diff;
        v_new := v_new_diff;
    END IF;

    INSERT INTO public.change_log (table_name, record_id, action, old_values, new_values, changed_by, changed_by_email)
    VALUES (
        TG_TABLE_NAME,
        v_record_id,
        lower(TG_OP),
        v_old,
        v_new,
        auth.uid(),
        COALESCE(auth.jwt() ->> 'email', CASE WHEN auth.role() = 'service_role' THEN 'FinRoute server' ELSE NULL END)
    );

    -- Occasional cleanup: keep two years of history
    IF random() < 0.002 THEN
        DELETE FROM public.change_log WHERE changed_at < NOW() - INTERVAL '2 years';
    END IF;

    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.finroute_log_change() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['payments', 'customers', 'weekly_reconciliation', 'weeks', 'loan_archive', 'villages']
    LOOP
        IF to_regclass('public.' || t) IS NULL THEN
            CONTINUE;
        END IF;
        EXECUTE format('DROP TRIGGER IF EXISTS trg_finroute_change_log ON public.%I', t);
        EXECUTE format(
            'CREATE TRIGGER trg_finroute_change_log AFTER INSERT OR UPDATE OR DELETE ON public.%I '
            'FOR EACH ROW EXECUTE FUNCTION public.finroute_log_change()', t
        );
    END LOOP;
END $$;

INSERT INTO public.finroute_schema_version (version, name)
VALUES (3, 'change history')
ON CONFLICT (version) DO NOTHING;

-- Check: should return 3
SELECT max(version) AS current_version FROM public.finroute_schema_version;
