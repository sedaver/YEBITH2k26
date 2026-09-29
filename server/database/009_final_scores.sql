ALTER TABLE festival.settings
 ADD COLUMN IF NOT EXISTS final_published boolean NOT NULL DEFAULT false;
ALTER TABLE festival.settings
 ADD COLUMN IF NOT EXISTS final_published_at timestamptz;
ALTER TABLE festival.settings
 ADD COLUMN IF NOT EXISTS final_snapshot jsonb;
