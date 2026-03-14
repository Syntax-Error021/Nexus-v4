-- ============================================================
-- NEXUS DATING APP v4 — Supabase Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT '',
  age INTEGER,
  location TEXT DEFAULT '',
  gender TEXT DEFAULT '',
  interested_in TEXT DEFAULT 'Everyone',
  interests TEXT[] DEFAULT '{}',
  looking_for TEXT DEFAULT '',
  looking_for_custom TEXT DEFAULT '',
  prompt1 TEXT DEFAULT '',
  ans1 TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  photos JSONB DEFAULT '[]',
  login_method TEXT DEFAULT 'phone',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id TEXT NOT NULL,
  matched_user_id TEXT NOT NULL,
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  last_message TEXT DEFAULT '',
  unread INTEGER DEFAULT 0,
  UNIQUE(user_id, matched_user_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  from_user TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blocked users table
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  blocker_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  blocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- Likes table (for tracking swipes)
CREATE TABLE IF NOT EXISTS likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  liker_id TEXT NOT NULL,
  liked_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('like', 'pass')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(liker_id, liked_id)
);

-- Row Level Security (enable for production)
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_user_id ON matches(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_match_id ON messages(match_id);
CREATE INDEX IF NOT EXISTS idx_likes_liker_id ON likes(liker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_blocker_id ON blocked_users(blocker_id);

-- Function to get mutual connections count (placeholder)
-- In production, implement based on your social graph data
CREATE OR REPLACE FUNCTION get_mutual_count(user1_id TEXT, user2_id TEXT)
RETURNS INTEGER AS $$
BEGIN
  -- Placeholder: returns random 1-5 for demo
  RETURN floor(random() * 5 + 1)::INTEGER;
END;
$$ LANGUAGE plpgsql;
