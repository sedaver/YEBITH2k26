-- Program classification is intentionally separate from the existing art discipline
-- (events.category) and result division (results.category).
CREATE TABLE festival.program_categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 slug text NOT NULL CHECK(slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
 sort_order integer NOT NULL DEFAULT 100 CHECK(sort_order >= 0),
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX program_categories_name_unique ON festival.program_categories(lower(name));
CREATE UNIQUE INDEX program_categories_slug_unique ON festival.program_categories(slug);
INSERT INTO festival.program_categories(name,slug,sort_order) VALUES
 ('Individual','individual',10),
 ('Group','group',20),
 ('Off-Stage','off-stage',30),
 ('Other','other',40);

ALTER TABLE festival.events ADD COLUMN program_category_id uuid;
UPDATE festival.events
 SET program_category_id=(SELECT id FROM festival.program_categories WHERE slug='other')
 WHERE program_category_id IS NULL;
ALTER TABLE festival.events ALTER COLUMN program_category_id SET NOT NULL;
ALTER TABLE festival.events ADD CONSTRAINT events_program_category_fk
 FOREIGN KEY(program_category_id) REFERENCES festival.program_categories(id) ON DELETE RESTRICT;
CREATE INDEX events_program_category_index ON festival.events(program_category_id,status,event_date);

CREATE TRIGGER touch BEFORE UPDATE ON festival.program_categories
 FOR EACH ROW EXECUTE FUNCTION festival.touch_updated_at();
CREATE TRIGGER revision AFTER INSERT OR UPDATE OR DELETE ON festival.program_categories
 FOR EACH STATEMENT EXECUTE FUNCTION festival.bump_revision();

ALTER TABLE festival.program_categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON festival.program_categories FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
  REVOKE ALL ON festival.program_categories FROM anon, authenticated;
 END IF;
END $$;
