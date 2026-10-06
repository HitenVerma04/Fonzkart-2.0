-- Fonzkart: close the Supabase public API (PostgREST /rest/v1, Realtime) over the app's tables.
--
-- WHY: on the supabase/postgres image, every table created in schema "public" by "postgres" (which is how Prisma
-- creates Fonzkart's tables) is granted SELECT/INSERT/UPDATE/DELETE to the API roles "anon" and "authenticated" by
-- default privileges. With PostgREST exposed through Kong at /rest/v1, the public anon key (shipped to every browser
-- as NEXT_PUBLIC_SUPABASE_ANON_KEY) is then enough to read every "User" row including "passwordHash" and
-- "resetToken", and to change or delete any order. The Fonzkart app never uses the REST API: it talks to PostgreSQL
-- directly through Prisma as "postgres", which this script does not touch.
--
-- WHAT: revokes all privileges of anon and authenticated on existing tables, sequences and functions in "public",
-- and removes the default privileges that would grant them on tables created later (e.g. by prisma db push).
-- service_role is left as is (its key is secret and server-only; Fonzkart does not use it either).
--
-- SAFE TO RE-RUN. Run as "postgres" (Supabase Studio → SQL editor, or psql) on the Supabase database.
-- Take a backup first. Undo: see the bottom of this file.

DO $$
DECLARE
    api_role text;
    owner_role text;
BEGIN
    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
            RAISE NOTICE 'role % does not exist, skipped', api_role;
            CONTINUE;
        END IF;

        EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', api_role);
        EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', api_role);
        EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', api_role);

        -- Future objects: the defaults of every owner the current user may change. Prisma's tables are created by
        -- "postgres"; "supabase_admin" (Supabase's own objects) is changed only when run by a member of it.
        FOREACH owner_role IN ARRAY ARRAY['postgres', 'supabase_admin'] LOOP
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = owner_role) THEN
                CONTINUE;
            ELSIF NOT pg_has_role(current_user, owner_role, 'MEMBER') THEN
                RAISE NOTICE 'default privileges of % left unchanged (run as a member of % to change them)', owner_role, owner_role;
            ELSE
                EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM %I', owner_role, api_role);
                EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', owner_role, api_role);
                EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', owner_role, api_role);
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- Check: both queries must return no rows (the second only for owners whose defaults you could change).
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated');

SELECT pg_get_userbyid(defaclrole) AS owner, defaclobjtype AS kind, defaclacl AS acl
FROM pg_default_acl
WHERE defaclnamespace = 'public'::regnamespace
  AND pg_has_role(current_user, defaclrole, 'MEMBER')
  AND (defaclacl::text LIKE '%anon=%' OR defaclacl::text LIKE '%authenticated=%');

-- UNDO (restores Supabase's defaults — only if something you rely on needs the REST API):
--   GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
--   GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
--   GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
--   (and the same for SEQUENCES / FUNCTIONS, and FOR ROLE supabase_admin)
