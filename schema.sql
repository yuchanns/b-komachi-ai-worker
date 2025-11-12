-- This schema file handles both fresh installation and migration from older versions
-- It's safe to run multiple times - it will only add missing columns/tables/indexes

-- Create vocabulary table if it doesn't exist (for fresh installations)
CREATE TABLE IF NOT EXISTS vocabulary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    word TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    weight REAL NOT NULL DEFAULT 1.0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    incorrect_count INTEGER NOT NULL DEFAULT 0,
    last_reviewed INTEGER,
    UNIQUE(user_id, word COLLATE NOCASE)
);

-- Add missing columns for existing tables (migration from older versions)
-- These will fail silently if columns already exist, which is expected
ALTER TABLE vocabulary ADD COLUMN weight REAL NOT NULL DEFAULT 1.0;
ALTER TABLE vocabulary ADD COLUMN correct_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vocabulary ADD COLUMN incorrect_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vocabulary ADD COLUMN last_reviewed INTEGER;

-- Create indexes (IF NOT EXISTS ensures they're only created if missing)
CREATE INDEX IF NOT EXISTS idx_vocabulary_user_id ON vocabulary(user_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_timestamp ON vocabulary(timestamp);
CREATE INDEX IF NOT EXISTS idx_vocabulary_weight ON vocabulary(user_id, weight);

-- Quiz state table to store active quiz sessions
CREATE TABLE IF NOT EXISTS quiz_state (
    user_id INTEGER PRIMARY KEY,
    questions TEXT NOT NULL,
    answers TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_state_expires_at ON quiz_state(expires_at);

-- User interactions table to track daily first interaction for tips
CREATE TABLE IF NOT EXISTS user_interactions (
    user_id INTEGER NOT NULL,
    interaction_date TEXT NOT NULL,
    PRIMARY KEY (user_id, interaction_date)
);

CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_date ON user_interactions(interaction_date);

-- User preferences table to store user-specific settings like AI model preference
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INTEGER PRIMARY KEY,
    ai_backend TEXT,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
