import { sqliteTable, integer, text, index, uniqueIndex } from "drizzle-orm/sqlite-core"

// Vocabulary table to store user's queried words
export const vocabulary = sqliteTable(
    "vocabulary",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        userId: integer("user_id").notNull(),
        word: text("word").notNull(),
        timestamp: integer("timestamp").notNull(),
    },
    (table) => ({
        userIdIdx: index("idx_vocabulary_user_id").on(table.userId),
        timestampIdx: index("idx_vocabulary_timestamp").on(table.timestamp),
        uniqueUserWord: uniqueIndex("unique_user_word").on(table.userId, table.word),
    })
)

// Quiz state table to store active quiz sessions
export const quizState = sqliteTable(
    "quiz_state",
    {
        userId: integer("user_id").primaryKey(),
        questions: text("questions").notNull(),
        answers: text("answers").notNull(),
        createdAt: integer("created_at").notNull(),
        expiresAt: integer("expires_at").notNull(),
    },
    (table) => ({
        expiresAtIdx: index("idx_quiz_state_expires_at").on(table.expiresAt),
    })
)
