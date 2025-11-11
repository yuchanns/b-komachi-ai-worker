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

    test("should handle AI response parsing with new question format", async () => {
        const mockAI = {
            chat: async () => ({
                choices: [
                    {
                        message: {
                            content: JSON.stringify([
                                {
                                    type: "meaning",
                                    word: "hello",
                                    question: '"hello" 的中文意思是什么？',
                                    correct_answer: "你好",
                                    options: ["你好", "再见", "谢谢", "对不起"],
                                    correct_index: 0,
                                    explanation: "hello 是常见的打招呼用语",
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
        expect(questions[0].type).toBe("meaning")
        expect(questions[0].question).toBeDefined()
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
                                    type: "meaning",
                                    word: "hello",
                                    question: '"hello" 的中文意思是什么？',
                                    correct_answer: "你好",
                                    options: ["你好", "再见", "谢谢", "对不起"],
                                    correct_index: 0,
                                },
                                {
                                    type: "meaning",
                                    word: "invalid",
                                    question: "invalid question",
                                    correct_answer: "test",
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

    test("should support multiple question types", async () => {
        const mockAI = {
            chat: async () => ({
                choices: [
                    {
                        message: {
                            content: JSON.stringify([
                                {
                                    type: "meaning",
                                    word: "sophisticated",
                                    question: '"sophisticated" 的中文意思是什么？',
                                    correct_answer: "复杂的；精致的",
                                    options: ["复杂的；精致的", "简单的", "普通的", "粗糙的"],
                                    correct_index: 0,
                                },
                                {
                                    type: "fill_blank",
                                    word: "beautiful",
                                    question: "The garden is very ___. 应该填入哪个单词？",
                                    correct_answer: "beautiful",
                                    options: ["beautiful", "beauty", "beautifully", "beautify"],
                                    correct_index: 0,
                                },
                            ]),
                        },
                    },
                ],
            }),
        }
        const injector = { ai: mockAI } as unknown as Injector

        const questions = await generateQuiz(injector, ["sophisticated", "beautiful"])
        expect(questions.length).toBe(2)
        expect(questions[0].type).toBe("meaning")
        expect(questions[1].type).toBe("fill_blank")
    })
})
