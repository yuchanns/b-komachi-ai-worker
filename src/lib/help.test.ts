import { describe, test, expect } from "vitest"
import { HELP_MESSAGE, getTipsMessage, getTodayDate } from "./help"

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
})
