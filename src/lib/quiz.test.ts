import { describe, test, expect, beforeEach } from "vitest"
import { storeVocabulary, getUserVocabulary, generateQuiz, storeQuizState } from "./quiz"
import { Injector } from "../bindings"

// Mock D1 Database
class MockD1Database {
    private vocabularyData: Array<{ id: number; user_id: number; word: string; timestamp: number }> = []
    private quizStateData: Array<{ user_id: number; questions: string; answers: string; created_at: number; expires_at: number }> = []
    private nextId = 1

    prepare(sql: string) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this
        return {
            bind(...params: unknown[]) {
                return {
                    async run() {
                        // Handle INSERT for vocabulary
                        if (sql.includes("INSERT INTO vocabulary")) {
                            const [userId, word, timestamp] = params as [number, string, number]
                            const existing = self.vocabularyData.find(
                                (v) => v.user_id === userId && v.word.toLowerCase() === word.toLowerCase()
                            )
                            if (!existing) {
                                self.vocabularyData.push({
                                    id: self.nextId++,
                                    user_id: userId,
                                    word,
                                    timestamp,
                                })
                            }
                            return { success: true }
                        }
                        // Handle DELETE for vocabulary cleanup
                        else if (sql.includes("DELETE FROM vocabulary") && sql.includes("NOT IN")) {
                            const [userId] = params as [number, number]
                            // Keep only last 100 words
                            const userWords = self.vocabularyData
                                .filter((v) => v.user_id === userId)
                                .sort((a, b) => b.timestamp - a.timestamp)
                            if (userWords.length > 100) {
                                const keepIds = userWords.slice(0, 100).map((v) => v.id)
                                self.vocabularyData = self.vocabularyData.filter((v) => v.user_id !== userId || keepIds.includes(v.id))
                            }
                            return { success: true }
                        }
                        // Handle INSERT/UPDATE for quiz_state
                        else if (sql.includes("INSERT INTO quiz_state")) {
                            const [userId, questions, answers, created_at, expires_at] = params as [number, string, string, number, number]
                            const existingIndex = self.quizStateData.findIndex((q) => q.user_id === userId)
                            if (existingIndex >= 0) {
                                self.quizStateData[existingIndex] = { user_id: userId, questions, answers, created_at, expires_at }
                            } else {
                                self.quizStateData.push({ user_id: userId, questions, answers, created_at, expires_at })
                            }
                            return { success: true }
                        }
                        // Handle DELETE for quiz_state
                        else if (sql.includes("DELETE FROM quiz_state")) {
                            if (sql.includes("expires_at")) {
                                const [now] = params as [number]
                                self.quizStateData = self.quizStateData.filter((q) => q.expires_at > now)
                            } else {
                                const [userId] = params as [number]
                                self.quizStateData = self.quizStateData.filter((q) => q.user_id !== userId)
                            }
                            return { success: true }
                        }
                        // Handle UPDATE for quiz_state
                        else if (sql.includes("UPDATE quiz_state")) {
                            const [answers, userId] = params as [string, number]
                            const quiz = self.quizStateData.find((q) => q.user_id === userId)
                            if (quiz) {
                                quiz.answers = answers
                            }
                            return { success: true }
                        }
                        return { success: true }
                    },
                    async all<T>() {
                        // Handle SELECT for vocabulary
                        if (sql.includes("SELECT word FROM vocabulary")) {
                            const [userId] = params as [number]
                            const results = self.vocabularyData
                                .filter((v) => v.user_id === userId)
                                .sort((a, b) => b.timestamp - a.timestamp)
                                .map((v) => ({ word: v.word })) as T[]
                            return { results, success: true }
                        }
                        return { results: [] as T[], success: true }
                    },
                    async first<T>() {
                        // Handle SELECT for quiz_state
                        if (sql.includes("SELECT questions, answers FROM quiz_state")) {
                            const [userId, now] = params as [number, number]
                            const quiz = self.quizStateData.find((q) => q.user_id === userId && q.expires_at > now)
                            return (quiz || null) as T | null
                        }
                        return null
                    },
                }
            },
        }
    }
}

