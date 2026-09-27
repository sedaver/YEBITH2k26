CREATE SCHEMA IF NOT EXISTS festival;
CREATE TABLE festival.admin_users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL,
 role text NOT NULL CHECK(role IN ('admin','editor')), is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE festival.sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES festival.admin_users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON festival.sessions(expires_at);
CREATE TABLE festival.houses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 color text NOT NULL CHECK(color ~ '^#[0-9a-fA-F]{6}$'), logo_url text,
 is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX houses_name_unique ON festival.houses(lower(name));
CREATE TABLE festival.events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(name) BETWEEN 1 AND 150),
 category text NOT NULL, description text NOT NULL DEFAULT '', event_date timestamptz NOT NULL,
 status text NOT NULL CHECK(status IN ('upcoming','live','completed','cancelled')),
 image_url text, venue text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON festival.events(event_date DESC, id);
CREATE INDEX ON festival.events(category,status,event_date);
CREATE TABLE festival.results (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES festival.events(id) ON DELETE CASCADE,
 house_id uuid NOT NULL REFERENCES festival.houses(id) ON DELETE RESTRICT,
 category text NOT NULL, position integer NOT NULL CHECK(position > 0 AND position <= 10000),
 points numeric(12,2) NOT NULL CHECK(points >= 0 AND points <= 1000000), result_date timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(event_id,house_id,category)
);
CREATE INDEX ON festival.results(house_id);
CREATE INDEX ON festival.results(event_id);
CREATE INDEX ON festival.results(result_date DESC,id);
CREATE INDEX ON festival.results(category,result_date);
CREATE TABLE festival.gallery (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), image_url text NOT NULL, thumbnail_url text NOT NULL,
 image_key text NOT NULL UNIQUE, thumbnail_key text NOT NULL UNIQUE,
 caption text NOT NULL DEFAULT '', category text NOT NULL,
 event_id uuid REFERENCES festival.events(id) ON DELETE SET NULL,
 uploaded_by uuid NOT NULL REFERENCES festival.admin_users(id),
 width integer NOT NULL CHECK(width > 0), height integer NOT NULL CHECK(height > 0),
 uploaded_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON festival.gallery(uploaded_at DESC,id);
CREATE INDEX ON festival.gallery(category,event_id);
CREATE TABLE festival.storage_cleanup (object_key text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE festival.settings (
 id integer PRIMARY KEY CHECK(id=1), school_name text NOT NULL, festival_name text NOT NULL,
 description text NOT NULL, start_date date, end_date date,
 CHECK(end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
INSERT INTO festival.settings VALUES(1,'GHS BEENCHI','YEBETH2k26','Where creativity meets competition.',NULL,NULL);
CREATE TABLE festival.rate_limits (key text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE INDEX ON festival.rate_limits(expires_at);
-- A row revision serializes writes so clients never miss a late-committing sequence value.
CREATE TABLE festival.revision (id integer PRIMARY KEY CHECK(id=1), value bigint NOT NULL DEFAULT 0);
INSERT INTO festival.revision VALUES(1,0);
CREATE TABLE festival.audit_log (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid, action text NOT NULL,
 entity_id text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON festival.audit_log(created_at);
CREATE FUNCTION festival.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE FUNCTION festival.bump_revision() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN UPDATE festival.revision SET value=value+1 WHERE id=1; RETURN NULL; END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['admin_users','houses','events','results','gallery'] LOOP
  EXECUTE format('CREATE TRIGGER touch BEFORE UPDATE ON festival.%I FOR EACH ROW EXECUTE FUNCTION festival.touch_updated_at()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['houses','events','results','gallery','settings'] LOOP
  EXECUTE format('CREATE TRIGGER revision AFTER INSERT OR UPDATE OR DELETE ON festival.%I FOR EACH STATEMENT EXECUTE FUNCTION festival.bump_revision()',t);
 END LOOP;
END $$;
CREATE VIEW festival.house_scores AS
 SELECT h.*,coalesce(sum(r.points) FILTER(WHERE e.status <> 'cancelled'),0)::float8 AS points
 FROM festival.houses h LEFT JOIN festival.results r ON r.house_id=h.id
 LEFT JOIN festival.events e ON e.id=r.event_id GROUP BY h.id;
-- Private schema is never exposed through Supabase Data API; only the API's DB role uses it.
REVOKE ALL ON SCHEMA festival FROM PUBLIC;
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='festival' LOOP
  EXECUTE format('ALTER TABLE festival.%I ENABLE ROW LEVEL SECURITY',t);
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
  REVOKE ALL ON SCHEMA festival FROM anon, authenticated;
  REVOKE ALL ON ALL TABLES IN SCHEMA festival FROM anon, authenticated;
 END IF;
END $$;
