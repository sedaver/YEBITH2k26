-- Folk Dance is a group event for every division.
UPDATE festival.events
SET program_category_id=(SELECT id FROM festival.program_categories WHERE slug='group')
WHERE name IN ('Folk Dance - UP', 'Folk Dance - LP', 'Folk Dance - Female - HS');
