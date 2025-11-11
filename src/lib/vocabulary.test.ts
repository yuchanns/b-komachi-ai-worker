import { describe, test, expect, beforeAll } from "vitest"
import { env } from "cloudflare:test"
import { Injector } from "../bindings"
import { _analyze, differenciate } from "./vocabulary"
import { createEdgeTTSAPI } from "../services"
import { promptToTranslate } from "./prompts"
import { createTelegramBotAPI } from "../services/telegram"
import { createAzureAPI } from "../services/openai/azure"

describe("ai", () => {
    let inj: Injector

    beforeAll(() => {
        inj = {
            ai: createAzureAPI({
                url: env.ENV_AZURE_URL,
                apiVersion: env.ENV_AZURE_API_VERSION,
                apiKey: env.ENV_AZURE_API_KEY,
            }),
        } as Injector
    })

    test("word", async () => {
        const typ = await differenciate(inj, "sophisticated")
        expect(typ).toBe("word")
    })
    test("phrase", async () => {
        const typ = await differenciate(inj, "writing paper")
        expect(typ).toBe("phrase")
    })
    test("sentence", async () => {
        const typ = await differenciate(inj, "It will give you lowered video resolutions")
        expect(typ).toBe("sentence")
    }, 100000)
    test("prompt_translate", async () => {
        const messages = promptToTranslate(
            "I saw a guy throwing red wine at a woman during an argument while I was eating food in the locomotive restaurant."
        )
        const params = {
            messages,
            temperature: 0.3,
        }
        const response = await inj.ai.chat(params)
        console.log(response?.choices[0]?.message.content)
    }, 100000)
})

describe("bot", () => {
    let bot: ReturnType<typeof createTelegramBotAPI>

    beforeAll(() => {
        bot = createTelegramBotAPI(env.ENV_BOT_TOKEN)
    })

    test("getMe", async () => {
        const resp = await bot.getMe()
        console.log(resp)
    })
    test("markdown", async () => {
        await bot.sendMessage({
            chat_id: env.ENV_CHAT_ID,
            text: `
*bold*
_italic_
__underline__
~strikethrought~
||spoiler||
[inline URL](https://github.com/yuchanns)
\`inline code\`
\`\`\`python
print("hello world")
\`\`\`
`,
            parse_mode: "MarkdownV2",
        })
    })
})

describe("tts", () => {
    test("textToSpeech", async () => {
        const tts = createEdgeTTSAPI()
        const audioBlob = await tts.textToSpeech({ text: "hello" })
        expect(audioBlob).toBeDefined()
        expect(audioBlob.size).toBeGreaterThan(0)
    })
})

describe("toml", () => {
    let inj: Injector

    beforeAll(() => {
        inj = {
            ai: createAzureAPI({
                url: env.ENV_AZURE_URL,
                apiVersion: env.ENV_AZURE_API_VERSION,
                apiKey: env.ENV_AZURE_API_KEY,
            }),
            bot: createTelegramBotAPI(env.ENV_BOT_TOKEN),
            tts: createEdgeTTSAPI(),
        } as Injector
    })

    test("parse", async () => {
        const {
            result: { message_id },
        } = await inj.bot.sendMessage({
            chat_id: env.ENV_CHAT_ID,
            text: "正在查询，请稍候...",
        })
        await _analyze(inj, "sophisticated", Number(env.ENV_CHAT_ID), message_id, Number(undefined))
    }, 10000)
})
