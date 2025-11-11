import { describe, test, expect, beforeAll } from "vitest"
import { env } from "cloudflare:test"
import toml from "markty-toml"
import { differenciate, promptToAnalyze, promptToTranslate } from "../../layers"
import { createGeminiAPI } from "./gemini"
import { Injector } from "../../types"

describe("gemini", () => {
	let ai: ReturnType<typeof createGeminiAPI>
	
	beforeAll(() => {
		ai = createGeminiAPI({
			apiKey: env.ENV_GEMINI_API_KEY
		})
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
