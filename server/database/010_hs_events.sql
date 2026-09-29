-- High School programme for the HS division.
-- Names include the division so result entry and public filters can identify it.
WITH new_events(name, discipline, program_slug, stage) AS (VALUES
  ('Speech - Malayalam - HS', 'Literary', 'off-stage', 'Off-Stage'),
  ('Speech - English - HS', 'Literary', 'off-stage', 'Off-Stage'),
  ('Speech - Hindi - HS', 'Literary', 'off-stage', 'Off-Stage'),
  ('Poetry Recitation - Urdu - HS', 'Recitation', 'off-stage', 'Off-Stage'),
  ('Poetry Recitation - Hindi - HS', 'Recitation', 'off-stage', 'Off-Stage'),
  ('Poetry Recitation - Arabic - HS', 'Recitation', 'off-stage', 'Off-Stage'),
  ('Poetry Recitation - English - HS', 'Recitation', 'off-stage', 'Off-Stage'),
  ('Pencil Drawing - HS', 'Drawing', 'off-stage', 'Off-Stage'),
  ('Water Colour Painting - HS', 'Painting', 'off-stage', 'Off-Stage'),
  ('Cartoon Drawing - HS', 'Drawing', 'off-stage', 'Off-Stage'),
  ('Story Writing - Malayalam - HS', 'Literary', 'off-stage', 'Off-Stage'),
  ('Story Writing - English - HS', 'Literary', 'off-stage', 'Off-Stage'),
  ('Story Writing - Hindi - HS', 'Literary', 'off-stage', 'Off-Stage'),
  ('Story Writing - Arabic - HS', 'Literary', 'off-stage', 'Off-Stage'),
  ('Story Writing - Sanskrit - HS', 'Literary', 'off-stage', 'Off-Stage'),
  ('Poetry Writing - Malayalam - HS', 'Literary', 'off-stage', 'Off-Stage'),
  ('Poetry Writing - Hindi - HS', 'Literary', 'off-stage', 'Off-Stage'),
  ('Poetry Writing - English - HS', 'Literary', 'off-stage', 'Off-Stage'),
  ('Poetry Writing - Sanskrit - HS', 'Literary', 'off-stage', 'Off-Stage'),
  ('Poetry Writing - Arabic - HS', 'Literary', 'off-stage', 'Off-Stage'),
  ('Poetry Recitation - Malayalam - HS', 'Recitation', 'individual', 'On-Stage'),
  ('Light Music - Male - HS', 'Music', 'individual', 'On-Stage'),
  ('Light Music - Female - HS', 'Music', 'individual', 'On-Stage'),
  ('Mappilappattu - Male - HS', 'Music', 'individual', 'On-Stage'),
  ('Mappilappattu - Female - HS', 'Music', 'individual', 'On-Stage'),
  ('Classical Music - Female - HS', 'Music', 'individual', 'On-Stage'),
  ('Folk Dance - Female - HS', 'Dance', 'individual', 'On-Stage'),
  ('Kathaprasangam - HS', 'Drama', 'individual', 'On-Stage'),
  ('Bharatanatyam - HS', 'Dance', 'individual', 'On-Stage'),
  ('Kerala Nadanam - HS', 'Dance', 'individual', 'On-Stage'),
  ('Mono Act - HS', 'Drama', 'individual', 'On-Stage'),
  ('Group Song - HS', 'Music', 'group', 'On-Stage'),
  ('Drama - HS', 'Drama', 'group', 'On-Stage'),
  ('Group Dance - HS', 'Dance', 'group', 'On-Stage'),
  ('Vattappattu - HS', 'Music', 'group', 'On-Stage'),
  ('Oppana - HS', 'Dance', 'group', 'On-Stage')
)
INSERT INTO festival.events(name, category, description, event_date, status, venue, program_category_id)
SELECT e.name,
       e.discipline,
       e.stage || ' · Division: HS',
       '2026-09-28T09:00:00+05:30'::timestamptz,
       'upcoming',
       'GHS BEENCHI',
       pc.id
FROM new_events e
JOIN festival.program_categories pc ON pc.slug=e.program_slug
WHERE NOT EXISTS (
  SELECT 1 FROM festival.events existing WHERE lower(existing.name)=lower(e.name)
);
