-- Restore the standardized drawing entries if an earlier cleanup matched them
-- case-insensitively alongside the older spellings.
INSERT INTO festival.events(name, category, description, event_date, status, venue, program_category_id)
SELECT e.name, e.category, e.description, '2026-09-28T09:00:00+05:30'::timestamptz,
       'upcoming', 'GHS BEENCHI', pc.id
FROM (VALUES
  ('Pencil Drawing - LP', 'Drawing', 'Off-Stage · Division: LP', 'off-stage'),
  ('Pencil Drawing - UP', 'Drawing', 'Off-Stage · Division: UP', 'off-stage')
) AS e(name, category, description, program_slug)
JOIN festival.program_categories pc ON pc.slug=e.program_slug
WHERE NOT EXISTS (
  SELECT 1 FROM festival.events existing WHERE lower(existing.name)=lower(e.name)
);
