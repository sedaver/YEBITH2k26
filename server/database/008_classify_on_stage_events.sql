-- Classify only unambiguous on-stage formats. Ambiguous formats such as
-- Folk Dance and Patriotic Song remain in the general On-Stage category.
UPDATE festival.events
SET program_category_id=(SELECT id FROM festival.program_categories WHERE slug='individual')
WHERE name IN (
  'Poetry Recitation - Malayalam - UP',
  'Poetry Recitation - English - UP',
  'Poetry Recitation - Hindi - UP',
  'Poetry Recitation - Arabic - UP',
  'Poetry Recitation - Urdu - UP',
  'Light Music - UP',
  'Mappilappattu - UP',
  'Bharatanatyam - UP',
  'Mohiniyattam - UP',
  'Kuchipudi - UP',
  'Mono Act - UP',
  'Kathaprasangam - UP',
  'Light Music - LP',
  'Mappilappattu - LP',
  'Malayalam Poetry - LP',
  'Mono Act - LP'
);

UPDATE festival.events
SET program_category_id=(SELECT id FROM festival.program_categories WHERE slug='group')
WHERE name IN (
  'Group Song - UP',
  'Oppana - UP',
  'Group Dance - UP',
  'Group Dance - LP'
);
