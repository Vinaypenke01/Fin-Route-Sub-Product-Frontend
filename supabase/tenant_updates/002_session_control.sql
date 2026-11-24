-- ==============================================================================
-- FINROUTE TENANT UPDATE 002: session control
-- Run in EACH tenant's own Supabase project (SQL Editor). Safe to run twice.
-- Requires update 001.
--
-- Lets the FinRoute server end an operator's sign-in on this database
-- (used by the admin "End session" button for a lost or stolen phone).
-- Only the server (service role) can call it.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.finroute_revoke_user_sessions(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
    v_count INT;
BEGIN
    DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.finroute_revoke_user_sessions(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finroute_revoke_user_sessions(UUID) TO service_role;

INSERT INTO public.finroute_schema_version (version, name)
VALUES (2, 'session control')
ON CONFLICT (version) DO NOTHING;

-- Check: should return 2
SELECT max(version) AS current_version FROM public.finroute_schema_version;
