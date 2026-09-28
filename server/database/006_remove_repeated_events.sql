-- Remove the older names that duplicate the standardized LP/UP programme entries.
-- These events currently have no results; ON DELETE CASCADE also removes any
-- future dependent results if this migration is applied to another environment.
DELETE FROM festival.events
WHERE name IN (
  'Action song eng - LP',
  'Action song mal - LP',
  'Pencil drawing - LP',
  'Pencil drawing - UP',
  'Water painting - LP',
  'Water Painting - UP',
  'Recitation eng - LP',
  'Recitation eng - UP',
  'Recitation Hind - UP'
);
