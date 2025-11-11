import { describe, test, expect } from "vitest"
import { createEdgeTTSAPI } from "./tts"
import { generateSecMsGec, generateConnectionId, dateToString } from "./utils"

describe("edge_tts utilities", () => {
	test("generateConnectionId should return UUID without dashes", () => {
		const id = generateConnectionId()
		expect(id).toBeDefined()
		expect(id.length).toBe(32) // UUID without dashes is 32 chars
		expect(id).not.toContain("-")
	})

	test("dateToString should return proper format", () => {
		const date = dateToString()
		expect(date).toBeDefined()
		expect(date).toContain("GMT+0000 (Coordinated Universal Time)")
	})

	test("generateSecMsGec should generate uppercase hex SHA-256 hash", async () => {
		const token = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
		const hash = await generateSecMsGec(token)
		expect(hash).toBeDefined()
		expect(hash.length).toBe(64) // SHA-256 produces 64 hex chars
		expect(hash).toMatch(/^[A-F0-9]+$/) // Should be uppercase hex
	})
})

describe("edge_tts API", () => {
	test("createEdgeTTSAPI should create API with textToSpeech method", () => {
		const api = createEdgeTTSAPI()
		expect(api).toBeDefined()
		expect(api.textToSpeech).toBeDefined()
		expect(typeof api.textToSpeech).toBe("function")
	})

	// Note: Integration test would require actual WebSocket connection
	// which might fail in test environment without proper network access
	test.skip('textToSpeech should accept proper parameters', async () => {
		const api = createEdgeTTSAPI()
		const params = {
			text: "Hello world",
			voice: "en-US-AriaNeural",
			pitch: "+0Hz",
			rate: "+0%",
			volume: "+0%"
		}
		
		// Just verify the function signature is correct
		expect(() => {
			// Don't actually call it to avoid network issues in tests
			const result = api.textToSpeech(params)
			expect(result).toBeInstanceOf(Promise)
		}).not.toThrow()
	})
})
