-- Add 'substack' as a valid platform option for social_accounts
-- Run this in your Supabase SQL editor

-- Option 1: If using a CHECK constraint (most common)
ALTER TABLE social_accounts
DROP CONSTRAINT IF EXISTS social_accounts_platform_check;

ALTER TABLE social_accounts
ADD CONSTRAINT social_accounts_platform_check
CHECK (platform IN ('twitter', 'instagram', 'tiktok', 'youtube', 'linkedin', 'facebook', 'threads', 'substack'));

-- Option 2: If using an ENUM type (uncomment below and comment out Option 1)
-- ALTER TYPE social_platform ADD VALUE 'substack';

-- Also add the draft_content column to ideas table if not already added
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS draft_content TEXT;

-- Add platform_drafts column for storing platform-specific AI drafts (JSONB)
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS platform_drafts JSONB;
