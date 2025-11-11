import { describe, test, expect } from "vitest"
import { generateQuiz } from "./quiz"
import { Injector } from "../bindings"

describe("quiz generation with Drizzle ORM", () => {
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
