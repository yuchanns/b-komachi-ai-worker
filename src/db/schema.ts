import { sqliteTable, integer, text, index, uniqueIndex, real } from "drizzle-orm/sqlite-core"

// Vocabulary table to store user's queried words
export const vocabulary = sqliteTable(
    "vocabulary",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        userId: integer("user_id").notNull(),
        word: text("word").notNull(),
        timestamp: integer("timestamp").notNull(),
        weight: real("weight").notNull().default(1.0), // Weight for priority in quiz (higher = more mistakes)
        correctCount: integer("correct_count").notNull().default(0), // Number of times answered correctly
        incorrectCount: integer("incorrect_count").notNull().default(0), // Number of times answered incorrectly
        lastReviewed: integer("last_reviewed"), // Last time this word appeared in a quiz
    },
    (table) => ({
        userIdIdx: index("idx_vocabulary_user_id").on(table.userId),
        timestampIdx: index("idx_vocabulary_timestamp").on(table.timestamp),
        weightIdx: index("idx_vocabulary_weight").on(table.userId, table.weight),
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
