import { describe, test, expect, beforeAll } from "vitest"
import { env } from "cloudflare:test"
import toml from "markty-toml"
import { differenciate, promptToAnalyze } from "../../lib"
import { createGeminiAPI } from "./gemini"
import { Injector } from "../../bindings"

describe("gemini", () => {
    let ai: ReturnType<typeof createGeminiAPI>

    beforeAll(() => {
        ai = createGeminiAPI({
            apiKey: env.ENV_GEMINI_API_KEY,
        })
    })

    test("non_stream", async () => {
        const typ = await differenciate({ ai } as Injector, "sophisticated")
        console.log(typ)
        expect(typ).toBe("word")
    })
    test("prompt_translate", async () => {
        const messages = promptToAnalyze("sophisticated")
        const params = {
            messages,
            temperature: 0.3,
        }
        let chunkText = ""
        await ai.chat(params, async (r, done) => {
            chunkText += r?.choices[0]?.delta?.content ?? ""
            if (done) {
                console.log(chunkText)
                const content = chunkText.replaceAll("[]", "[[]]").replaceAll(",]", "]")
                const parsed = toml(content)
                console.log(parsed)
            }
        })
    })
})
