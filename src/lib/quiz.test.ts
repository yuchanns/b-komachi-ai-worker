import { describe, test, expect, beforeEach } from "vitest"
import { storeVocabulary, getUserVocabulary, generateQuiz } from "./quiz"
import { Injector } from "../bindings"

describe("quiz vocabulary storage", () => {
    let mockKV: KVNamespace

    beforeEach(() => {
        const storage = new Map<string, string>()
        mockKV = {
            get: async (key: string) => storage.get(key) || null,
            put: async (key: string, value: string) => {
                storage.set(key, value)
            },
            delete: async (key: string) => {
                storage.delete(key)
            },
        } as KVNamespace
    })

    test("should store vocabulary for user", async () => {
        const userId = 12345
        const word = "sophisticated"

        await storeVocabulary(mockKV, userId, word)

        const words = await getUserVocabulary(mockKV, userId)
        expect(words).toContain("sophisticated")
        expect(words.length).toBe(1)
    })

    test("should not duplicate words", async () => {
        const userId = 12345

        await storeVocabulary(mockKV, userId, "hello")
        await storeVocabulary(mockKV, userId, "hello")
        await storeVocabulary(mockKV, userId, "Hello")

        const words = await getUserVocabulary(mockKV, userId)
        expect(words.length).toBe(1)
        expect(words[0]).toBe("hello")
    })

    test("should store multiple words", async () => {
        const userId = 12345

        await storeVocabulary(mockKV, userId, "hello")
        await storeVocabulary(mockKV, userId, "world")
        await storeVocabulary(mockKV, userId, "test")

        const words = await getUserVocabulary(mockKV, userId)
        expect(words.length).toBe(3)
        expect(words).toContain("hello")
        expect(words).toContain("world")
        expect(words).toContain("test")
    })

    test("should return empty array for user with no vocabulary", async () => {
        const userId = 99999
        const words = await getUserVocabulary(mockKV, userId)
        expect(words).toEqual([])
    })

    test("should limit vocabulary to 100 words", async () => {
        const userId = 12345

        // Store 110 words
        for (let i = 0; i < 110; i++) {
            await storeVocabulary(mockKV, userId, `word${i}`)
        }

        const words = await getUserVocabulary(mockKV, userId)
        expect(words.length).toBe(100)
        // Should keep the last 100 words
        expect(words).toContain("word109")
        expect(words).not.toContain("word0")
    })

    test("should store vocabulary for different users separately", async () => {
        const userId1 = 12345
        const userId2 = 67890

        await storeVocabulary(mockKV, userId1, "hello")
        await storeVocabulary(mockKV, userId2, "world")

        const words1 = await getUserVocabulary(mockKV, userId1)
        const words2 = await getUserVocabulary(mockKV, userId2)

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
