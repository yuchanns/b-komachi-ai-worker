import { Injector } from "../types"
import { differenciate, promptToTranslate } from "./update"
import createTelegramBotAPI, { createOpenAIAPI } from "../clients"

const env = getMiniflareBindings()

describe("ai", () => {
	const inj = {
		ai: createOpenAIAPI({
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
	})
	test("prompt_translate", async () => {
		const messages = promptToTranslate("I saw a guy throwing red wine at a woman during an argument while I was eating food in the locomotive restaurant.")
		const params = {
			messages,
			temperature: 0.3
		}
		const response = await inj.ai.chat(params)
		console.log(response?.
			choices[0]?.message.content)
	})
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
