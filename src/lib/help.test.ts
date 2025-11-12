import { describe, test, expect } from "vitest"
import { HELP_MESSAGE, getTipsMessage, getTodayDate, registerInteraction, isUserInteraction } from "./help"
import { Update } from "../services/telegram"

describe("help", () => {
    test("HELP_MESSAGE should contain key information", () => {
        expect(HELP_MESSAGE).toContain("查询单词")
        expect(HELP_MESSAGE).toContain("/quiz")
        expect(HELP_MESSAGE).toContain("/help")
        expect(HELP_MESSAGE).toContain("@bot_name")
    })

    test("getTipsMessage should contain usage tips", () => {
        const tips = getTipsMessage()
        expect(tips).toContain("/help")
        expect(tips).toContain("/quiz")
        expect(tips).toContain("使用提示")
    })

    test("getTodayDate should return date in YYYY-MM-DD format", () => {
        const today = getTodayDate()
        expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    test("isUserInteraction should detect /help command", () => {
        const update = {
            message: {
                text: "/help",
                chat: { id: 123 },
                from: { id: 456 },
            },
        } as Update
        expect(isUserInteraction(update, "testbot")).toBe(true)
    })

    test("isUserInteraction should detect /quiz command", () => {
        const update = {
            message: {
                text: "/quiz",
                chat: { id: 123 },
                from: { id: 456 },
            },
        } as Update
        expect(isUserInteraction(update, "testbot")).toBe(true)
    })

    test("isUserInteraction should detect vocabulary query", () => {
        const update = {
            message: {
                text: "@testbot hello",
                chat: { id: 123 },
                from: { id: 456 },
                entities: [{ type: "mention", offset: 0, length: 8 }],
            },
        } as Update
        expect(isUserInteraction(update, "testbot")).toBe(true)
    })

    test("isUserInteraction should return false for non-interaction", () => {
        const update = {
            message: {
                text: "just a regular message",
                chat: { id: 123 },
                from: { id: 456 },
            },
        } as Update
        expect(isUserInteraction(update, "testbot")).toBe(false)
    })

    test("registerInteraction should allow custom matchers", () => {
        // Register a custom interaction matcher
        registerInteraction((update) => {
            return update.message?.text === "custom_command"
        })

        const update = {
            message: {
                text: "custom_command",
                chat: { id: 123 },
                from: { id: 456 },
            },
        } as Update
        expect(isUserInteraction(update, "testbot")).toBe(true)
    })
})
