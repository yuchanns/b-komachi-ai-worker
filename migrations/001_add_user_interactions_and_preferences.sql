-- Migration: Add user_interactions and user_preferences tables
-- Date: 2024-11-12
-- Description: This migration adds support for daily tips and per-user AI model preferences
-- Safe to run multiple times - uses IF NOT EXISTS

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
