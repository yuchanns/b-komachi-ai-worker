import { describe, test, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import toml from 'markty-toml';
import { differenciate, promptToAnalyze, promptToTranslate } from '../../lib';
import { Injector } from '../../bindings';
import { createOpenAIAPI } from './openai';

describe("openai", () => {
	let ai: ReturnType<typeof createOpenAIAPI>
	
	beforeAll(() => {
		ai = createOpenAIAPI({
			url: env.ENV_OPENAI_URL,
			apiKey: env.ENV_OPENAI_API_KEY,
			model: env.ENV_OPENAI_MODEL
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
