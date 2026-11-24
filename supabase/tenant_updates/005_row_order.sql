-- ==============================================================================
-- FINROUTE TENANT UPDATE 005: faster route reordering
-- Run in EACH tenant's own Supabase project (SQL Editor). Safe to run twice.
-- Requires updates 001-004.
--
-- Saves the whole route order in one request instead of one request per
-- customer (much faster on mobile data). Runs with the operator's own
-- permissions, so the normal access rules still apply.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.finroute_set_row_order(p_ids TEXT[])
RETURNS INT
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
    WITH ordered AS (
        SELECT id, ord::INT AS row_order
        FROM unnest(p_ids) WITH ORDINALITY AS t(id, ord)
    ),
    changed AS (
        UPDATE public.customers c
        SET row_order = o.row_order
        FROM ordered o
        WHERE c.id = o.id AND c.row_order IS DISTINCT FROM o.row_order
        RETURNING 1
    )
    SELECT count(*)::INT FROM changed;
$$;

REVOKE ALL ON FUNCTION public.finroute_set_row_order(TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finroute_set_row_order(TEXT[]) TO authenticated, service_role;

INSERT INTO public.finroute_schema_version (version, name)
VALUES (5, 'faster route reordering')
ON CONFLICT (version) DO NOTHING;

-- Check: should return 5
SELECT max(version) AS current_version FROM public.finroute_schema_version;
