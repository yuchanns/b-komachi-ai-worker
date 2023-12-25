import { Injector } from "../types"
import { _analyze, differenciate } from "./update"
import { createEdgeTTSAPI } from "../clients"
import { promptToTranslate } from "./prompts"
import { createTelegramBotAPI } from "@yuchanns/flamebot"
import { createAzureAPI } from "@yuchanns/flameai"

const env = getMiniflareBindings()

describe("ai", () => {
	const inj = {
		ai: createAzureAPI({
			url: env.ENV_AZURE_URL, apiVersion: env.ENV_AZURE_API_VERSION, apiKey: env.ENV_AZURE_API_KEY
		})
	} as Injector

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
		const messages = promptToTranslate("I saw a guy throwing red wine at a woman during an argument while I was eating food in the locomotive restaurant.")
		const params = {
			messages,
			temperature: 0.3
		}
		const response = await inj.ai.chat(params)
		console.log(response?.
			choices[0]?.message.content)
	}, 100000)
})

describe("bot", () => {
	const bot = createTelegramBotAPI(env.ENV_BOT_TOKEN)
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

describe("toml", () => {
	const inj = {
		ai: createAzureAPI({
			url: env.ENV_AZURE_URL, apiVersion: env.ENV_AZURE_API_VERSION, apiKey: env.ENV_AZURE_API_KEY
		}),
		bot: createTelegramBotAPI(env.ENV_BOT_TOKEN),
		tts: createEdgeTTSAPI()
	} as Injector
	test("parse", async () => {
		const {
			result: { message_id },
		} = await inj.bot.sendMessage({
			chat_id: env.ENV_CHAT_ID,
			text: "正在查询，请稍候..."
		})
		await _analyze(inj, "sophisticated", Number(env.ENV_CHAT_ID), message_id, Number(undefined))
	}, 10000)
})
