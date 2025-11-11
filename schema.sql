-- Vocabulary table to store user's queried words
CREATE TABLE IF NOT EXISTS vocabulary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    word TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    UNIQUE(user_id, word COLLATE NOCASE)
);

CREATE INDEX IF NOT EXISTS idx_vocabulary_user_id ON vocabulary(user_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_timestamp ON vocabulary(timestamp);

-- Quiz state table to store active quiz sessions
CREATE TABLE IF NOT EXISTS quiz_state (
    user_id INTEGER PRIMARY KEY,
    questions TEXT NOT NULL,
    answers TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_state_expires_at ON quiz_state(expires_at);
