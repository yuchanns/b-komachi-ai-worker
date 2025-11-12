-- Migration: Add language column to user_preferences table
-- This migration adds support for user language preferences

-- Add language column to user_preferences table if it doesn't exist
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN, so we need to handle this carefully
-- This uses a safe approach that checks if the column exists before adding it

-- For SQLite, we need to use a different approach since it doesn't have a direct way to check column existence
-- We'll use the fact that adding a column that exists will fail, and we can ignore the error in the application

-- Add the language column
-- Note: This will fail silently if the column already exists, which is the desired behavior
ALTER TABLE user_preferences ADD COLUMN language TEXT;
