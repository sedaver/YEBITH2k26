-- Classify every published programme as Individual, Group, or Off-Stage.
-- The on-stage label is removed after all unambiguous items are assigned.

UPDATE festival.events
SET program_category_id=(SELECT id FROM festival.program_categories WHERE slug='off-stage')
WHERE name IN (
  'Speech - Malayalam - UP', 'Speech - English - UP', 'Speech - Hindi - UP',
  'Pencil Drawing - UP', 'Water Colour Painting - UP',
  'Story Writing - Hindi - UP', 'Poetry Writing - Malayalam - UP',
  'Story Writing - Malayalam - UP',
  'Water Colour Painting - LP', 'Pencil Drawing - LP', 'Arabic Poetry - LP',
  'Riddle - LP', 'Malayalam Action Song - LP', 'English Action Song - LP',
  'Speech - LP', 'English Recitation - LP', 'Malayalam Storytelling - LP',
  'Speech - Malayalam - HS', 'Speech - English - HS', 'Speech - Hindi - HS',
  'Poetry Recitation - Urdu - HS', 'Poetry Recitation - Hindi - HS',
  'Poetry Recitation - Arabic - HS', 'Poetry Recitation - English - HS',
  'Pencil Drawing - HS', 'Water Colour Painting - HS', 'Cartoon Drawing - HS',
  'Story Writing - Malayalam - HS', 'Story Writing - English - HS',
  'Story Writing - Hindi - HS', 'Story Writing - Arabic - HS',
  'Story Writing - Sanskrit - HS', 'Poetry Writing - Malayalam - HS',
  'Poetry Writing - Hindi - HS', 'Poetry Writing - English - HS',
  'Poetry Writing - Sanskrit - HS', 'Poetry Writing - Arabic - HS'
);

UPDATE festival.events
SET program_category_id=(SELECT id FROM festival.program_categories WHERE slug='individual')
WHERE name IN (
  'Poetry Recitation - Malayalam - UP', 'Poetry Recitation - English - UP',
  'Poetry Recitation - Hindi - UP', 'Poetry Recitation - Arabic - UP',
  'Poetry Recitation - Urdu - UP', 'Light Music - UP', 'Mappilappattu - UP',
  'Folk Dance - UP', 'Bharatanatyam - UP', 'Mohiniyattam - UP',
  'Kuchipudi - UP', 'Mono Act - UP', 'Kathaprasangam - UP',
  'Patriotic Song - UP',
  'Light Music - LP', 'Mappilappattu - LP', 'Malayalam Poetry - LP',
  'Mono Act - LP', 'Folk Dance - LP', 'Patriotic Song - LP',
  'Poetry Recitation - Malayalam - HS', 'Light Music - Male - HS',
  'Light Music - Female - HS', 'Mappilappattu - Male - HS',
  'Mappilappattu - Female - HS', 'Classical Music - Female - HS',
  'Folk Dance - Female - HS', 'Kathaprasangam - HS', 'Bharatanatyam - HS',
  'Kerala Nadanam - HS', 'Mono Act - HS'
);

UPDATE festival.events
SET program_category_id=(SELECT id FROM festival.program_categories WHERE slug='group')
WHERE name IN (
  'Group Song - UP', 'Oppana - UP', 'Group Dance - UP',
  'Group Dance - LP', 'Group Song - HS', 'Drama - HS',
  'Group Dance - HS', 'Vattappattu - HS', 'Oppana - HS'
);

-- Keep only the three programme categories used by the festival.
UPDATE festival.program_categories
SET is_active=false
WHERE slug IN ('on-stage','other');