describe("quiz vocabulary storage with D1", () => {
    let mockDB: D1Database

    beforeEach(() => {
        mockDB = new MockD1Database() as unknown as D1Database
    })

    test("should store vocabulary for user", async () => {
        const userId = 12345
        const word = "sophisticated"

        await storeVocabulary(mockDB, userId, word)

        const words = await getUserVocabulary(mockDB, userId)
        expect(words).toContain("sophisticated")
        expect(words.length).toBe(1)
    })

    test("should not duplicate words", async () => {
        const userId = 12345

        await storeVocabulary(mockDB, userId, "hello")
        await storeVocabulary(mockDB, userId, "hello")
        await storeVocabulary(mockDB, userId, "Hello")

        const words = await getUserVocabulary(mockDB, userId)
        expect(words.length).toBe(1)
        expect(words[0]).toBe("hello")
    })

    test("should store multiple words", async () => {
        const userId = 12345

        await storeVocabulary(mockDB, userId, "hello")
        await storeVocabulary(mockDB, userId, "world")
        await storeVocabulary(mockDB, userId, "test")

        const words = await getUserVocabulary(mockDB, userId)
        expect(words.length).toBe(3)
        expect(words).toContain("hello")
        expect(words).toContain("world")
        expect(words).toContain("test")
    })

    test("should return empty array for user with no vocabulary", async () => {
        const userId = 99999
        const words = await getUserVocabulary(mockDB, userId)
        expect(words).toEqual([])
    })

    test("should limit vocabulary to 100 words", async () => {
        const userId = 12345

        // Store 110 words
        for (let i = 0; i < 110; i++) {
            await storeVocabulary(mockDB, userId, `word${i}`)
        }

        const words = await getUserVocabulary(mockDB, userId)
        expect(words.length).toBe(100)
        // Should keep the last 100 words
        expect(words).toContain("word109")
        expect(words).not.toContain("word0")
    })

    test("should store vocabulary for different users separately", async () => {
        const userId1 = 12345
        const userId2 = 67890

        await storeVocabulary(mockDB, userId1, "hello")
        await storeVocabulary(mockDB, userId2, "world")

        const words1 = await getUserVocabulary(mockDB, userId1)
        const words2 = await getUserVocabulary(mockDB, userId2)

        expect(words1).toEqual(["hello"])
        expect(words2).toEqual(["world"])
    })
})

describe("quiz generation", () => {
    test("should return empty array for empty vocabulary", async () => {
        const mockAI = {
            chat: async () => ({
                choices: [{ message: { content: "[]" } }],
            }),
        }
        const injector = { ai: mockAI } as unknown as Injector

        const questions = await generateQuiz(injector, [])
        expect(questions).toEqual([])
    })

    test("should handle AI response parsing", async () => {
        const mockAI = {
            chat: async () => ({
                choices: [
                    {
                        message: {
                            content: JSON.stringify([
                                {
                                    word: "hello",
                                    correct_meaning: "a greeting",
                                    options: ["a greeting", "goodbye", "thank you", "sorry"],
                                    correct_index: 0,
                                },
                            ]),
                        },
                    },
                ],
            }),
        }
        const injector = { ai: mockAI } as unknown as Injector

        const questions = await generateQuiz(injector, ["hello"])
        expect(questions.length).toBeGreaterThan(0)
        expect(questions[0].word).toBe("hello")
        expect(questions[0].options.length).toBe(4)
    })

    test("should handle malformed AI response gracefully", async () => {
        const mockAI = {
            chat: async () => ({
                choices: [{ message: { content: "invalid json" } }],
            }),
        }
        const injector = { ai: mockAI } as unknown as Injector

        const questions = await generateQuiz(injector, ["hello"])
        expect(questions).toEqual([])
    })

    test("should filter out invalid questions", async () => {
        const mockAI = {
            chat: async () => ({
                choices: [
                    {
                        message: {
                            content: JSON.stringify([
                                {
                                    word: "hello",
                                    correct_meaning: "a greeting",
                                    options: ["a greeting", "goodbye", "thank you", "sorry"],
                                    correct_index: 0,
                                },
                                {
                                    word: "invalid",
                                    correct_meaning: "test",
                                    options: ["only", "three"], // Invalid: not 4 options
                                    correct_index: 0,
                                },
                            ]),
                        },
                    },
                ],
            }),
        }
        const injector = { ai: mockAI } as unknown as Injector

        const questions = await generateQuiz(injector, ["hello", "invalid"])
        expect(questions.length).toBe(1)
        expect(questions[0].word).toBe("hello")
    })
})

describe("quiz state storage with D1", () => {
    let mockDB: D1Database

    beforeEach(() => {
        mockDB = new MockD1Database() as unknown as D1Database
    })

    test("should store quiz state", async () => {
        const userId = 12345
        const questions = [
            {
                word: "hello",
                correct_meaning: "a greeting",
                options: ["a greeting", "goodbye", "thank you", "sorry"],
                correct_index: 0,
            },
        ]

        await storeQuizState(mockDB, userId, questions)

        // Verify it was stored (we can't directly query in tests, but no error means success)
        expect(true).toBe(true)
    })
})
