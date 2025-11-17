-- Migration: Add tts_voice column to user_preferences table
-- This migration adds support for user TTS voice preferences

-- Add tts_voice column to user_preferences table
-- Note: This will fail silently if the column already exists, which is the desired behavior
ALTER TABLE user_preferences ADD COLUMN tts_voice TEXT;
