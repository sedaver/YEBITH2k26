-- Keep existing house results and totals; add candidate/team details and raw marks.
ALTER TABLE festival.results
 ADD COLUMN IF NOT EXISTS candidate_name text NOT NULL DEFAULT ''
 CHECK(length(candidate_name) <= 250),
 ADD COLUMN IF NOT EXISTS score numeric(12,2)
 CHECK(score >= 0 AND score <= 1000000);

ALTER TABLE festival.results
 DROP CONSTRAINT IF EXISTS results_event_id_house_id_category_key;

-- One result per candidate/team in an item, division and house. Empty names
-- retain the original duplicate protection for older house-only results.
CREATE UNIQUE INDEX IF NOT EXISTS results_candidate_unique
 ON festival.results(event_id,house_id,category,lower(btrim(candidate_name)));
