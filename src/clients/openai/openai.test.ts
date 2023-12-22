import toml from "markty-toml"
import { differenciate, promptToAnalyze, promptToTranslate } from "../../layers"
import { Injector } from "../../types"
import { createOpenAIAPI } from "./openai"

const env = getMiniflareBindings()

describe("openai", () => {
	const ai = createOpenAIAPI({
		url: env.ENV_OPENAI_URL,
		apiKey: env.ENV_OPENAI_API_KEY,
		model: env.ENV_OPENAI_MODEL
	})
	test("stream", async () => {
		const messages = promptToAnalyze("prevelent")
		let text = ""
		await ai.chat({
			messages,
			temperature: 0.3
		}, async (r, _) => {
			text += r?.choices[0].delta.content ?? ""
		})
		const parsed = toml(text.replaceAll(",]", "]"))
		console.log(parsed)
	}, 100000)
	test("non_stream", async () => {
		const typ = await differenciate({ ai } as Injector, "prevalent")
		expect(typ).toBe("word")
	})
	// FIXME: move all AI compatible tests in one place.
	test("prompt_translate", async () => {
		const messages = promptToTranslate("He is a cool man")
		const params = {
			messages,
			temperature: 0.3
		}
		const response = await ai.chat(params)
		console.log(response?.
			choices[0]?.message.content)
	})
})
