-- Add columns needed for the Library feature
-- Run this in your Supabase SQL editor

-- published_content: The final content that was actually posted
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS published_content TEXT;

-- published_at: Timestamp when the post was published
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- published_platforms: Array of platform names the post was published to
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS published_platforms TEXT[] DEFAULT '{}';

-- Index for faster library queries (published posts ordered by date)
CREATE INDEX IF NOT EXISTS idx_ideas_published_at ON ideas(published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
