-- Entities and Social Accounts Migration
-- Creates hierarchy: Entity (person/company) -> Social Accounts

-- Entities table (person or company)
CREATE TABLE IF NOT EXISTS entities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'person' CHECK (type IN ('person', 'company')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social accounts table (linked to entities)
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'instagram', 'tiktok', 'youtube', 'linkedin', 'facebook', 'threads')),
  handle TEXT,
  profile_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_id, platform)
);

-- Add target_platforms to ideas (array of social account IDs)
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS target_platforms UUID[] DEFAULT '{}';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_entities_user_id ON entities(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_entity_id ON social_accounts(entity_id);
CREATE INDEX IF NOT EXISTS idx_ideas_target_platforms ON ideas USING GIN(target_platforms);

-- Enable RLS
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies for entities
CREATE POLICY "Users can view their own entities"
  ON entities FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own entities"
  ON entities FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own entities"
  ON entities FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own entities"
  ON entities FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for social_accounts
CREATE POLICY "Users can view their own social accounts"
  ON social_accounts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own social accounts"
  ON social_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own social accounts"
  ON social_accounts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own social accounts"
  ON social_accounts FOR DELETE USING (auth.uid() = user_id);

-- Update triggers
CREATE TRIGGER update_entities_updated_at
  BEFORE UPDATE ON entities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_accounts_updated_at
  BEFORE UPDATE ON social_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
