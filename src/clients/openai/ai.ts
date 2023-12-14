import { ChunkResponse, OpenAIAPI, Payloads } from "./types"


const makeRequest = (params: {
	url: string
	apiVersion: string
	apiKey: string
	body: Payloads
}) => {
	const u = new URL(`${params.url}/chat/completions?api-version=${params.apiVersion}`)
	const body = JSON.stringify(params.body)
	return new Request(u, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"api-key": params.apiKey
		},
		body: body
	})
}

const readStream = async (
	reader: ReadableStreamDefaultReader<ArrayBuffer>,
	onStream: (buffer: ArrayBuffer) => Promise<void>,
) => {
	while (true) {
		const { value, done } = await reader.read();
		if (done) {
			return
		}
		await onStream(value)
	}
}

const readChatStream = async (
	reader: ReadableStreamDefaultReader<ArrayBuffer>,
	onStream: (buffer: ChunkResponse | undefined, done: boolean) => Promise<void>,
) => {
	const decoder = new TextDecoder()
	let decoded = ""
	const prefix = "data: "
	await readStream(reader, async (value) => {
		decoded += decoder.decode(value, { stream: true })
		while (true) {
			const lineEndIndex = decoded.indexOf('\n')
			if (lineEndIndex === -1) {
				return
			}
			const line = decoded.slice(0, lineEndIndex);
			decoded = decoded.slice(lineEndIndex + 1);
			if (line == "") {
				continue
			}
			if (!line.startsWith(prefix)) {
				return
			}
			const data = line.slice(prefix.length)
			if (data == "[DONE]") {
				await onStream(undefined, true)
				return
			}
			const parsed = JSON.parse(data)
			if (parsed) {
				await onStream(parsed, false)
			}
		}
	})

}

export const createOpenAIAPI = (params: {
	url: string,
	apiVersion: string,
	apiKey: string
}) => {
	return {
		chat: async (payloads, onStream) => {
			if (onStream) {
				payloads.stream = true
			} else {
				payloads.stream = false
			}
			const r = makeRequest({
				url: params.url,
				apiVersion: params.apiVersion,
				apiKey: params.apiKey,
				body: payloads
			})
			const response = await fetch(r)
			if (!response.ok) {
				throw Error(response.statusText)
			}
			if (!onStream) {
				return await response.json()
			}
			if (!response.body) {
				throw Error("no body")
			}
			const reader = response.body.getReader()
			await readChatStream(reader, onStream)
		}
	} as OpenAIAPI
}
