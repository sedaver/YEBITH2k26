-- Festival programme for the UP and LP divisions.
-- Event names include the division so result entry and public filters can identify it.
INSERT INTO festival.program_categories(name, slug, sort_order)
VALUES ('On-Stage', 'on-stage', 35)
ON CONFLICT (slug) DO NOTHING;

WITH new_events(name, discipline, program_slug, division, stage) AS (VALUES
  ('Speech - Malayalam - UP', 'Literary', 'off-stage', 'UP', 'Off-Stage'),
  ('Speech - English - UP', 'Literary', 'off-stage', 'UP', 'Off-Stage'),
  ('Speech - Hindi - UP', 'Literary', 'off-stage', 'UP', 'Off-Stage'),
  ('Pencil Drawing - UP', 'Drawing', 'off-stage', 'UP', 'Off-Stage'),
  ('Water Colour Painting - UP', 'Painting', 'off-stage', 'UP', 'Off-Stage'),
  ('Story Writing - Hindi - UP', 'Literary', 'off-stage', 'UP', 'Off-Stage'),
  ('Poetry Writing - Malayalam - UP', 'Literary', 'off-stage', 'UP', 'Off-Stage'),
  ('Story Writing - Malayalam - UP', 'Literary', 'off-stage', 'UP', 'Off-Stage'),
  ('Poetry Recitation - Malayalam - UP', 'Recitation', 'on-stage', 'UP', 'On-Stage'),
  ('Poetry Recitation - English - UP', 'Recitation', 'on-stage', 'UP', 'On-Stage'),
  ('Poetry Recitation - Hindi - UP', 'Recitation', 'on-stage', 'UP', 'On-Stage'),
  ('Poetry Recitation - Arabic - UP', 'Recitation', 'on-stage', 'UP', 'On-Stage'),
  ('Poetry Recitation - Urdu - UP', 'Recitation', 'on-stage', 'UP', 'On-Stage'),
  ('Light Music - UP', 'Music', 'on-stage', 'UP', 'On-Stage'),
  ('Mappilappattu - UP', 'Music', 'on-stage', 'UP', 'On-Stage'),
  ('Folk Dance - UP', 'Dance', 'on-stage', 'UP', 'On-Stage'),
  ('Bharatanatyam - UP', 'Dance', 'on-stage', 'UP', 'On-Stage'),
  ('Mohiniyattam - UP', 'Dance', 'on-stage', 'UP', 'On-Stage'),
  ('Kuchipudi - UP', 'Dance', 'on-stage', 'UP', 'On-Stage'),
  ('Mono Act - UP', 'Drama', 'on-stage', 'UP', 'On-Stage'),
  ('Kathaprasangam - UP', 'Drama', 'on-stage', 'UP', 'On-Stage'),
  ('Group Song - UP', 'Music', 'on-stage', 'UP', 'On-Stage'),
  ('Oppana - UP', 'Dance', 'on-stage', 'UP', 'On-Stage'),
  ('Group Dance - UP', 'Dance', 'on-stage', 'UP', 'On-Stage'),
  ('Patriotic Song - UP', 'Music', 'on-stage', 'UP', 'On-Stage'),
  ('Water Colour Painting - LP', 'Painting', 'off-stage', 'LP', 'Off-Stage'),
  ('Pencil Drawing - LP', 'Drawing', 'off-stage', 'LP', 'Off-Stage'),
  ('Arabic Poetry - LP', 'Literary', 'off-stage', 'LP', 'Off-Stage'),
  ('Riddle - LP', 'Quiz', 'off-stage', 'LP', 'Off-Stage'),
  ('Malayalam Action Song - LP', 'Music', 'off-stage', 'LP', 'Off-Stage'),
  ('English Action Song - LP', 'Music', 'off-stage', 'LP', 'Off-Stage'),
  ('Speech - LP', 'Literary', 'off-stage', 'LP', 'Off-Stage'),
  ('English Recitation - LP', 'Recitation', 'off-stage', 'LP', 'Off-Stage'),
  ('Malayalam Storytelling - LP', 'Literary', 'off-stage', 'LP', 'Off-Stage'),
  ('Light Music - LP', 'Music', 'on-stage', 'LP', 'On-Stage'),
  ('Mappilappattu - LP', 'Music', 'on-stage', 'LP', 'On-Stage'),
  ('Malayalam Poetry - LP', 'Literary', 'on-stage', 'LP', 'On-Stage'),
  ('Mono Act - LP', 'Drama', 'on-stage', 'LP', 'On-Stage'),
  ('Folk Dance - LP', 'Dance', 'on-stage', 'LP', 'On-Stage'),
  ('Patriotic Song - LP', 'Music', 'on-stage', 'LP', 'On-Stage'),
  ('Group Dance - LP', 'Dance', 'on-stage', 'LP', 'On-Stage')
)
INSERT INTO festival.events(name, category, description, event_date, status, venue, program_category_id)
SELECT e.name,
       e.discipline,
       e.stage || ' · Division: ' || e.division,
       '2026-09-28T09:00:00+05:30'::timestamptz,
       'upcoming',
       'GHS BEENCHI',
       pc.id
FROM new_events e
JOIN festival.program_categories pc ON pc.slug=e.program_slug
WHERE NOT EXISTS (
  SELECT 1 FROM festival.events existing WHERE lower(existing.name)=lower(e.name)
);
