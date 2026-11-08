-- ==============================================================================
-- FINROUTE TENANT DATABASE: HIERARCHICAL VILLAGE_ID BACKFILL & REPAIR SCRIPT
-- Run this in your Tenant Supabase SQL Editor to automatically link all customers
-- to their corresponding village_id and village_name based on route order.
-- ==============================================================================

DO $$
DECLARE
    rec RECORD;
    v_current_vil_id VARCHAR(100) := NULL;
    v_current_vil_name VARCHAR(255) := NULL;
    v_vil_counter INT := 0;
    v_updated_count INT := 0;
BEGIN
    -- 1. Ensure existing village dividers are registered in the 'villages' table
    FOR rec IN 
        SELECT id, name, village_name, row_order 
        FROM customers 
        WHERE is_village_divider = TRUE 
        ORDER BY row_order ASC
    LOOP
        v_vil_counter := v_vil_counter + 1;
        v_current_vil_name := TRIM(REPLACE(REPLACE(COALESCE(NULLIF(rec.village_name, ''), rec.name), '📍 VILLAGE:', ''), 'VILLAGE:', ''));
        
        -- Check if village already exists by name
        SELECT id INTO v_current_vil_id FROM villages WHERE LOWER(TRIM(name)) = LOWER(v_current_vil_name) LIMIT 1;
        
        IF v_current_vil_id IS NULL THEN
            v_current_vil_id := 'VIL-' || v_vil_counter;
            INSERT INTO villages (id, name, display_order)
            VALUES (v_current_vil_id, v_current_vil_name, v_vil_counter)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
        END IF;

        -- Update the divider row itself
        UPDATE customers 
        SET village_id = v_current_vil_id,
            village_name = v_current_vil_name
        WHERE id = rec.id;
    END LOOP;

    -- 2. Traverse all customer rows in route order and assign village_id & village_name
    v_current_vil_id := NULL;
    v_current_vil_name := NULL;

    FOR rec IN 
        SELECT id, is_village_divider, name, village_name, village_id, row_order 
        FROM customers 
        ORDER BY row_order ASC
    LOOP
        IF rec.is_village_divider THEN
            v_current_vil_name := TRIM(REPLACE(REPLACE(COALESCE(NULLIF(rec.village_name, ''), rec.name), '📍 VILLAGE:', ''), 'VILLAGE:', ''));
            SELECT id INTO v_current_vil_id FROM villages WHERE LOWER(TRIM(name)) = LOWER(v_current_vil_name) LIMIT 1;
        ELSE
            IF v_current_vil_id IS NOT NULL THEN
                UPDATE customers 
                SET village_id = v_current_vil_id,
                    village_name = v_current_vil_name
                WHERE id = rec.id 
                  AND (village_id IS NULL OR village_name IS NULL OR village_name = '');
                v_updated_count := v_updated_count + 1;
            END IF;
        END IF;
    END LOOP;

    RAISE NOTICE 'Successfully backfilled village_id for customers! (Updated % records across % villages)', v_updated_count, v_vil_counter;
END $$;

-- 3. Verification Query: Check village distribution
SELECT 
    COALESCE(v.id, 'NO_VILLAGE') AS village_id,
    COALESCE(v.name, 'Unassigned') AS village_name,
    COUNT(c.id) AS total_customers,
    COALESCE(SUM(c.disbursed), 0) AS total_disbursed
FROM customers c
LEFT JOIN villages v ON c.village_id = v.id
WHERE c.is_village_divider = FALSE
GROUP BY v.id, v.name, v.display_order
ORDER BY COALESCE(v.display_order, 9999) ASC;

