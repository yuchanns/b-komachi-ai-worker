import { describe, test, expect, beforeAll } from "vitest"
import toml from "markty-toml"
import { differenciate, promptToAnalyze, promptToTranslate } from "../../lib"
import { Injector } from "../../bindings"
import { createOpenAIAPI } from "./openai"

describe("openai", () => {
    let ai: ReturnType<typeof createOpenAIAPI>

    beforeAll(() => {
        ai = createOpenAIAPI({
            url: process.env.ENV_OPENAI_URL!,
            apiKey: process.env.ENV_OPENAI_API_KEY!,
            model: process.env.ENV_OPENAI_MODEL!,
        })
    })

    test.skip("stream", async () => {
        const messages = promptToTranslate("hello")
        const params = {
            messages,
            temperature: 0.3,
        }
        await ai.chat(params, async (r, done) => {
            console.log(r?.choices[0]?.delta?.content)
            console.log(done)
        })
    })
    test.skip("non_stream", async () => {
        const typ = await differenciate({ ai } as Injector, "sophisticated")
        console.log(typ)
        expect(typ).toBe("word")
    })
    test.skip("prompt_translate", async () => {
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
                try {
                    const parsed = toml(content)
                    console.log(parsed)
                } catch (error) {
                    console.error("TOML parse error:", error)
                    console.error("Content:", content)
                }
            }
        })
    })
})
