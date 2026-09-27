-- Supabase owns password hashing and auth identity. Deleting an auth user immediately
-- disables their local profile and removes server sessions without removing upload history.
CREATE FUNCTION festival.revoke_deleted_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
 BEGIN
  UPDATE festival.admin_users SET is_active=false WHERE id=OLD.id;
  DELETE FROM festival.sessions WHERE user_id=OLD.id;
  RETURN OLD;
 END $$;
DO $$ BEGIN
 IF to_regclass('auth.users') IS NOT NULL THEN
  EXECUTE 'CREATE TRIGGER festival_identity_deleted BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION festival.revoke_deleted_identity()';
 END IF;
END $$;
REVOKE ALL ON FUNCTION festival.revoke_deleted_identity() FROM PUBLIC;
