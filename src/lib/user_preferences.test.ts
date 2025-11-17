import { describe, test, expect } from "vitest"
import { filterVoicesByLanguage, getCurrentLearningLanguage } from "./user_preferences"

describe("voice filtering", () => {
    test("filterVoicesByLanguage should filter voices by language prefix", () => {
        const voices = [
            { Name: "en-US-AriaNeural", Locale: "en-US" },
            { Name: "en-GB-RyanNeural", Locale: "en-GB" },
            { Name: "zh-CN-XiaoxiaoNeural", Locale: "zh-CN" },
            { Name: "ja-JP-NanamiNeural", Locale: "ja-JP" },
            { Name: "fr-FR-DeniseNeural", Locale: "fr-FR" },
        ]

        const enVoices = filterVoicesByLanguage(voices, "en")
        expect(enVoices).toHaveLength(2)
        expect(enVoices[0].Name).toBe("en-US-AriaNeural")
        expect(enVoices[1].Name).toBe("en-GB-RyanNeural")
    })

    test("filterVoicesByLanguage should handle empty array", () => {
        const voices: { Name: string; Locale: string }[] = []
        const filtered = filterVoicesByLanguage(voices, "en")
        expect(filtered).toHaveLength(0)
    })

    test("filterVoicesByLanguage should handle no matches", () => {
        const voices = [
            { Name: "zh-CN-XiaoxiaoNeural", Locale: "zh-CN" },
            { Name: "ja-JP-NanamiNeural", Locale: "ja-JP" },
        ]
        const filtered = filterVoicesByLanguage(voices, "en")
        expect(filtered).toHaveLength(0)
    })

    test("getCurrentLearningLanguage should return English", () => {
        const language = getCurrentLearningLanguage()
        expect(language).toBe("en")
    })
})
